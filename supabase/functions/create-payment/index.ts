// create-payment: cria cobrança PIX no Mercado Pago para um order_id existente
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  order_id: z.string().uuid(),
  method: z.enum(["pix", "card"]).optional().default("pix"),
  return_url: z.string().url().optional().nullable(),
  // Card (token-based, inline form)
  card_token: z.string().min(8).max(200).optional().nullable(),
  installments: z.number().int().min(1).max(24).optional().nullable(),
  payment_method_id: z.string().min(2).max(40).optional().nullable(),
  issuer_id: z.string().min(1).max(40).optional().nullable(),
  payer_email: z.string().email().optional().nullable(),
  payer_doc_type: z.string().min(2).max(10).optional().nullable(),
  payer_doc_number: z.string().min(5).max(20).optional().nullable(),
});

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
  // Sempre escreve log estruturado nos edge function logs (correlação)
  const line = {
    fn: "create-payment",
    level,
    event_type,
    message,
    order_id: ctx.order_id ?? null,
    payment_id: ctx.payment_id ?? null,
    provider_payment_id: ctx.provider_payment_id ?? null,
    details: ctx.details ?? null,
  };
  console.log(JSON.stringify(line));

  // Persiste em payment_events (best-effort) para alertas e auditoria
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
      console.log(JSON.stringify({ fn: "create-payment", level: "warn", event_type: "log_persist_failed", err: String(e) }));
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
      await logEvent(admin, "error", "mp_not_configured", "MP_ACCESS_TOKEN ausente");
      return new Response(
        JSON.stringify({
          error: "mp_not_configured",
          message: "Mercado Pago ainda não foi configurado. Adicione o secret MP_ACCESS_TOKEN.",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      await logEvent(admin, "warn", "invalid_input", "Payload inválido em create-payment", {
        details: parsed.error.flatten().fieldErrors,
      });
      return new Response(
        JSON.stringify({ error: "invalid_input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { order_id, method, return_url, card_token, installments, payment_method_id, issuer_id, payer_email, payer_doc_type, payer_doc_number } = parsed.data;

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .select("id, status, total_cents, expires_at, buyer_id")
      .eq("id", order_id)
      .maybeSingle();

    if (orderErr || !order) {
      await logEvent(admin, "warn", "order_not_found", "Pedido não encontrado", {
        order_id,
        details: orderErr?.message,
      });
      return new Response(JSON.stringify({ error: "order_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (order.status !== "pending") {
      await logEvent(admin, "warn", "invalid_order_status", "Pedido em estado inválido para gerar PIX", {
        order_id,
        details: { status: order.status },
      });
      return new Response(
        JSON.stringify({ error: "invalid_order_status", status: order.status }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (new Date(order.expires_at).getTime() < Date.now()) {
      await logEvent(admin, "warn", "order_expired", "Pedido expirou antes de gerar PIX", { order_id });
      return new Response(JSON.stringify({ error: "order_expired" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // REGRA DE OURO: nunca reutilizar pagamento pendente.
    // Conta tentativas anteriores deste pedido (para chave idempotente determinística por tentativa)
    // e cancela QUALQUER pagamento pending antigo antes de criar um novo.
    const { data: existingPayments, count: existingCount } = await admin
      .from("payments")
      .select("id, status, provider_payment_id", { count: "exact" })
      .eq("order_id", order_id);

    const pendingOld = (existingPayments ?? []).filter((p) => p.status === "pending");
    if (pendingOld.length > 0) {
      const ids = pendingOld.map((p) => p.id);
      await admin.from("payments").update({ status: "cancelled" }).in("id", ids);
      await logEvent(admin, "warn", "pending_payment_superseded",
        "Pagamento(s) pendente(s) cancelado(s) — novo PIX será gerado para o pedido", {
        order_id,
        details: { cancelled_payment_ids: ids, cancelled_provider_ids: pendingOld.map((p) => p.provider_payment_id) },
      });
    }

    const { data: buyer } = await admin
      .from("buyers")
      .select("name, phone")
      .eq("id", order.buyer_id)
      .maybeSingle();

    // Valor SEMPRE recalculado a partir do banco (nunca confiar no client)
    const amount = order.total_cents / 100;
    // Idempotência determinística por tentativa: duplo-clique não cria 2 cobranças,
    // mas uma nova tentativa real (após cancelar a anterior) gera nova chave.
    const attempt = (existingCount ?? existingPayments?.length ?? 0) + 1;
    const idempotencyKey = `order-${order.id}-attempt-${attempt}`;
    const webhookUrl = `${SUPABASE_URL}/functions/v1/mp-webhook`;

    if (method === "card") {
      const back = return_url || `${SUPABASE_URL}`;
      const prefPayload = {
        items: [{
          title: `Rifa - Pedido ${order.id.slice(0, 8)}`,
          quantity: 1, currency_id: "BRL", unit_price: amount,
        }],
        payer: {
          name: buyer?.name?.split(" ")[0] ?? "Comprador",
          surname: buyer?.name?.split(" ").slice(1).join(" ") || "Rifa",
        },
        payment_methods: {
          excluded_payment_types: [{ id: "ticket" }, { id: "atm" }, { id: "bank_transfer" }],
          installments: 12,
        },
        back_urls: { success: back, failure: back, pending: back },
        auto_return: "approved",
        notification_url: webhookUrl,
        external_reference: order.id,
        metadata: { order_id: order.id },
      };
      const prefRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": `order-${order.id}-pref-${attempt}`,
        },
        body: JSON.stringify(prefPayload),
      });
      const prefData = await prefRes.json();
      if (!prefRes.ok) {
        await logEvent(admin, "error", "card_pref_failed", "Falha ao criar preferência de cartão", {
          order_id, details: { http_status: prefRes.status, mp_error: prefData },
        });
        return new Response(JSON.stringify({
          error: "mp_error", status: prefRes.status,
          message: prefData?.message ?? "Erro no Mercado Pago", details: prefData,
        }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const init_point = prefData.init_point ?? prefData.sandbox_init_point ?? null;
      await admin.from("orders").update({ payment_method: "card" }).eq("id", order.id);
      await admin.from("payments").insert({
        order_id: order.id,
        provider: "mercadopago",
        provider_payment_id: `pref:${prefData.id}`,
        status: "pending",
        amount_cents: order.total_cents,
        raw: prefData,
      });
      await logEvent(admin, "info", "card_pref_created", "Preferência de cartão criada", {
        order_id, details: { pref_id: prefData.id },
      });
      return new Response(JSON.stringify({
        method: "card", init_point, amount_cents: order.total_cents,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    const mpPayload = {
      transaction_amount: amount,
      description: `Rifa - Pedido ${order.id.slice(0, 8)}`,
      payment_method_id: "pix",
      notification_url: webhookUrl,
      external_reference: order.id,
      metadata: { order_id: order.id },
      payer: {
        email: `buyer-${order.buyer_id.slice(0, 8)}@example.com`,
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
      await logEvent(admin, "error", "pix_create_failed", "Erro do Mercado Pago ao criar PIX", {
        order_id,
        details: { http_status: mpRes.status, mp_error: mpData },
      });
      return new Response(
        JSON.stringify({
          error: "mp_error",
          status: mpRes.status,
          message: mpData?.message ?? "Erro no Mercado Pago",
          details: mpData,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const txData = mpData?.point_of_interaction?.transaction_data ?? {};
    const qr_code = txData.qr_code ?? null;
    const qr_code_base64 = txData.qr_code_base64 ?? null;

    if (!qr_code || !qr_code_base64) {
      await logEvent(admin, "error", "pix_missing_qr", "Mercado Pago não retornou QR Code", {
        order_id,
        provider_payment_id: String(mpData.id ?? ""),
        details: { mp_status: mpData?.status, mp_status_detail: mpData?.status_detail },
      });
    }

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
      await logEvent(admin, "error", "payment_insert_failed", "Falha ao salvar pagamento no banco", {
        order_id,
        provider_payment_id: String(mpData.id),
        details: payErr?.message,
      });
      throw new Error("Não foi possível salvar o pagamento");
    }

    await logEvent(admin, "info", "pix_created", "PIX criado com sucesso", {
      order_id,
      payment_id: payment.id,
      provider_payment_id: String(mpData.id),
    });

    return new Response(
      JSON.stringify({
        payment_id: payment.id,
        provider_payment_id: String(mpData.id),
        qr_code,
        qr_code_base64,
        amount_cents: order.total_cents,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    await logEvent(admin, "error", "create_payment_unexpected", message);
    return new Response(JSON.stringify({ error: "internal_error", message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
