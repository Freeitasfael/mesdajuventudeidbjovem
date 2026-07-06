import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, ShieldCheck, AlertTriangle, XCircle, Info } from "lucide-react";
import { toast } from "sonner";
import {
  runHealthCheck,
  fetchLatestHealthRun,
  fetchHealthRunDetails,
  INDICATOR_CATALOG,
  labelFor,
  groupFor,
  type HealthRun,
  type HealthStatus,
  type IndicatorSpec,
} from "@/services/dashboardHealth";

interface LatestRunSummary {
  run_id: string;
  created_at: string;
  indicators: number;
  errors: number;
  warnings: number;
  criticals: number;
  total_ms: number;
  max_ms: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LogRow = any;

interface Row {
  indicator: string;
  databaseValue: number | null;
  serviceValue: number | null;
  difference: number | null;
  status: HealthStatus;
  details?: Record<string, unknown> | null;
}

const statusColor: Record<HealthStatus, string> = {
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  warning: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  error: "bg-red-500/15 text-red-700 dark:text-red-300",
  critical: "bg-red-600/20 text-red-800 dark:text-red-200 font-semibold",
  na: "bg-muted text-muted-foreground",
};

const overallLabel: Record<HealthStatus, string> = {
  ok: "🟢 Saudável",
  warning: "🟡 Atenção",
  error: "🟠 Erros",
  critical: "🔴 Crítico",
  na: "⚪ Sem dados",
};

const GROUP_LABEL: Record<IndicatorSpec["group"], string> = {
  receita: "Receitas",
  totais: "Totais consolidados",
  pedidos: "Pedidos",
  operacional: "Operacional",
  pagamentos: "Pagamentos & Webhooks",
  integridade: "Integridade",
  performance: "Performance",
};

const GROUP_ORDER: IndicatorSpec["group"][] = [
  "totais", "receita", "pedidos", "pagamentos", "operacional", "integridade", "performance",
];

function fmtValue(v: number | null | undefined) {
  if (v === null || v === undefined) return "—";
  return new Intl.NumberFormat("pt-BR").format(v);
}
function fmtBRL(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export const SystemHealthPanel = () => {
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<HealthRun | null>(null);
  const [latest, setLatest] = useState<LatestRunSummary | null>(null);
  const [logs, setLogs] = useState<LogRow[]>([]);

  const loadLatest = useCallback(async () => {
    try {
      const l = await fetchLatestHealthRun();
      setLatest(l as LatestRunSummary | null);
      if (l?.run_id) {
        const rows = await fetchHealthRunDetails(l.run_id);
        setLogs(rows);
      }
    } catch (e) { console.warn(e); }
  }, []);

  useEffect(() => { loadLatest(); }, [loadLatest]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const result = await runHealthCheck({ from: "", to: "" });
      setRun(result);
      await loadLatest();
      const msg = `Auditoria concluída: ${result.counts.ok}/${result.counts.implemented} OK (score ${result.healthScore})`;
      if (result.overall === "ok") toast.success(msg);
      else if (result.overall === "warning") toast.warning(msg + ` — ${result.counts.warnings} avisos`);
      else toast.error(msg + ` — ${result.counts.errors + result.counts.criticals} problemas`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Falha na auditoria";
      toast.error(msg);
    } finally { setRunning(false); }
  };

  // Sempre mostra o catálogo completo. Preenche com dados do run atual OU do
  // último run persistido; o que faltar vira N/A.
  const dataByIndicator = new Map<string, Row>();
  const source: Row[] = run
    ? run.checks
    : logs.map((l) => ({
        indicator: l.indicator,
        databaseValue: l.database_value,
        serviceValue: l.service_value,
        difference: l.difference,
        status: l.status,
        details: l.details,
      }));
  for (const c of source) dataByIndicator.set(c.indicator, c);

  const rows: Row[] = INDICATOR_CATALOG.map((spec) => {
    const found = dataByIndicator.get(spec.indicator);
    if (found) return found;
    return {
      indicator: spec.indicator,
      databaseValue: null,
      serviceValue: null,
      difference: null,
      status: "na",
      details: { reason: "not_implemented_yet" },
    };
  });

  const implemented = rows.filter((r) => r.status !== "na").length;
  const totalCatalog = rows.length;
  const okCount = rows.filter((r) => r.status === "ok").length;
  const warnCount = rows.filter((r) => r.status === "warning").length;
  const errCount = rows.filter((r) => r.status === "error").length;
  const critCount = rows.filter((r) => r.status === "critical").length;
  const naCount = rows.filter((r) => r.status === "na").length;
  const scoreNum = okCount + warnCount * 0.5;
  const healthScore = run?.healthScore ?? (implemented > 0 ? Math.round((scoreNum / implemented) * 100) : 0);

  const overall: HealthStatus =
    run?.overall
    ?? (critCount ? "critical"
      : errCount ? "error"
      : warnCount ? "warning"
      : implemented > 0 ? "ok" : "na");

  // Agrupar por grupo
  const grouped = new Map<IndicatorSpec["group"], Row[]>();
  for (const r of rows) {
    const g = groupFor(r.indicator);
    if (!grouped.has(g)) grouped.set(g, []);
    grouped.get(g)!.push(r);
  }

  const renderRow = (r: Row) => {
    const isBRL = r.indicator.endsWith("_cents");
    const fmt = isBRL ? fmtBRL : fmtValue;
    return (
      <tr key={r.indicator} className="border-t">
        <td className="px-3 py-2">
          <div className="text-sm">{labelFor(r.indicator)}</div>
          <div className="font-mono text-[11px] text-muted-foreground">{r.indicator}</div>
        </td>
        <td className="px-3 py-2 text-right tabular-nums">{fmt(r.databaseValue)}</td>
        <td className="px-3 py-2 text-right tabular-nums">{fmt(r.serviceValue)}</td>
        <td className="px-3 py-2 text-right tabular-nums">
          {r.difference === null ? "—" : isBRL ? fmtBRL(r.difference) : fmtValue(r.difference)}
        </td>
        <td className="px-3 py-2">
          <Badge className={statusColor[r.status]}>
            {r.status === "ok" && <ShieldCheck className="h-3 w-3 mr-1" />}
            {r.status === "warning" && <AlertTriangle className="h-3 w-3 mr-1" />}
            {(r.status === "error" || r.status === "critical") && <XCircle className="h-3 w-3 mr-1" />}
            {r.status === "na" && <Info className="h-3 w-3 mr-1" />}
            {r.status === "na" ? "N/A – Não implementado" : r.status.toUpperCase()}
          </Badge>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Saúde do Sistema
          </h2>
          <p className="text-sm text-muted-foreground">
            Compara valores diretos do banco com o serviço de métricas (dashboardMetrics.ts). Divergências geram alertas.
          </p>
        </div>
        <Button onClick={handleRun} disabled={running}>
          <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />
          {running ? "Auditando…" : "Executar auditoria"}
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Status geral</div>
          <div className="text-lg font-semibold mt-1">{overallLabel[overall]}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Health Score</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">
            {healthScore}<span className="text-sm text-muted-foreground">/100</span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            calculado sobre os {implemented} indicadores implementados
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Cobertura</div>
          <div className="text-lg font-semibold mt-1 tabular-nums">
            {implemented} de {totalCatalog} indicadores monitorados
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {naCount} pendentes de implementação
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Última auditoria</div>
          <div className="text-sm mt-1">
            {latest ? new Date(latest.created_at).toLocaleString("pt-BR") : "—"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 flex gap-2">
            <span className="text-emerald-600">{okCount} OK</span>
            <span className="text-amber-600">{warnCount} warn</span>
            <span className="text-red-600">{errCount} err</span>
            <span className="text-red-700">{critCount} crit</span>
          </div>
        </Card>
      </div>

      {run && (
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Tempo total</div>
            <div className="text-lg font-semibold">{run.totalMs} ms</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">RPC (banco)</div>
            <div className="text-lg font-semibold">{run.snapshotMs} ms</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">Serviço (loadDashboardMetrics)</div>
            <div className="text-lg font-semibold">{run.serviceMs} ms</div>
          </Card>
        </div>
      )}

      {/* Grupos por categoria */}
      {GROUP_ORDER.filter((g) => grouped.has(g)).map((g) => {
        const list = grouped.get(g)!;
        const gImpl = list.filter((r) => r.status !== "na").length;
        return (
          <Card key={g} className="p-0 overflow-hidden">
            <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
              <div className="text-sm font-medium">{GROUP_LABEL[g]}</div>
              <div className="text-xs text-muted-foreground">
                {gImpl}/{list.length} monitorados
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2">Indicador</th>
                    <th className="text-right px-3 py-2">Banco</th>
                    <th className="text-right px-3 py-2">Serviço</th>
                    <th className="text-right px-3 py-2">Δ</th>
                    <th className="text-left px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>{list.map(renderRow)}</tbody>
              </table>
            </div>
          </Card>
        );
      })}
    </div>
  );
};

export default SystemHealthPanel;
