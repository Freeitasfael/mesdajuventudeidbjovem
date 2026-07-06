// GET /admin/system/health — endpoint público interno para cron/monitores
// externos. Executa o mesmo snapshot que o painel de admin usa e devolve
// o resumo do último run persistido em dashboard_health_logs.
//
// Autenticação: aceita header `x-cron-secret` (para agendamentos internos
// do pg_cron) OU JWT de usuário admin. Nunca expõe dados sensíveis.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Autorização: cron secret OU admin logado.
  const cronSecret = req.headers.get("x-cron-secret");
  const authHeader = req.headers.get("authorization");
  const isCron = cronSecret && cronSecret === Deno.env.get("SUPABASE_ANON_KEY");
  let isAdmin = false;
  if (!isCron && authHeader?.startsWith("Bearer ")) {
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await userClient.auth.getClaims(token);
    const uid = claims?.claims?.sub as string | undefined;
    if (uid) {
      const { data: role } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", uid)
        .eq("role", "admin")
        .maybeSingle();
      isAdmin = !!role;
    }
  }
  if (!isCron && !isAdmin) return json({ error: "unauthorized" }, 401);

  const t0 = Date.now();

  // Snapshot bruto direto do banco (mesma fonte "database" do painel).
  const { data: snap, error: snapErr } = await admin.rpc("admin_health_snapshot", {
    _from: null, _to: null,
  });
  const snapshotMs = Date.now() - t0;
  if (snapErr) return json({ error: snapErr.message }, 500);

  // Última execução persistida
  const { data: latestRows } = await admin
    .from("dashboard_health_logs")
    .select("run_id, created_at, status, execution_time_ms")
    .order("created_at", { ascending: false })
    .limit(500);

  const latestRunId = latestRows?.[0]?.run_id ?? null;
  const latestRun = latestRows?.filter((r) => r.run_id === latestRunId) ?? [];
  const summary = {
    run_id: latestRunId,
    last_run_at: latestRunId ? latestRun[latestRun.length - 1]?.created_at : null,
    indicators: latestRun.length,
    ok: latestRun.filter((r) => r.status === "ok").length,
    warnings: latestRun.filter((r) => r.status === "warning").length,
    errors: latestRun.filter((r) => r.status === "error").length,
    criticals: latestRun.filter((r) => r.status === "critical").length,
    na: latestRun.filter((r) => r.status === "na").length,
    max_ms: latestRun.reduce((a, r) => Math.max(a, r.execution_time_ms ?? 0), 0),
    total_ms: latestRun.reduce((a, r) => a + (r.execution_time_ms ?? 0), 0),
  };

  const overall =
    summary.criticals > 0 ? "critical" :
    summary.errors > 0 ? "error" :
    summary.warnings > 0 ? "warning" :
    latestRunId ? "ok" : "na";

  // Contagem de alertas ativos (não reconhecidos)
  const { count: activeAlerts } = await admin
    .from("admin_alerts")
    .select("*", { count: "exact", head: true })
    .is("acknowledged_at", null);

  return json({
    status: overall,
    generated_at: new Date().toISOString(),
    snapshot_ms: snapshotMs,
    version: Deno.env.get("APP_VERSION") ?? "unknown",
    environment: Deno.env.get("SUPABASE_ENV") ?? "production",
    latest: summary,
    snapshot: snap,
    active_alerts: activeAlerts ?? 0,
  });
});
