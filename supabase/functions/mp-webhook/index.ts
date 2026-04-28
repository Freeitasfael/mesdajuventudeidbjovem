// mp-webhook: recebe notificações do Mercado Pago e consulta a API para confirmar status.
// Nunca confia no payload — sempre busca pelo ID na API do MP.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
};

// Map MP status -> our status
const mapStatus = (s: string): "pending" | "approved" | "rejected" | "refunded" | "expired" => {
  switch (s) {
    case "approved":
      return "approved";
    case "rejected":
    case "cancelled":
      return "rejected";
    case "refunded":
    case "charged_back":
      return "refunded";
    case "expired":
      return "expired";
    default:
      return "pending";
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");

    if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error("server_misconfig");
    if (!MP_ACCESS_TOKEN) {
      console.log("[mp-webhook] MP_ACCESS_TOKEN missing");
      // Respond 200 so MP doesn't retry forever while not configured
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // Extract payment id from query OR body. MP sends multiple shapes.
    const url = new URL(req.url);
    let paymentId =
      url.searchParams.get("data.id") ??
      url.searchParams.get("id") ??
      null;
    let topic =
      url.searchParams.get("type") ??
      url.searchParams.get("topic") ??
      null;

    let body: Record<string, unknown> | null = null;
    if (req.method !== "GET") {
      try {
        body = await req.json();
      } catch {
        body = null;
      }
    }

    if (!paymentId && body) {
      const data = (body as { data?: { id?: unknown } }).data;
      if (data?.id) paymentId = String(data.id);
      const t = (body as { type?: unknown; topic?: unknown }).type ?? (body as { topic?: unknown }).topic;
      if (t && !topic) topic = String(t);
    }

    console.log("[mp-webhook] received", { paymentId, topic });

    if (!paymentId || (topic && topic !== "payment")) {
      // Ack non-payment topics so MP stops retrying
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // ALWAYS fetch fresh state from MP API
    const mpRes = await fetch(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      },
    );

    if (!mpRes.ok) {
      console.log("[mp-webhook] MP fetch failed", mpRes.status);
      // Return 200 if not found — likely test event
      if (mpRes.status === 404) {
        return new Response("ok", { status: 200, headers: corsHeaders });
      }
      return new Response("error", { status: 500, headers: corsHeaders });
    }

    const mpData = await mpRes.json();
    const newStatus = mapStatus(mpData.status);
    const orderIdFromMp =
      mpData.external_reference ?? mpData.metadata?.order_id ?? null;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // Find our payment row
    const { data: payment } = await admin
      .from("payments")
      .select("id, order_id, status")
      .eq("provider_payment_id", String(paymentId))
      .maybeSingle();

    let orderId = payment?.order_id ?? orderIdFromMp ?? null;
    if (!orderId) {
      console.log("[mp-webhook] no matching order found");
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    // Update payment row (or insert if missing)
    if (payment) {
      await admin
        .from("payments")
        .update({ status: newStatus, raw: mpData })
        .eq("id", payment.id);
    } else {
      await admin.from("payments").insert({
        order_id: orderId,
        provider: "mercadopago",
        provider_payment_id: String(paymentId),
        status: newStatus,
        amount_cents: Math.round(Number(mpData.transaction_amount ?? 0) * 100),
        raw: mpData,
      });
    }

    // If approved, confirm the order atomically (idempotent)
    if (newStatus === "approved") {
      const { error: rpcErr } = await admin.rpc("confirm_payment", {
        _order_id: orderId,
      });
      if (rpcErr) {
        console.log("[mp-webhook] confirm_payment error", rpcErr);
      } else {
        console.log("[mp-webhook] order confirmed", orderId);
      }
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.log("[mp-webhook] unexpected", message);
    // Avoid 500s — MP retries indefinitely
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
});
