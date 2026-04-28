// order-status: endpoint público para o frontend consultar estado do pedido + pagamento.
// Faz reconciliação ativa: se houver pagamento pendente, consulta o MP antes de responder.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const QuerySchema = z.object({ order_id: z.string().uuid() });

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

    const url = new URL(req.url);
    const parsed = QuerySchema.safeParse({
      order_id: url.searchParams.get("order_id"),
    });
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "invalid_input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { order_id } = parsed.data;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const { data: order } = await admin
      .from("orders")
      .select("id, status, total_cents, expires_at")
      .eq("id", order_id)
      .maybeSingle();

    if (!order) {
      return new Response(JSON.stringify({ error: "order_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: payment } = await admin
      .from("payments")
      .select("id, status, qr_code, qr_code_base64, provider_payment_id, amount_cents")
      .eq("order_id", order_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Active reconciliation: if order is pending and we have a pending payment with provider id,
    // poll MP to catch missed webhooks.
    if (
      MP_ACCESS_TOKEN &&
      order.status === "pending" &&
      payment?.status === "pending" &&
      payment.provider_payment_id
    ) {
      try {
        const mpRes = await fetch(
          `https://api.mercadopago.com/v1/payments/${payment.provider_payment_id}`,
          { headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` } },
        );
        if (mpRes.ok) {
          const mpData = await mpRes.json();
          const newStatus = mapStatus(mpData.status);
          if (newStatus !== "pending") {
            await admin
              .from("payments")
              .update({ status: newStatus, raw: mpData })
              .eq("id", payment.id);
            payment.status = newStatus;

            if (newStatus === "approved") {
              await admin.rpc("confirm_payment", { _order_id: order.id });
              order.status = "paid";
            }
          }
        }
      } catch (e) {
        console.log("[order-status] reconciliation error", e);
      }
    }

    return new Response(
      JSON.stringify({
        order: {
          id: order.id,
          status: order.status,
          total_cents: order.total_cents,
          expires_at: order.expires_at,
        },
        payment: payment
          ? {
              id: payment.id,
              status: payment.status,
              qr_code: payment.qr_code,
              qr_code_base64: payment.qr_code_base64,
              amount_cents: payment.amount_cents,
            }
          : null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.log("[order-status] unexpected", message);
    return new Response(
      JSON.stringify({ error: "internal_error", message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
