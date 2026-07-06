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
  type HealthRun,
  type HealthStatus,
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
    } catch (e: unknown) {
      console.warn(e);
    }
  }, []);

  useEffect(() => { loadLatest(); }, [loadLatest]);

  const handleRun = async () => {
    setRunning(true);
    try {
      const result = await runHealthCheck({});
      setRun(result);
      await loadLatest();
      const msg = `Auditoria concluída: ${result.counts.ok}/${result.counts.total} OK`;
      if (result.overall === "ok") toast.success(msg);
      else if (result.overall === "warning") toast.warning(msg + ` (${result.counts.warnings} avisos)`);
      else toast.error(msg + ` (${result.counts.errors + result.counts.criticals} problemas)`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha na auditoria";
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  };

  const currentChecks = run?.checks ?? logs.map((l) => ({
    indicator: l.indicator as string,
    databaseValue: l.database_value as number | null,
    serviceValue: l.service_value as number | null,
    difference: l.difference as number | null,
    status: l.status as HealthStatus,
    details: l.details as Record<string, unknown> | null,
  }));

  const overall: HealthStatus = run?.overall
    ?? (latest?.criticals ? "critical" : latest?.errors ? "error" : latest?.warnings ? "warning" : latest ? "ok" : "na");

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
          <div className="text-xs text-muted-foreground">Última auditoria</div>
          <div className="text-sm mt-1">
            {latest ? new Date(latest.created_at).toLocaleString("pt-BR") : "—"}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Indicadores</div>
          <div className="text-lg font-semibold mt-1">{latest?.indicators ?? currentChecks.length ?? 0}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Erros / Warnings / Críticos</div>
          <div className="text-lg font-semibold mt-1 flex gap-2 items-center">
            <span className="text-red-600">{latest?.errors ?? run?.counts.errors ?? 0}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-amber-600">{latest?.warnings ?? run?.counts.warnings ?? 0}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-red-700">{latest?.criticals ?? run?.counts.criticals ?? 0}</span>
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

      <Card className="p-0 overflow-hidden">
        <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
          <div className="text-sm font-medium">Indicadores</div>
          <div className="text-xs text-muted-foreground">
            Run {latest?.run_id?.slice(0, 8) ?? run?.runId.slice(0, 8) ?? "—"}
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
            <tbody>
              {currentChecks.map((c) => {
                const isBRL = c.indicator.endsWith("_cents");
                const fmt = isBRL ? fmtBRL : fmtValue;
                return (
                  <tr key={c.indicator} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{c.indicator}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(c.databaseValue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt(c.serviceValue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {c.difference === null ? "—" : isBRL ? fmtBRL(c.difference) : fmtValue(c.difference)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={statusColor[c.status]}>
                        {c.status === "ok" && <ShieldCheck className="h-3 w-3 mr-1" />}
                        {c.status === "warning" && <AlertTriangle className="h-3 w-3 mr-1" />}
                        {(c.status === "error" || c.status === "critical") && <XCircle className="h-3 w-3 mr-1" />}
                        {c.status === "na" && <Info className="h-3 w-3 mr-1" />}
                        {c.status.toUpperCase()}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
              {currentChecks.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    Nenhuma auditoria executada ainda. Clique em "Executar auditoria".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default SystemHealthPanel;
