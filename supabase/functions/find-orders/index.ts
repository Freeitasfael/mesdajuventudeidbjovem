// find-orders: busca pública dos pedidos de um comprador pelo telefone.
// Retorna no máximo 10 pedidos mais recentes com status e números.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  phone: z.string().regex(/^\d{10,11}$/, "Telefone inválido"),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) throw new Error("server_misconfig");

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error: "invalid_input",
          message: "Informe um telefone válido (10 ou 11 dígitos).",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { phone } = parsed.data;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false },
    });

    const { data: buyers } = await admin
      .from("buyers")
      .select("id, name")
      .eq("phone", phone);

    if (!buyers || buyers.length === 0) {
      return new Response(JSON.stringify({ orders: [] }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const buyerIds = buyers.map((b) => b.id);

    const { data: orders } = await admin
      .from("orders")
      .select("id, status, total_cents, expires_at, created_at, buyer_id, referral_label")
      .in("buyer_id", buyerIds)
      .order("created_at", { ascending: false })
      .limit(10);

    const orderIds = (orders ?? []).map((o) => o.id);
    const { data: onums } = orderIds.length
      ? await admin
          .from("order_numbers")
          .select("order_id, number")
          .in("order_id", orderIds)
      : { data: [] as { order_id: string; number: number }[] };

    const numsByOrder = new Map<string, number[]>();
    for (const r of onums ?? []) {
      const arr = numsByOrder.get(r.order_id) ?? [];
      arr.push(r.number);
      numsByOrder.set(r.order_id, arr);
    }

    const buyerNameById = new Map(buyers.map((b) => [b.id, b.name]));

    const result = (orders ?? []).map((o) => ({
      id: o.id,
      status: o.status,
      total_cents: o.total_cents,
      expires_at: o.expires_at,
      created_at: o.created_at,
      buyer_name: buyerNameById.get(o.buyer_id) ?? null,
      referral_label: o.referral_label ?? null,
      numbers: (numsByOrder.get(o.id) ?? []).sort((a, b) => a - b),
    }));

    return new Response(JSON.stringify({ orders: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.log("[find-orders] unexpected", message);
    return new Response(
      JSON.stringify({ error: "internal_error", message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
