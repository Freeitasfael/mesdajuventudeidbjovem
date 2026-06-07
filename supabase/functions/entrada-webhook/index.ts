// entrada-webhook: recebe notificações do Mercado Pago para pedidos da /entrada
// Usa MP_ACCESS_TOKEN_ENTRADA (separado do token da rifa).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function mapStatus(mpStatus: string | undefined | null): string | null {
  switch (mpStatus) {
    case "approved":
      return "paid";
    case "cancelled":
    case "rejected":
      return "cancelled";
    case "expired":
      return "expired";
    case "pending":
    case "in_process":
    case "authorized":
      return "pending";
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN_ENTRADA");

  if (!SUPABASE_URL || !SERVICE_ROLE || !MP_TOKEN) {
    console.log(JSON.stringify({ fn: "entrada-webhook", level: "error", event: "misconfig" }));
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  try {
    const url = new URL(req.url);
    let paymentId: string | null = url.searchParams.get("data.id") || url.searchParams.get("id");
    let topic: string | null = url.searchParams.get("type") || url.searchParams.get("topic");

    let body: any = null;
    if (req.method !== "GET") {
      body = await req.json().catch(() => null);
      if (body) {
        paymentId = paymentId || body?.data?.id || body?.id || null;
        topic = topic || body?.type || body?.action || null;
      }
    }

    console.log(JSON.stringify({ fn: "entrada-webhook", level: "info", event: "received", paymentId, topic }));

    if (!paymentId) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // Filtra apenas eventos de pagamento (ignora merchant_order etc.)
    if (topic && !String(topic).toLowerCase().includes("payment")) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });
    const mp = await mpRes.json();

    if (!mpRes.ok) {
      console.log(JSON.stringify({ fn: "entrada-webhook", level: "warn", event: "mp_fetch_failed", paymentId, http: mpRes.status, mp }));
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const orderId: string | null = mp?.external_reference ?? mp?.metadata?.entrada_order_id ?? null;
    if (!orderId) {
      console.log(JSON.stringify({ fn: "entrada-webhook", level: "warn", event: "no_external_reference", paymentId }));
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const { data: order } = await admin
      .from("entrada_orders")
      .select("id, status, product, model, size, quantity, total_cents")
      .eq("id", orderId)
      .maybeSingle();

    if (!order) {
      console.log(JSON.stringify({ fn: "entrada-webhook", level: "warn", event: "order_not_found", orderId, paymentId }));
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // Validação forte de external_reference (defesa em profundidade)
    if (String(mp?.external_reference ?? "") !== String(order.id)) {
      console.log(JSON.stringify({ fn: "entrada-webhook", level: "error", event: "external_reference_mismatch", orderId, paymentId, mp_ref: mp?.external_reference }));
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const newStatus = mapStatus(mp?.status);
    if (!newStatus) return new Response("ok", { status: 200, headers: corsHeaders });
    if (order.status === "paid") return new Response("ok", { status: 200, headers: corsHeaders });

    // Validação forte de valor (apenas quando o status é aprovação)
    if (newStatus === "paid") {
      const receivedCents = Math.round(Number(mp?.transaction_amount ?? 0) * 100);
      if (receivedCents !== order.total_cents) {
        console.log(JSON.stringify({
          fn: "entrada-webhook", level: "error", event: "amount_mismatch",
          orderId, paymentId, expected_cents: order.total_cents, received_cents: receivedCents,
        }));
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      if (mp?.status !== "approved") {
        console.log(JSON.stringify({ fn: "entrada-webhook", level: "warn", event: "status_not_approved", orderId, paymentId, mp_status: mp?.status }));
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
    }

    const { error: updErr } = await admin
      .from("entrada_orders")
      .update({ status: newStatus, mp_payment_id: String(mp.id), raw: mp })
      .eq("id", orderId);

    if (updErr) {
      console.log(JSON.stringify({ fn: "entrada-webhook", level: "error", event: "update_failed", err: updErr.message, orderId }));
    } else if (newStatus === "paid") {
      console.log(JSON.stringify({ fn: "entrada-webhook", level: "info", event: "order_paid", orderId, paymentId, amount_cents: order.total_cents }));
      try {
        await admin.rpc("decrement_entrada_stock", { _sku: "pulseira", _qty: order.quantity });
        if (order.product === "kit" && order.size) {
          const model = (order as { model?: string }).model || "adulto";
          await admin.rpc("decrement_entrada_stock", {
            _sku: `camiseta_${model}_${order.size}`,
            _qty: order.quantity,
          });
        }
      } catch (e) {
        console.log(JSON.stringify({ fn: "entrada-webhook", level: "error", event: "stock_decrement_failed", orderId, message: e instanceof Error ? e.message : String(e) }));
      }
    } else if (newStatus === "cancelled") {
      console.log(JSON.stringify({ fn: "entrada-webhook", level: "warn", event: "payment_rejected", orderId, paymentId, mp_status: mp?.status, mp_status_detail: mp?.status_detail }));
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (err) {
    console.log(JSON.stringify({ fn: "entrada-webhook", level: "error", event: "unexpected", message: err instanceof Error ? err.message : String(err) }));
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
});
