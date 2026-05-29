// entrada-status: retorna status do pedido da /entrada (para polling no front)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: "server_misconfig" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    let orderId = url.searchParams.get("order_id");
    if (!orderId && req.method !== "GET") {
      const body = await req.json().catch(() => null);
      orderId = body?.order_id ?? null;
    }
    if (!orderId) {
      return new Response(JSON.stringify({ error: "missing_order_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
    const { data, error } = await admin
      .from("entrada_orders")
      .select("id, status, expires_at, total_cents")
      .eq("id", orderId)
      .maybeSingle();

    if (error) {
      return new Response(JSON.stringify({ error: "db_error", message: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!data) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "internal_error", message: err instanceof Error ? err.message : "x" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
