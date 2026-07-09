import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Heart, ShieldAlert } from "lucide-react";
import { loadDashboardMetrics, type DashboardMetrics } from "@/services/dashboardMetrics";
import { AuditSummary, FormulaChecks } from "@/components/admin/DashboardConsolidado";

// Mesma chave usada pelo Dashboard para custos configuráveis.
const COST_STORAGE_KEY = "dashboard_costs_v1";
const DEFAULT_COST_CAMISETA = 38;
const DEFAULT_COST_PULSEIRA = 1.05;
const DEFAULT_COST_RIFA_PREMIO = 500;

interface ConsistencyReport {
  generated_at: string;
  divergences: Record<string, boolean>;
}

function readCosts() {
  try {
    const s = JSON.parse(localStorage.getItem(COST_STORAGE_KEY) || "{}");
    return {
      camiseta: Number(s.camiseta) || DEFAULT_COST_CAMISETA,
      pulseira: Number(s.pulseira) || DEFAULT_COST_PULSEIRA,
      rifaPremio: Number(s.rifaPremio) || DEFAULT_COST_RIFA_PREMIO,
    };
  } catch {
    return { camiseta: DEFAULT_COST_CAMISETA, pulseira: DEFAULT_COST_PULSEIRA, rifaPremio: DEFAULT_COST_RIFA_PREMIO };
  }
}

export function FinancialAudit() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [consistency, setConsistency] = useState<ConsistencyReport | null>(null);
  const [activeAlerts, setActiveAlerts] = useState<number | null>(null);
  const [costs, setCosts] = useState(readCosts);

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === COST_STORAGE_KEY) setCosts(readCosts());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const load = useCallback(async () => {
    const m = await loadDashboardMetrics({ from: "", to: "" });
    setMetrics(m);
  }, []);

  const runConsistency = useCallback(async () => {
    const { data } = await supabase.rpc("admin_dashboard_consistency_check" as never);
    if (data) setConsistency(data as unknown as ConsistencyReport);
  }, []);

  const loadAlerts = useCallback(async () => {
    const { count } = await supabase
      .from("admin_alerts")
      .select("*", { count: "exact", head: true })
      .is("acknowledged_at", null);
    setActiveAlerts(count ?? 0);
  }, []);

  useEffect(() => { load(); runConsistency(); loadAlerts(); }, [load, runConsistency, loadAlerts]);

  const health = useMemo(() => {
    if (!consistency) return { score: null as number | null, issues: 0 };
    const issues = Object.values(consistency.divergences ?? {}).filter(Boolean).length;
    return { score: Math.max(0, 100 - issues * 20), issues };
  }, [consistency]);

  const derived = useMemo(() => {
    if (!metrics) return null;
    const shirtCost = Math.round(metrics.entrada.kit.units * costs.camiseta * 100);
    const pulseiraCost = Math.round(
      (metrics.entrada.kit.units + metrics.entrada.pulseira.units) * costs.pulseira * 100,
    );
    const fabricationCost = shirtCost + pulseiraCost;
    const prizeCost = Math.round(costs.rifaPremio * 100);
    const totalExpenses = metrics.expenses.paid + fabricationCost + prizeCost + metrics.totals.feesMP;
    const netProfit = metrics.totals.revenueGross - totalExpenses;
    return { fabricationCost, prizeCost, totalExpenses, netProfit };
  }, [metrics, costs]);

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
          <Heart className="h-3.5 w-3.5" /> Última auditoria financeira
        </h3>
        <AuditSummary
          report={consistency as never}
          score={health.score}
          issues={health.issues}
          activeAlerts={activeAlerts}
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5" /> Validação de fórmulas
          </h3>
          <span className="text-[11px] text-muted-foreground">
            — Confere que os totais do Dashboard batem exatamente com a soma dos módulos
          </span>
        </div>
        {metrics && derived ? (
          <FormulaChecks
            metrics={metrics}
            fabricationCost={derived.fabricationCost}
            prizeCost={derived.prizeCost}
            totalExpenses={derived.totalExpenses}
            netProfit={derived.netProfit}
          />
        ) : (
          <Card className="p-4 text-sm text-muted-foreground">Carregando métricas financeiras…</Card>
        )}
      </section>
    </div>
  );
}

export default FinancialAudit;
