// Edge Function: reserve-numbers
// Validates buyer info, captures ref_code, creates order, atomically reserves numbers.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RESERVATION_MINUTES = 10;

const BodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .refine(
      (v) => v.trim().split(/\s+/).length >= 2,
      "Informe nome e sobrenome",
    ),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10,11}$/, "Telefone deve ter 10 ou 11 dígitos"),
  numbers: z.array(z.number().int().min(1).max(600)).min(1).max(50),
  ref_code: z.string().trim().min(1).max(64).optional().nullable(),
  ref_input: z.string().trim().min(1).max(120).optional().nullable(),

});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      throw new Error("Configuração do servidor ausente");
    }

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      console.log("[reserve-numbers] validation error", parsed.error.flatten());
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

    // Dedupe numbers
    const numbers = Array.from(new Set(parsed.data.numbers));
    const { name, phone, ref_code, ref_input } = parsed.data;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    // Price per number
    const { data: priceRow, error: priceErr } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "price_per_number_cents")
      .maybeSingle();

    if (priceErr || !priceRow) {
      console.log("[reserve-numbers] price error", priceErr);
      throw new Error("Preço não configurado");
    }
    const pricePerNumber = Number(priceRow.value);
    if (!Number.isFinite(pricePerNumber) || pricePerNumber <= 0) {
      throw new Error("Preço inválido");
    }
    const total_cents = pricePerNumber * numbers.length;

    // Resolve seller (optional): try exact ref_code first (auto-captured from link),
    // then fall back to user-typed input matching ref_code OR name (case-insensitive).
    let seller_id: string | null = null;
    let referral_label: string | null = null;
    if (ref_code) {
      const { data: seller } = await admin
        .from("sellers")
        .select("id, name, ref_code")
        .eq("ref_code", ref_code)
        .maybeSingle();
      if (seller) {
        seller_id = seller.id;
        referral_label = `${seller.name} (${seller.ref_code})`;
      }
    }
    if (!seller_id && ref_input) {
      const q = ref_input.trim();
      const { data: byCode } = await admin
        .from("sellers")
        .select("id, name, ref_code")
        .ilike("ref_code", q)
        .maybeSingle();
      if (byCode) {
        seller_id = byCode.id;
        referral_label = `${byCode.name} (${byCode.ref_code})`;
      } else {
        const { data: byName } = await admin
          .from("sellers")
          .select("id, name, ref_code")
          .ilike("name", q)
          .limit(2);
        if (byName && byName.length === 1) {
          seller_id = byName[0].id;
          referral_label = `${byName[0].name} (${byName[0].ref_code})`;
        }
      }
    }
    // Always preserve what the buyer typed when no seller match was found
    if (!referral_label && ref_input) {
      referral_label = ref_input.trim();
    }


    // Create buyer
    const { data: buyer, error: buyerErr } = await admin
      .from("buyers")
      .insert({ name: name.trim(), phone })
      .select("id")
      .single();

    if (buyerErr || !buyer) {
      console.log("[reserve-numbers] buyer error", buyerErr);
      return new Response(
        JSON.stringify({ error: "invalid_buyer", message: buyerErr?.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Create order (pending, expires in 10min)
    const expires_at = new Date(
      Date.now() + RESERVATION_MINUTES * 60 * 1000,
    ).toISOString();

    const { data: order, error: orderErr } = await admin
      .from("orders")
      .insert({
        buyer_id: buyer.id,
        seller_id,
        total_cents,
        status: "pending",
        expires_at,
      })
      .select("id, expires_at, total_cents")
      .single();

    if (orderErr || !order) {
      console.log("[reserve-numbers] order error", orderErr);
      throw new Error("Não foi possível criar o pedido");
    }

    // Reserve numbers atomically (locks + check + update + link)
    const { error: rpcErr } = await admin.rpc("reserve_numbers", {
      _order_id: order.id,
      _numbers: numbers,
    });

    if (rpcErr) {
      console.log("[reserve-numbers] reservation failed", rpcErr);
      // Rollback: cancel order so it doesn't pollute the dashboard
      await admin
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", order.id);

      return new Response(
        JSON.stringify({
          error: "numbers_unavailable",
          message: rpcErr.message,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("[reserve-numbers] order created", {
      order_id: order.id,
      numbers,
      seller_id,
    });

    return new Response(
      JSON.stringify({
        order_id: order.id,
        expires_at: order.expires_at,
        total_cents: order.total_cents,
        numbers,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.log("[reserve-numbers] unexpected error", message);
    return new Response(
      JSON.stringify({ error: "internal_error", message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
