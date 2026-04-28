// create-payment: cria cobrança PIX no Mercado Pago para um order_id existente
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  order_id: z.string().uuid(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN");

    if (!SUPABASE_URL || !SERVICE_ROLE) {
      throw new Error("Configuração do servidor ausente");
    }
    if (!MP_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({
          error: "mp_not_configured",
          message:
            "Mercado Pago ainda não foi configurado. Adicione o secret MP_ACCESS_TOKEN.",
        }),
        {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "invalid_input",
          details: parsed.error.flatten().fieldErrors,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { order_id } = parsed.data;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // Load order + buyer
    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, status, total_cents, expires_at, buyer_id")
      .eq("id", order_id)
      .maybeSingle();

    if (orderErr || !order) {
      return new Response(
        JSON.stringify({ error: "order_not_found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (order.status !== "pending") {
      return new Response(
        JSON.stringify({
          error: "invalid_order_status",
          status: order.status,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (new Date(order.expires_at).getTime() < Date.now()) {
      return new Response(
        JSON.stringify({ error: "order_expired" }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Idempotency: if a pending payment already exists, return it
    const { data: existing } = await admin
      .from("payments")
      .select("id, status, qr_code, qr_code_base64, provider_payment_id, amount_cents")
      .eq("order_id", order_id)
      .eq("status", "pending")
      .maybeSingle();

    if (existing && existing.qr_code) {
      console.log("[create-payment] returning existing payment", existing.id);
      return new Response(
        JSON.stringify({
          payment_id: existing.id,
          provider_payment_id: existing.provider_payment_id,
          qr_code: existing.qr_code,
          qr_code_base64: existing.qr_code_base64,
          amount_cents: existing.amount_cents,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { data: buyer } = await admin
      .from("buyers")
      .select("name, phone")
      .eq("id", order.buyer_id)
      .maybeSingle();

    const amount = order.total_cents / 100;
    const idempotencyKey = `order-${order.id}-${Date.now()}`;

    // Build webhook URL (MP will POST here on status change)
    const webhookUrl = `${SUPABASE_URL}/functions/v1/mp-webhook`;

    const mpPayload = {
      transaction_amount: amount,
      description: `Rifa - Pedido ${order.id.slice(0, 8)}`,
      payment_method_id: "pix",
      notification_url: webhookUrl,
      external_reference: order.id,
      metadata: { order_id: order.id },
      payer: {
        email: `buyer-${order.buyer_id.slice(0, 8)}@rifa.local`,
        first_name: buyer?.name?.split(" ")[0] ?? "Comprador",
        last_name: buyer?.name?.split(" ").slice(1).join(" ") ?? "Rifa",
      },
    };

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(mpPayload),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.log("[create-payment] MP error", mpRes.status, mpData);
      return new Response(
        JSON.stringify({
          error: "mp_error",
          status: mpRes.status,
          message: mpData?.message ?? "Erro no Mercado Pago",
          details: mpData,
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const txData = mpData?.point_of_interaction?.transaction_data ?? {};
    const qr_code = txData.qr_code ?? null;
    const qr_code_base64 = txData.qr_code_base64 ?? null;

    const { data: payment, error: payErr } = await admin
      .from("payments")
      .insert({
        order_id: order.id,
        provider: "mercadopago",
        provider_payment_id: String(mpData.id),
        status: "pending",
        amount_cents: order.total_cents,
        qr_code,
        qr_code_base64,
        raw: mpData,
      })
      .select("id")
      .single();

    if (payErr || !payment) {
      console.log("[create-payment] db insert error", payErr);
      throw new Error("Não foi possível salvar o pagamento");
    }

    console.log("[create-payment] created", {
      payment_id: payment.id,
      mp_id: mpData.id,
      order_id: order.id,
    });

    return new Response(
      JSON.stringify({
        payment_id: payment.id,
        provider_payment_id: String(mpData.id),
        qr_code,
        qr_code_base64,
        amount_cents: order.total_cents,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.log("[create-payment] unexpected", message);
    return new Response(
      JSON.stringify({ error: "internal_error", message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
