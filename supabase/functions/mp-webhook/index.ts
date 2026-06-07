// mp-webhook: recebe notificações do Mercado Pago e consulta a API para confirmar status.
// Nunca confia no payload — sempre busca pelo ID na API do MP.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
};

const mapStatus = (s: string): "pending" | "approved" | "rejected" | "refunded" | "expired" => {
  switch (s) {
    case "approved": return "approved";
    case "rejected":
    case "cancelled": return "rejected";
    case "refunded":
    case "charged_back": return "refunded";
    case "expired": return "expired";
    default: return "pending";
  }
};

type EventLevel = "info" | "warn" | "error";

async function logEvent(
  admin: SupabaseClient | null,
  level: EventLevel,
  event_type: string,
  message: string,
  ctx: {
    order_id?: string | null;
    payment_id?: string | null;
    provider_payment_id?: string | null;
    details?: unknown;
  } = {},
) {
  console.log(JSON.stringify({
    fn: "mp-webhook",
    level,
    event_type,
    message,
    order_id: ctx.order_id ?? null,
    payment_id: ctx.payment_id ?? null,
    provider_payment_id: ctx.provider_payment_id ?? null,
    details: ctx.details ?? null,
  }));
  if (admin) {
    try {
      await admin.from("payment_events").insert({
        level,
        event_type,
        order_id: ctx.order_id ?? null,
        payment_id: ctx.payment_id ?? null,
        provider_payment_id: ctx.provider_payment_id ?? null,
        message,
        details: ctx.details ?? null,
      });
    } catch (e) {
      console.log(JSON.stringify({ fn: "mp-webhook", level: "warn", event_type: "log_persist_failed", err: String(e) }));
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");

  const admin =
    SUPABASE_URL && SERVICE_ROLE
      ? createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })
      : null;

  try {
    if (!admin) throw new Error("server_misconfig");
    if (!MP_ACCESS_TOKEN) {
      await logEvent(admin, "error", "mp_not_configured", "MP_ACCESS_TOKEN ausente no webhook");
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const url = new URL(req.url);
    let paymentId =
      url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? null;
    let topic =
      url.searchParams.get("type") ?? url.searchParams.get("topic") ?? null;

    let body: Record<string, unknown> | null = null;
    if (req.method !== "GET") {
      try { body = await req.json(); } catch { body = null; }
    }

    if (!paymentId && body) {
      const data = (body as { data?: { id?: unknown } }).data;
      if (data?.id) paymentId = String(data.id);
      const t = (body as { type?: unknown; topic?: unknown }).type ?? (body as { topic?: unknown }).topic;
      if (t && !topic) topic = String(t);
    }

    await logEvent(admin, "info", "mp_webhook_received", "Webhook recebido do Mercado Pago", {
      provider_payment_id: paymentId,
      details: { topic },
    });

    if (!paymentId || (topic && topic !== "payment")) {
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } },
    );

    if (!mpRes.ok) {
      const text = await mpRes.text().catch(() => "");
      await logEvent(
        admin,
        mpRes.status === 404 ? "warn" : "error",
        "mp_fetch_failed",
        `Falha ao consultar pagamento no MP (HTTP ${mpRes.status})`,
        { provider_payment_id: paymentId, details: { http_status: mpRes.status, body: text.slice(0, 500) } },
      );
      if (mpRes.status === 404) {
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      return new Response("error", { status: 500, headers: corsHeaders });
    }

    const mpData = await mpRes.json();
    const newStatus = mapStatus(mpData.status);
    const orderIdFromMp =
      mpData.external_reference ?? mpData.metadata?.order_id ?? null;

    const { data: payment } = await admin
      .from("payments")
      .select("id, order_id, status")
      .eq("provider_payment_id", String(paymentId))
      .maybeSingle();

    const orderId = payment?.order_id ?? orderIdFromMp ?? null;
    if (!orderId) {
      await logEvent(admin, "warn", "webhook_no_order_match", "Webhook sem pedido correspondente", {
        provider_payment_id: paymentId,
        details: { mp_status: mpData.status },
      });
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // Validação forte de external_reference: se o pagamento já existe no banco,
    // o external_reference vindo do MP DEVE bater com o order_id do registro local.
    if (payment && orderIdFromMp && orderIdFromMp !== payment.order_id) {
      await logEvent(admin, "error", "external_reference_mismatch",
        "external_reference do MP diverge do order_id salvo — confirmação bloqueada", {
        order_id: payment.order_id, payment_id: payment.id, provider_payment_id: paymentId,
        details: { mp_external_reference: orderIdFromMp, local_order_id: payment.order_id },
      });
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // Idempotência do webhook: se este pagamento já foi aprovado, não reprocessar.
    if (payment && payment.status === "approved") {
      await logEvent(admin, "info", "webhook_idempotent_skip",
        "Pagamento já aprovado anteriormente — webhook ignorado (idempotente)", {
        order_id: orderId, payment_id: payment.id, provider_payment_id: paymentId,
      });
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // Validação forte de valor: comparar valor pago vs total do pedido no banco.
    if (newStatus === "approved") {
      const { data: orderRow } = await admin
        .from("orders")
        .select("total_cents, status")
        .eq("id", orderId)
        .maybeSingle();
      const expected = orderRow?.total_cents ?? null;
      const received = Math.round(Number(mpData.transaction_amount ?? 0) * 100);
      if (expected == null || expected !== received) {
        await logEvent(admin, "error", "amount_mismatch",
          "Valor do pagamento difere do total do pedido — confirmação bloqueada", {
          order_id: orderId, payment_id: payment?.id ?? null, provider_payment_id: paymentId,
          details: { expected_cents: expected, received_cents: received, mp_status: mpData.status },
        });
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
    }

    if (payment) {
      const { error: updErr } = await admin
        .from("payments")
        .update({ status: newStatus, raw: mpData })
        .eq("id", payment.id);
      if (updErr) {
        await logEvent(admin, "error", "payment_update_failed", "Erro ao atualizar pagamento", {
          order_id: orderId, payment_id: payment.id, provider_payment_id: paymentId,
          details: updErr.message,
        });
      }
    } else {
      const { error: insErr } = await admin.from("payments").insert({
        order_id: orderId,
        provider: "mercadopago",
        provider_payment_id: String(paymentId),
        status: newStatus,
        amount_cents: Math.round(Number(mpData.transaction_amount ?? 0) * 100),
        raw: mpData,
      });
      if (insErr) {
        await logEvent(admin, "error", "payment_insert_failed", "Erro ao inserir pagamento via webhook", {
          order_id: orderId, provider_payment_id: paymentId, details: insErr.message,
        });
      }
    }

    await logEvent(admin, "info", "mp_status_synced", `Status sincronizado: ${newStatus}`, {
      order_id: orderId,
      payment_id: payment?.id ?? null,
      provider_payment_id: paymentId,
      details: { mp_status: mpData.status, mp_status_detail: mpData.status_detail },
    });

    if (newStatus === "approved") {
      const { error: rpcErr } = await admin.rpc("confirm_payment", { _order_id: orderId });
      if (rpcErr) {
        await logEvent(admin, "error", "confirm_failed", "Falha ao confirmar pedido", {
          order_id: orderId, payment_id: payment?.id ?? null, provider_payment_id: paymentId,
          details: rpcErr.message,
        });
      } else {
        await logEvent(admin, "info", "order_confirmed", "Pedido confirmado", {
          order_id: orderId, payment_id: payment?.id ?? null, provider_payment_id: paymentId,
        });
      }
    } else if (newStatus === "rejected" || newStatus === "refunded") {
      await logEvent(admin, "warn", "payment_negative", `Pagamento ${newStatus}`, {
        order_id: orderId, payment_id: payment?.id ?? null, provider_payment_id: paymentId,
        details: { mp_status: mpData.status, mp_status_detail: mpData.status_detail },
      });
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    await logEvent(admin, "error", "webhook_unexpected", message);
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
});
