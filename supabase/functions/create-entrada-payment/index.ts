// create-entrada-payment: cria cobrança PIX ou Cartão (preference) no Mercado Pago para a /entrada
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_PRICES_CENTS = { pulseira: 1500, kit: 6000 } as const;

const ItemSchema = z.object({
  model: z.enum(["adulto", "baby", "infantil"]),
  size: z.string().trim().min(1).max(10),
  quantity: z.number().int().min(1).max(99),
});

const BodySchema = z.object({
  buyer_name: z.string().trim().min(2).max(120),
  buyer_phone: z.string().trim().min(8).max(20),
  buyer_email: z.string().trim().toLowerCase().email("E-mail inválido").max(180),
  product: z.enum(["pulseira", "kit"]),
  model: z.enum(["adulto", "baby", "infantil"]).optional().default("adulto"),
  size: z.string().trim().max(10).optional().nullable(),
  quantity: z.number().int().min(1).max(99),
  items: z.array(ItemSchema).min(1).max(20).optional().nullable(),
  method: z.enum(["pix", "card"]).optional().default("pix"),
  ref_code: z.string().trim().min(1).max(64).optional().nullable(),
  return_url: z.string().url().optional().nullable(),
  // Card token flow
  card_token: z.string().min(8).max(200).optional().nullable(),
  installments: z.number().int().min(1).max(24).optional().nullable(),
  payment_method_id: z.string().min(2).max(40).optional().nullable(),
  issuer_id: z.string().min(1).max(40).optional().nullable(),
  payer_email: z.string().email().optional().nullable(),
  payer_doc_type: z.string().min(2).max(10).optional().nullable(),
  payer_doc_number: z.string().min(5).max(20).optional().nullable(),
  device_id: z.string().min(4).max(200).optional().nullable(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const MP_TOKEN = Deno.env.get("MP_ACCESS_TOKEN_ENTRADA");

  try {
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return new Response(JSON.stringify({ error: "server_misconfig" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!MP_TOKEN) {
      return new Response(JSON.stringify({
        error: "mp_not_configured",
        message: "MP_ACCESS_TOKEN_ENTRADA ausente.",
      }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "invalid_input", details: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { buyer_name, buyer_phone, buyer_email, product, model, size, quantity, method, ref_code, return_url, card_token, installments, payment_method_id, issuer_id, payer_email, payer_doc_type, payer_doc_number, device_id } = parsed.data;
    const effectiveEmail = (payer_email || buyer_email).trim().toLowerCase();

    const { buyer_name, buyer_phone, buyer_email, product, model, size, quantity, items, method, ref_code, return_url, card_token, installments, payment_method_id, issuer_id, payer_email, payer_doc_type, payer_doc_number, device_id } = parsed.data;
    const effectiveEmail = (payer_email || buyer_email).trim().toLowerCase();

    // Normaliza itens: para kit, aceita "items" (multi-tamanho) ou cai pro legado model/size/quantity
    let normalizedItems: Array<{ model: string; size: string; quantity: number }> | null = null;
    let totalQty = quantity;
    if (product === "kit") {
      if (items && items.length > 0) {
        // Agrupa por (model,size) para somar repetições
        const agg = new Map<string, { model: string; size: string; quantity: number }>();
        for (const it of items) {
          const key = `${it.model}_${it.size}`;
          const prev = agg.get(key);
          if (prev) prev.quantity += it.quantity;
          else agg.set(key, { ...it });
        }
        normalizedItems = Array.from(agg.values());
        totalQty = normalizedItems.reduce((a, it) => a + it.quantity, 0);
      } else if (!size || size.length === 0) {
        return new Response(JSON.stringify({ error: "size_required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // SKUs a checar
    const shirtSkus = normalizedItems
      ? normalizedItems.map((it) => ({ sku: `camiseta_${it.model}_${it.size}`, qty: it.quantity }))
      : (product === "kit" && size ? [{ sku: `camiseta_${model}_${size}`, qty: quantity }] : []);
    const skusToCheck = ["pulseira", ...shirtSkus.map((s) => s.sku)];
    const { data: stockRows } = await admin
      .from("entrada_stock").select("sku, stock, label").in("sku", skusToCheck);
    const stockMap = new Map((stockRows ?? []).map((r) => [r.sku as string, r]));
    // Pulseira precisa de totalQty
    {
      const row = stockMap.get("pulseira");
      if (!row || (row.stock as number) < totalQty) {
        return new Response(JSON.stringify({
          error: "out_of_stock",
          message: `Sem estoque para ${row?.label ?? "pulseira"}. Disponível: ${row?.stock ?? 0}.`,
          sku: "pulseira",
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }
    for (const s of shirtSkus) {
      const row = stockMap.get(s.sku);
      if (!row || (row.stock as number) < s.qty) {
        return new Response(JSON.stringify({
          error: "out_of_stock",
          message: `Sem estoque para ${row?.label ?? s.sku}. Disponível: ${row?.stock ?? 0}.`,
          sku: s.sku,
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Preços
    const { data: priceRow } = await admin
      .from("app_settings").select("value").eq("key", "entrada_prices").maybeSingle();
    const cfg = (priceRow?.value ?? {}) as { pulseira_cents?: number; kit_cents?: number };
    const prices = {
      pulseira: cfg.pulseira_cents && cfg.pulseira_cents > 0 ? cfg.pulseira_cents : DEFAULT_PRICES_CENTS.pulseira,
      kit: cfg.kit_cents && cfg.kit_cents > 0 ? cfg.kit_cents : DEFAULT_PRICES_CENTS.kit,
    };
    const total_cents = prices[product] * totalQty;
    const expires_at = new Date(Date.now() + 30 * 60_000).toISOString();

    // Resolve revendedor pelo ref_code (case-insensitive)
    let seller_id: string | null = null;
    let referral_label: string | null = null;
    if (ref_code && ref_code.trim()) {
      const { data: seller } = await admin
        .from("sellers").select("id, name, ref_code")
        .ilike("ref_code", ref_code.trim()).maybeSingle();
      if (seller) {
        seller_id = seller.id;
        referral_label = `${seller.name} (${seller.ref_code})`;
      }
    }

    // Para compat: model/size do legado vêm do primeiro item quando multi
    const persistModel = normalizedItems ? normalizedItems[0].model : model;
    const persistSize = normalizedItems
      ? (normalizedItems.length === 1 ? normalizedItems[0].size : "MULTI")
      : (product === "kit" ? size : null);

    const { data: order, error: insErr } = await admin
      .from("entrada_orders")
      .insert({
        buyer_name, buyer_phone, buyer_email: effectiveEmail, product, model: persistModel,
        size: persistSize,
        quantity: totalQty, total_cents, status: "pending", expires_at,
        payment_method: method,
        seller_id, referral_label,
        items: normalizedItems,
      })
      .select("id").single();

    if (insErr || !order) {
      console.log(JSON.stringify({ fn: "create-entrada-payment", level: "error", event: "insert_failed", err: insErr?.message }));
      return new Response(JSON.stringify({ error: "db_error", message: insErr?.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookUrl = `${SUPABASE_URL}/functions/v1/entrada-webhook`;
    const description = `Mês da Juventude - ${product === "kit" ? `Kit ${model}${size ? ` ${size}` : ""}` : "Pulseira de acesso"} (x${quantity})`;

    if (method === "card") {
      // Inline (token-based) card charge
      if (card_token) {
        const firstName = buyer_name.split(" ")[0] ?? "Comprador";
        const lastName = buyer_name.split(" ").slice(1).join(" ") || "Entrada";
        const digits = buyer_phone.replace(/\D/g, "");
        const cardPayload: Record<string, unknown> = {
          transaction_amount: total_cents / 100,
          token: card_token,
          description,
          installments: Math.max(1, Math.min(24, installments ?? 1)),
          notification_url: webhookUrl,
          external_reference: order.id,
          metadata: { entrada_order_id: order.id, product, model, quantity },
          statement_descriptor: "MES JUVENTUDE",
          binary_mode: false,
          payer: {
            email: effectiveEmail,
            first_name: firstName,
            last_name: lastName,
            ...(payer_doc_type && payer_doc_number
              ? { identification: { type: payer_doc_type, number: payer_doc_number } }
              : {}),
          },
          additional_info: {
            items: [{
              id: `${product}_${model}`,
              title: product === "kit" ? `Kit ${model}${size ? ` ${size}` : ""}` : "Pulseira de acesso",
              description,
              category_id: "tickets",
              quantity,
              unit_price: (total_cents / quantity) / 100,
            }],
            payer: {
              first_name: firstName,
              last_name: lastName,
              ...(digits.length >= 10
                ? { phone: { area_code: digits.slice(0, 2), number: digits.slice(2) } }
                : {}),
            },
          },
        };
        if (payment_method_id) cardPayload.payment_method_id = payment_method_id;
        if (issuer_id) cardPayload.issuer_id = issuer_id;

        const mpHeaders: Record<string, string> = {
          Authorization: `Bearer ${MP_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": `entrada-card-${order.id}`,
        };
        if (device_id) mpHeaders["X-meli-session-id"] = device_id;

        const cardRes = await fetch("https://api.mercadopago.com/v1/payments", {
          method: "POST",
          headers: mpHeaders,
          body: JSON.stringify(cardPayload),
        });
        const cardData = await cardRes.json();
        if (!cardRes.ok) {
          console.log(JSON.stringify({ fn: "create-entrada-payment", level: "error", event: "card_error", http: cardRes.status, mp: cardData }));
          await admin.from("entrada_orders").update({ raw: cardData }).eq("id", order.id);
          return new Response(JSON.stringify({
            error: "mp_error", status: cardRes.status,
            message: cardData?.message ?? "Cartão recusado", details: cardData,
          }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const newStatus = cardData.status === "approved" ? "paid"
                        : cardData.status === "rejected" || cardData.status === "cancelled" ? "cancelled"
                        : "pending";
        await admin.from("entrada_orders").update({
          mp_payment_id: String(cardData.id),
          status: newStatus,
          raw: cardData,
        }).eq("id", order.id);

        return new Response(JSON.stringify({
          order_id: order.id, method: "card",
          mp_payment_id: String(cardData.id),
          status: cardData.status,
          status_detail: cardData.status_detail,
          total_cents, expires_at,
        }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Fallback: Checkout Pro preference (redirect)
      const back = return_url || `${SUPABASE_URL}`;
      const prefPayload = {
        items: [{
          title: description,
          quantity: 1,
          currency_id: "BRL",
          unit_price: total_cents / 100,
        }],
        payer: {
          name: buyer_name.split(" ")[0] ?? "Comprador",
          surname: buyer_name.split(" ").slice(1).join(" ") || "Entrada",
          email: effectiveEmail,
        },
        payment_methods: {
          excluded_payment_types: [{ id: "ticket" }, { id: "atm" }, { id: "bank_transfer" }],
          installments: 12,
        },
        back_urls: { success: back, failure: back, pending: back },
        auto_return: "approved",
        notification_url: webhookUrl,
        external_reference: order.id,
        metadata: { entrada_order_id: order.id, product, model, quantity },
        statement_descriptor: "MES JUVENTUDE",
      };
      const prefRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${MP_TOKEN}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": `entrada-pref-${order.id}`,
        },
        body: JSON.stringify(prefPayload),
      });
      const prefData = await prefRes.json();
      if (!prefRes.ok) {
        console.log(JSON.stringify({ fn: "create-entrada-payment", level: "error", event: "mp_pref_error", http: prefRes.status, mp: prefData }));
        await admin.from("entrada_orders").update({ status: "cancelled", raw: prefData }).eq("id", order.id);
        return new Response(JSON.stringify({
          error: "mp_error", status: prefRes.status,
          message: prefData?.message ?? "Erro no Mercado Pago", details: prefData,
        }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const init_point = prefData.init_point ?? prefData.sandbox_init_point ?? null;
      await admin.from("entrada_orders").update({
        mp_payment_id: String(prefData.id ?? ""),
        init_point,
        raw: prefData,
      }).eq("id", order.id);
      return new Response(JSON.stringify({
        order_id: order.id, method: "card", init_point, total_cents, expires_at,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // PIX
    const mpPayload = {
      transaction_amount: total_cents / 100,
      description,
      payment_method_id: "pix",
      notification_url: webhookUrl,
      external_reference: order.id,
      metadata: { entrada_order_id: order.id, product, model, quantity },
      payer: {
        email: effectiveEmail,
        first_name: buyer_name.split(" ")[0] ?? "Comprador",
        last_name: buyer_name.split(" ").slice(1).join(" ") || "Entrada",
      },
    };
    const mpRes = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": `entrada-${order.id}`,
      },
      body: JSON.stringify(mpPayload),
    });
    const mpData = await mpRes.json();
    if (!mpRes.ok) {
      console.log(JSON.stringify({ fn: "create-entrada-payment", level: "error", event: "mp_error", http: mpRes.status, mp: mpData }));
      await admin.from("entrada_orders").update({ status: "cancelled", raw: mpData }).eq("id", order.id);
      return new Response(JSON.stringify({
        error: "mp_error", status: mpRes.status, message: mpData?.message ?? "Erro no Mercado Pago", details: mpData,
      }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const tx = mpData?.point_of_interaction?.transaction_data ?? {};
    const qr_code = tx.qr_code ?? null;
    const qr_code_base64 = tx.qr_code_base64 ?? null;
    await admin.from("entrada_orders").update({
      mp_payment_id: String(mpData.id),
      qr_code, qr_code_base64, raw: mpData,
    }).eq("id", order.id);

    return new Response(JSON.stringify({
      order_id: order.id, method: "pix",
      mp_payment_id: String(mpData.id),
      qr_code, qr_code_base64, total_cents, expires_at,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.log(JSON.stringify({ fn: "create-entrada-payment", level: "error", event: "unexpected", message }));
    return new Response(JSON.stringify({ error: "internal_error", message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
