// create-entrada-payment: cria cobrança PIX no Mercado Pago para a página /entrada
// IMPORTANTE: usa MP_ACCESS_TOKEN_ENTRADA (separado do MP_ACCESS_TOKEN da rifa).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const PRICES_CENTS = { pulseira: 1500, kit: 6000 } as const;

const BodySchema = z.object({
  buyer_name: z.string().trim().min(2).max(120),
  buyer_phone: z.string().trim().min(8).max(20),
  product: z.enum(["pulseira", "kit"]),
  size: z.string().trim().max(10).optional().nullable(),
  quantity: z.number().int().min(1).max(99),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN_ENTRADA");

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(JSON.stringify({ error: "server_misconfig" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!MP_TOKEN) {
      return new Response(
        JSON.stringify({
          error: "mp_not_configured",
          message:
            "MP_ACCESS_TOKEN_ENTRADA ausente. Configure o token do Mercado Pago da entrada.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "invalid_input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { buyer_name, buyer_phone, product, size, quantity } = parsed.data;

    if (product === "kit" && (!size || size.length === 0)) {
      return new Response(
        JSON.stringify({ error: "size_required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const total_cents = PRICES_CENTS[product] * quantity;
    const expires_at = new Date(Date.now() + 30 * 60_000).toISOString();

    const { data: order, error: insErr } = await admin
      .from("entrada_orders")
      .insert({
        buyer_name,
        buyer_phone,
        product,
        size: product === "kit" ? size : null,
        quantity,
        total_cents,
        status: "pending",
        expires_at,
      })
      .select("id")
      .single();

    if (insErr || !order) {
      console.log(JSON.stringify({ fn: "create-entrada-payment", level: "error", event: "insert_failed", err: insErr?.message }));
      return new Response(JSON.stringify({ error: "db_error", message: insErr?.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = `${SUPABASE_URL}/functions/v1/entrada-webhook`;
    const idempotencyKey = `entrada-${order.id}`;

    const mpPayload = {
      transaction_amount: total_cents / 100,
      description: `Mês da Juventude - ${product === "kit" ? "Kit pulseira + camiseta" : "Pulseira de acesso"} (x${quantity})`,
      payment_method_id: "pix",
      notification_url: webhookUrl,
      external_reference: order.id,
      metadata: { entrada_order_id: order.id, product, quantity },
      payer: {
        email: `entrada-${order.id.slice(0, 8)}@example.com`,
        first_name: buyer_name.split(" ")[0] ?? "Comprador",
        last_name: buyer_name.split(" ").slice(1).join(" ") || "Entrada",
      },
    };

    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(mpPayload),
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      console.log(JSON.stringify({ fn: "create-entrada-payment", level: "error", event: "mp_error", http: mpRes.status, mp: mpData }));
      await admin.from("entrada_orders").update({ status: "cancelled", raw: mpData }).eq("id", order.id);
      return new Response(
        JSON.stringify({ error: "mp_error", status: mpRes.status, message: mpData?.message ?? "Erro no Mercado Pago", details: mpData }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tx = mpData?.point_of_interaction?.transaction_data ?? {};
    const qr_code = tx.qr_code ?? null;
    const qr_code_base64 = tx.qr_code_base64 ?? null;

    await admin
      .from("entrada_orders")
      .update({
        mp_payment_id: String(mpData.id),
        qr_code,
        qr_code_base64,
        raw: mpData,
      })
      .eq("id", order.id);

    console.log(JSON.stringify({ fn: "create-entrada-payment", level: "info", event: "pix_created", order_id: order.id, mp_id: String(mpData.id) }));

    return new Response(
      JSON.stringify({
        order_id: order.id,
        mp_payment_id: String(mpData.id),
        qr_code,
        qr_code_base64,
        total_cents,
        expires_at,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.log(JSON.stringify({ fn: "create-entrada-payment", level: "error", event: "unexpected", message }));
    return new Response(JSON.stringify({ error: "internal_error", message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
