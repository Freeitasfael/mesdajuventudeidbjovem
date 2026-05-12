// revalidate-payment: revalida UM pagamento específico contra o Mercado Pago.
// Usado pelo admin via botão "revalidar" na dashboard. Idempotente: se já estiver
// pago, apenas reporta. Reusa as mesmas regras de mapStatus/confirm_payment.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON = Deno.env.get("SUPABASE_ANON_KEY");
  const MP = Deno.env.get("MP_ACCESS_TOKEN");
  if (!SUPABASE_URL || !SERVICE_ROLE || !ANON) {
    return new Response(JSON.stringify({ error: "server_misconfig" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verifica se o usuário é admin via JWT da requisição
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const { data: roleRow } = await admin
    .from("user_roles").select("role").eq("user_id", userRes.user.id).eq("role", "admin").maybeSingle();
  if (!roleRow) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { order_id?: string; payment_id?: string } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  const { order_id, payment_id } = body;
  if (!order_id && !payment_id) {
    return new Response(JSON.stringify({ error: "missing_id" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Busca o pagamento alvo (mais recente do pedido se vier order_id)
  const q = admin.from("payments").select("id, order_id, provider_payment_id, status").limit(1);
  const { data: pay, error: payErr } = payment_id
    ? await q.eq("id", payment_id).maybeSingle()
    : await q.eq("order_id", order_id!).order("created_at", { ascending: false }).maybeSingle();

  if (payErr || !pay) {
    return new Response(JSON.stringify({ error: "payment_not_found" }), {
      status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!pay.provider_payment_id) {
    return new Response(JSON.stringify({ error: "no_provider_payment_id", payment: pay }), {
      status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!MP) {
    return new Response(JSON.stringify({ error: "mp_not_configured" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const log = (level: "info" | "warn" | "error", event_type: string, message: string, details?: unknown) => {
    console.log(JSON.stringify({ fn: "revalidate-payment", level, event_type, message,
      payment_id: pay.id, order_id: pay.order_id, provider_payment_id: pay.provider_payment_id, details }));
    admin.from("payment_events").insert({
      level, event_type, message,
      payment_id: pay.id, order_id: pay.order_id, provider_payment_id: pay.provider_payment_id,
      details: details ?? null,
    }).then(() => {}, () => {});
  };

  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${pay.provider_payment_id}`, {
    headers: { Authorization: `Bearer ${MP}` },
  });
  if (!mpRes.ok) {
    const txt = await mpRes.text().catch(() => "");
    log("error", "manual_revalidate_mp_failed", `MP HTTP ${mpRes.status}`, { http_status: mpRes.status, body: txt.slice(0, 300) });
    return new Response(JSON.stringify({ error: "mp_fetch_failed", http_status: mpRes.status }), {
      status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const mpData = await mpRes.json();
  const newStatus = mapStatus(mpData.status);

  await admin.from("payments").update({
    status: newStatus,
    raw: mpData,
    last_reconcile_at: new Date().toISOString(),
    next_reconcile_at: null,
    last_reconcile_error: null,
  }).eq("id", pay.id);

  let confirmed = false;
  if (newStatus === "approved" && pay.status !== "approved") {
    const { error: confErr } = await admin.rpc("confirm_payment", { _order_id: pay.order_id });
    if (confErr) {
      log("error", "manual_revalidate_confirm_failed", confErr.message);
      return new Response(JSON.stringify({ error: "confirm_failed", message: confErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    confirmed = true;
  }
  log("info", "manual_revalidate_done", `status=${newStatus}`, { mp_status: mpData.status, confirmed });

  return new Response(JSON.stringify({
    ok: true, payment_id: pay.id, order_id: pay.order_id,
    new_status: newStatus, mp_status: mpData.status, confirmed,
  }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
