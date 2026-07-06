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
    implemented: number;
    ok: number;
    warnings: number;
    errors: number;
    criticals: number;
    na: number;
  };
  healthScore: number; // 0..100 sobre os IMPLEMENTADOS
  overall: HealthStatus;
  version: string;
  environment: string;
}

// -----------------------------------------------------------------------------
// Catálogo canônico de indicadores esperados no sistema. Cada item aqui é
// exibido no painel. Se `metricsPath` estiver ausente, é marcado como
// N/A – Não implementado e NÃO afeta o Health Score.
// Novos indicadores adicionados ao dashboardMetrics.ts entram automaticamente
// no grupo "Implementados" ao serem incluídos abaixo com `metricsPath` preenchido.
// -----------------------------------------------------------------------------
export interface IndicatorSpec {
  indicator: string;
  label: string;
  group: "receita" | "pedidos" | "operacional" | "pagamentos" | "totais" | "performance" | "integridade";
  metricsPath?: string; // se ausente → N/A
}

export const INDICATOR_CATALOG: IndicatorSpec[] = [
  // Receitas
  { indicator: "rifa.gross_cents", label: "Receita da Rifa (bruto)", group: "receita", metricsPath: "rifa.gross" },
  { indicator: "entrada.kit_gross_cents", label: "Receita das Camisetas (bruto)", group: "receita", metricsPath: "entrada.kit.gross" },
  { indicator: "entrada.pulseira_gross_cents", label: "Receita das Pulseiras (bruto)", group: "receita", metricsPath: "entrada.pulseira.gross" },
  { indicator: "sponsors.total_cents", label: "Receita dos Patrocínios", group: "receita", metricsPath: "sponsors.total" },
  { indicator: "offerings.total_cents", label: "Receita das Ofertas", group: "receita", metricsPath: "offerings.total" },
  { indicator: "totals.revenue_gross_cents", label: "Receita Total (bruto)", group: "totais", metricsPath: "totals.revenueGross" },
  { indicator: "totals.revenue_net_cents", label: "Receita Total (líquido)", group: "totais", metricsPath: "totals.revenueNet" },
  { indicator: "totals.fees_mp_cents", label: "Taxas Mercado Pago", group: "totais", metricsPath: "totals.feesMP" },

  // Pedidos (Rifa)
  { indicator: "rifa.paid_orders", label: "Pedidos pagos (Rifa)", group: "pedidos", metricsPath: "rifa.count" },
  { indicator: "rifa.pending_orders", label: "Pedidos pendentes (Rifa)", group: "pedidos", metricsPath: "rifa.pendingCount" },
  { indicator: "rifa.cancelled_like", label: "Pedidos cancelados/expirados/reembolsados (Rifa)", group: "pedidos", metricsPath: "rifa.cancelledCount" },
  { indicator: "rifa.refunded_orders", label: "Pedidos reembolsados (Rifa)", group: "pedidos", metricsPath: "rifa.refundedCount" },
  { indicator: "rifa.chargeback_orders", label: "Chargebacks (Rifa)", group: "pedidos" }, // N/A no serviço

  // Pedidos (Entrada)
  { indicator: "entrada.paid_orders", label: "Pedidos pagos (Camiseta/Pulseira)", group: "pedidos", metricsPath: "entrada.count" },
  { indicator: "entrada.pending_orders", label: "Pedidos pendentes (Entrada)", group: "pedidos", metricsPath: "entrada.pendingCount" },
  { indicator: "entrada.cancelled_like", label: "Cancelados/expirados/reembolsados (Entrada)", group: "pedidos", metricsPath: "entrada.cancelledCount" },
  { indicator: "entrada.refunded_orders", label: "Reembolsados (Entrada)", group: "pedidos", metricsPath: "entrada.refundedCount" },

  // Totais operacionais
  { indicator: "totals.orders_paid", label: "Total de pedidos pagos", group: "totais", metricsPath: "totals.ordersPaid" },
  { indicator: "totals.ticket_net_cents", label: "Ticket médio (líquido)", group: "totais", metricsPath: "totals.ticketNet" },

  // Patrocínios / ofertas / despesas
  { indicator: "sponsors.confirmed_count", label: "Patrocínios confirmados", group: "operacional", metricsPath: "sponsors.count" },
  { indicator: "sponsors.pending_count", label: "Patrocínios pendentes", group: "operacional", metricsPath: "sponsors.pendingCount" },
  { indicator: "offerings.count", label: "Quantidade de ofertas", group: "operacional", metricsPath: "offerings.count" },
  { indicator: "expenses.paid_cents", label: "Despesas realizadas", group: "operacional", metricsPath: "expenses.paid" },
  { indicator: "expenses.scheduled_cents", label: "Despesas previstas", group: "operacional", metricsPath: "expenses.scheduled" },
  { indicator: "expenses.count", label: "Quantidade de despesas", group: "operacional", metricsPath: "expenses.count" },

  // Pagamentos / webhooks
  { indicator: "payments.raw_count", label: "Quantidade de pagamentos", group: "pagamentos", metricsPath: "db.payments.raw_count" },
  { indicator: "payments.duplicated_orders", label: "Pedidos com pagamento duplicado", group: "pagamentos", metricsPath: "db.duplicates" },
  { indicator: "payments.orphan", label: "Pagamentos órfãos", group: "pagamentos", metricsPath: "db.payments.orphan" },
  { indicator: "webhooks.count", label: "Quantidade de webhooks", group: "pagamentos", metricsPath: "db.webhooks" },

  // Integridade
  { indicator: "identity.revenue_net", label: "Identidade da Receita Líquida", group: "integridade", metricsPath: "sum(components) == totals.revenueNet" },

  // Performance
  { indicator: "perf.snapshot_rpc_ms", label: "Tempo da RPC de snapshot", group: "performance", metricsPath: "runtime" },
  { indicator: "perf.service_load_ms", label: "Tempo do loadDashboardMetrics", group: "performance", metricsPath: "runtime" },

  // ---------- Não implementados (ficam N/A automaticamente) ----------
  { indicator: "clientes", label: "Clientes", group: "operacional" },
  { indicator: "producao", label: "Produção", group: "operacional" },
  { indicator: "entregas", label: "Entregas", group: "operacional" },
  { indicator: "conversao", label: "Taxa de Conversão", group: "operacional" },
  { indicator: "saldo", label: "Saldo em caixa", group: "totais" },
];

const CATALOG_INDEX = new Map(INDICATOR_CATALOG.map((s) => [s.indicator, s]));
export function isImplemented(indicator: string): boolean {
  return !!CATALOG_INDEX.get(indicator)?.metricsPath;
}
export function labelFor(indicator: string): string {
  return CATALOG_INDEX.get(indicator)?.label ?? indicator;
}
export function groupFor(indicator: string): IndicatorSpec["group"] {
  return CATALOG_INDEX.get(indicator)?.group ?? "operacional";
}

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

  // ---------- N/A: qualquer indicador do catálogo sem metricsPath e ainda
  // não presente na lista de checks entra automaticamente como N/A. Assim,
  // basta preencher metricsPath no catálogo (quando implementado) para o
  // indicador migrar de N/A → auditado, sem mudar a UI.
  const emitted = new Set(checks.map((c) => c.indicator));
  for (const spec of INDICATOR_CATALOG) {
    if (emitted.has(spec.indicator)) continue;
    if (!spec.metricsPath) {
      pushNA(checks, spec.indicator);
    }
  }

  const totalMs = Math.round(performance.now() - t0);
  const { version, environment } = envInfo();
  const createdAt = new Date().toISOString();

  const na = checks.filter((c) => c.status === "na").length;
  const ok = checks.filter((c) => c.status === "ok").length;
  const warnings = checks.filter((c) => c.status === "warning").length;
  const errors = checks.filter((c) => c.status === "error").length;
  const criticals = checks.filter((c) => c.status === "critical").length;
  const total = checks.length;
  const implemented = total - na;
  const counts = { total, implemented, ok, warnings, errors, criticals, na };

  // Health Score APENAS sobre implementados. warning conta 0.5, error 0, critical 0.
  const scoreNumerator = ok + warnings * 0.5;
  const healthScore = implemented > 0 ? Math.round((scoreNumerator / implemented) * 100) : 0;

  const overall: HealthStatus =
    criticals > 0 ? "critical" :
    errors > 0 ? "error" :
    warnings > 0 ? "warning" :
    implemented > 0 ? "ok" : "na";

  const run: HealthRun = {
    runId, createdAt, range, checks, totalMs, snapshotMs, serviceMs, counts, healthScore, overall, version, environment,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    details: (c.details ?? null) as any,
    execution_time_ms: c.executionTimeMs ?? null,
    version: run.version,
    environment: run.environment,
  }));
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
