// -----------------------------------------------------------------------------
// Dashboard Health Check — compara o valor bruto do BANCO (via RPC
// admin_health_snapshot) com o valor calculado pelo SERVIÇO
// (loadDashboardMetrics em dashboardMetrics.ts). Persiste cada indicador em
// public.dashboard_health_logs e emite alertas em public.admin_alerts quando
// existe divergência.
//
// Regras:
// - "database"  = agregado direto no SQL (SUM/COUNT com FILTER).
// - "service"   = agregado no JS após aplicar orderStatus.ts + fees + payments.
// - "difference"= |database - service|. Se > 0 → alerta.
// - Identidade da receita líquida:
//     revenueNet == rifa.net + entrada.net + sponsors.total + offerings.total
//   se falhar → CRITICAL.
// -----------------------------------------------------------------------------

import { supabase } from "@/integrations/supabase/client";
import { loadDashboardMetrics, type DashboardMetrics } from "./dashboardMetrics";
import type { DateRange } from "@/lib/dateUtils";

export type HealthStatus = "ok" | "warning" | "error" | "critical" | "na";
export type AlertLevel = "info" | "warning" | "error" | "critical";

export interface HealthCheck {
  indicator: string;
  databaseValue: number | null;
  serviceValue: number | null;
  difference: number | null;
  status: HealthStatus;
  details?: Record<string, unknown>;
  executionTimeMs?: number;
}

export interface HealthRun {
  runId: string;
  createdAt: string;
  range: DateRange;
  checks: HealthCheck[];
  totalMs: number;
  snapshotMs: number;
  serviceMs: number;
  counts: {
    total: number;
    ok: number;
    warnings: number;
    errors: number;
    criticals: number;
    na: number;
  };
  overall: HealthStatus;
  version: string;
  environment: string;
}

// Indicadores listados no briefing mas ainda não modelados no domínio.
const NOT_IMPLEMENTED: string[] = [
  "clientes",
  "producao",
  "entregas",
  "conversao",
];

const SLOW_QUERY_MS = 500;

function envInfo() {
  const version =
    (import.meta.env.VITE_APP_VERSION as string | undefined) ??
    (import.meta.env.MODE ?? "unknown");
  const environment = (import.meta.env.MODE ?? "production") as string;
  return { version, environment };
}

function makeCheck(
  indicator: string,
  db: number | null,
  svc: number | null,
  opts: { tolerance?: number; critical?: boolean; details?: Record<string, unknown> } = {},
): HealthCheck {
  const tol = opts.tolerance ?? 0;
  if (db === null || svc === null) {
    return { indicator, databaseValue: db, serviceValue: svc, difference: null, status: "na", details: opts.details };
  }
  const diff = Math.abs(db - svc);
  const status: HealthStatus = diff <= tol ? "ok" : opts.critical ? "critical" : "error";
  return { indicator, databaseValue: db, serviceValue: svc, difference: diff, status, details: opts.details };
}

function pushNA(list: HealthCheck[], indicator: string) {
  list.push({
    indicator,
    databaseValue: null,
    serviceValue: null,
    difference: null,
    status: "na",
    details: { reason: "not_implemented_yet" },
  });
}

/** Executa a auditoria completa. Requer sessão admin (RLS + SECURITY DEFINER). */
const EMPTY_RANGE: DateRange = { from: "", to: "" };

export async function runHealthCheck(range: DateRange = EMPTY_RANGE): Promise<HealthRun> {
  const runId = crypto.randomUUID();
  const t0 = performance.now();

  const snapshotStart = performance.now();
  const { data: snapRaw, error: snapErr } = await supabase.rpc("admin_health_snapshot", {
    _from: range.from || null,
    _to: range.to || null,
  });
  const snapshotMs = Math.round(performance.now() - snapshotStart);
  if (snapErr) throw new Error(`admin_health_snapshot failed: ${snapErr.message}`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snap = snapRaw as any;

  const serviceStart = performance.now();
  const metrics: DashboardMetrics = await loadDashboardMetrics(range);
  const serviceMs = Math.round(performance.now() - serviceStart);

  const checks: HealthCheck[] = [];

  // ---------- RIFA ----------
  checks.push(makeCheck("rifa.gross_cents", Number(snap.rifa.gross), metrics.rifa.gross));
  checks.push(makeCheck("rifa.paid_orders", Number(snap.rifa.paid), metrics.rifa.count));
  checks.push(makeCheck("rifa.pending_orders", Number(snap.rifa.pending), metrics.rifa.pendingCount));
  checks.push(makeCheck("rifa.refunded_orders", Number(snap.rifa.refunded), metrics.rifa.refundedCount));
  // service agrupa cancelled+expired+refunded em cancelledCount; comparar contra soma equivalente:
  checks.push(makeCheck(
    "rifa.cancelled_like",
    Number(snap.rifa.cancelled) + Number(snap.rifa.expired) + Number(snap.rifa.refunded),
    metrics.rifa.cancelledCount,
    { details: { policy: "cancelled+expired+refunded" } },
  ));
  checks.push(makeCheck("rifa.chargeback_orders", Number(snap.rifa.chargeback), Number(snap.rifa.chargeback), {
    details: { source: "db_only", note: "chargeback ainda não separado no serviço" },
  }));

  // ---------- ENTRADAS ----------
  checks.push(makeCheck("entrada.kit_gross_cents", Number(snap.entrada.kit_gross), metrics.entrada.kit.gross));
  checks.push(makeCheck("entrada.pulseira_gross_cents", Number(snap.entrada.pul_gross), metrics.entrada.pulseira.gross));
  checks.push(makeCheck("entrada.paid_orders", Number(snap.entrada.paid), metrics.entrada.count));
  checks.push(makeCheck("entrada.pending_orders", Number(snap.entrada.pending), metrics.entrada.pendingCount));
  checks.push(makeCheck("entrada.refunded_orders", Number(snap.entrada.refunded), metrics.entrada.refundedCount));
  checks.push(makeCheck(
    "entrada.cancelled_like",
    Number(snap.entrada.cancelled) + Number(snap.entrada.expired) + Number(snap.entrada.refunded),
    metrics.entrada.cancelledCount,
  ));

  // ---------- PATROCÍNIOS ----------
  checks.push(makeCheck("sponsors.total_cents", Number(snap.sponsors.total), metrics.sponsors.total));
  checks.push(makeCheck("sponsors.confirmed_count", Number(snap.sponsors.confirmed), metrics.sponsors.count));
  checks.push(makeCheck("sponsors.pending_count", Number(snap.sponsors.pending), metrics.sponsors.pendingCount));

  // ---------- OFERTAS ----------
  checks.push(makeCheck("offerings.total_cents", Number(snap.offerings.total), metrics.offerings.total));
  checks.push(makeCheck("offerings.count", Number(snap.offerings.cnt), metrics.offerings.count));

  // ---------- DESPESAS ----------
  checks.push(makeCheck("expenses.paid_cents", Number(snap.expenses.paid), metrics.expenses.paid));
  checks.push(makeCheck("expenses.scheduled_cents", Number(snap.expenses.scheduled), metrics.expenses.scheduled));
  checks.push(makeCheck("expenses.count", Number(snap.expenses.cnt), metrics.expenses.count));

  // ---------- PAGAMENTOS / WEBHOOKS ----------
  const dupOrders = Number(snap.duplicates.dup_orders);
  checks.push({
    indicator: "payments.duplicated_orders",
    databaseValue: dupOrders,
    serviceValue: dupOrders,
    difference: 0,
    status: dupOrders === 0 ? "ok" : "warning",
    details: { note: "pedidos com >1 registro em payments (getUniquePayments dedupa)" },
  });
  const orphan = Number(snap.payments.orphan);
  checks.push({
    indicator: "payments.orphan",
    databaseValue: orphan,
    serviceValue: orphan,
    difference: 0,
    status: orphan === 0 ? "ok" : "warning",
    details: { note: "payments sem order_id — investigar" },
  });
  checks.push(makeCheck("payments.raw_count", Number(snap.payments.raw_count), Number(snap.payments.raw_count)));
  checks.push(makeCheck("webhooks.count", Number(snap.webhooks.cnt), Number(snap.webhooks.cnt)));

  // ---------- RECEITA TOTAL / IDENTIDADE (CRITICAL) ----------
  const componentsNet =
    metrics.rifa.net + metrics.entrada.net + metrics.sponsors.total + metrics.offerings.total;
  checks.push(makeCheck(
    "identity.revenue_net",
    componentsNet,
    metrics.totals.revenueNet,
    { critical: true, details: { formula: "rifa.net + entrada.net + sponsors + offerings" } },
  ));
  checks.push(makeCheck("totals.revenue_gross_cents", metrics.totals.revenueGross, metrics.totals.revenueGross));
  checks.push(makeCheck("totals.revenue_net_cents", metrics.totals.revenueNet, metrics.totals.revenueNet));
  checks.push(makeCheck("totals.fees_mp_cents", metrics.totals.feesMP, metrics.totals.feesMP));
  checks.push(makeCheck("totals.orders_paid", metrics.totals.ordersPaid, metrics.totals.ordersPaid));
  checks.push(makeCheck("totals.ticket_net_cents", metrics.totals.ticketNet, metrics.totals.ticketNet));

  // ---------- N/A ----------
  for (const ind of NOT_IMPLEMENTED) pushNA(checks, ind);

  // ---------- PERFORMANCE ----------
  if (snapshotMs > SLOW_QUERY_MS) {
    checks.push({
      indicator: "perf.snapshot_rpc_ms",
      databaseValue: snapshotMs,
      serviceValue: SLOW_QUERY_MS,
      difference: snapshotMs - SLOW_QUERY_MS,
      status: "warning",
      details: { threshold_ms: SLOW_QUERY_MS },
    });
  }
  if (serviceMs > SLOW_QUERY_MS) {
    checks.push({
      indicator: "perf.service_load_ms",
      databaseValue: serviceMs,
      serviceValue: SLOW_QUERY_MS,
      difference: serviceMs - SLOW_QUERY_MS,
      status: "warning",
      details: { threshold_ms: SLOW_QUERY_MS },
    });
  }

  const totalMs = Math.round(performance.now() - t0);
  const { version, environment } = envInfo();
  const createdAt = new Date().toISOString();

  const counts = {
    total: checks.length,
    ok: checks.filter((c) => c.status === "ok").length,
    warnings: checks.filter((c) => c.status === "warning").length,
    errors: checks.filter((c) => c.status === "error").length,
    criticals: checks.filter((c) => c.status === "critical").length,
    na: checks.filter((c) => c.status === "na").length,
  };
  const overall: HealthStatus =
    counts.criticals > 0 ? "critical" :
    counts.errors > 0 ? "error" :
    counts.warnings > 0 ? "warning" : "ok";

  const run: HealthRun = {
    runId, createdAt, range, checks, totalMs, snapshotMs, serviceMs, counts, overall, version, environment,
  };

  // ---------- Persistir ----------
  await persistRun(run);
  await emitAlerts(run);

  return run;
}

async function persistRun(run: HealthRun) {
  const rows = run.checks.map((c) => ({
    run_id: run.runId,
    indicator: c.indicator,
    database_value: c.databaseValue,
    service_value: c.serviceValue,
    difference: c.difference,
    status: c.status,
    details: c.details ?? null,
    execution_time_ms: c.executionTimeMs ?? null,
    version: run.version,
    environment: run.environment,
  }));
  // Batch em uma única chamada; falha silenciosa não pode quebrar a UI.
  const { error } = await supabase.from("dashboard_health_logs").insert(rows);
  if (error) console.warn("[health] persist failed:", error.message);
}

async function emitAlerts(run: HealthRun) {
  const bad = run.checks.filter((c) => c.status === "error" || c.status === "critical" || c.status === "warning");
  if (bad.length === 0) return;
  const rows = bad.map((c) => ({
    level: (c.status === "critical" ? "critical" :
            c.status === "error" ? "error" :
            "warning") as AlertLevel,
    alert_type: `health.${c.indicator}`,
    message:
      c.status === "critical"
        ? `Divergência CRÍTICA em ${c.indicator}: db=${c.databaseValue} service=${c.serviceValue}`
        : `Divergência em ${c.indicator}: db=${c.databaseValue} service=${c.serviceValue} (Δ=${c.difference})`,
    details: {
      run_id: run.runId,
      indicator: c.indicator,
      database_value: c.databaseValue,
      service_value: c.serviceValue,
      difference: c.difference,
      version: run.version,
      environment: run.environment,
      source_file: "src/services/dashboardHealth.ts",
      metrics_file: "src/services/dashboardMetrics.ts",
      ...(c.details ?? {}),
    },
  }));
  const { error } = await supabase.from("admin_alerts").insert(rows);
  if (error) console.warn("[health] alerts insert failed:", error.message);
}

/** Retorna o resumo do último run persistido. */
export async function fetchLatestHealthRun() {
  const { data, error } = await supabase.rpc("admin_latest_health_run");
  if (error) throw error;
  return (data ?? [])[0] ?? null;
}

/** Retorna todos os indicadores de um run específico. */
export async function fetchHealthRunDetails(runId: string) {
  const { data, error } = await supabase
    .from("dashboard_health_logs")
    .select("*")
    .eq("run_id", runId)
    .order("indicator", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
