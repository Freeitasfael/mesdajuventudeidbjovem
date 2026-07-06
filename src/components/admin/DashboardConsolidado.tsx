import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, TrendingUp, TrendingDown, CheckCircle2, ShieldAlert } from "lucide-react";

import {
  loadDashboardMetrics,
  type DashboardMetrics,
} from "@/services/dashboardMetrics";
import type { DateRange } from "@/lib/dateUtils";

interface ConsistencyReport {
  generated_at: string;
  rifa: {
    paid_orders: number;
    paid_revenue_cents: number;
    refunded_orders: number;
    refunded_revenue_cents: number;
    numbers_status_paid: number;
    numbers_linked_to_paid_orders: number;
    refunded_orders_still_holding_numbers: number;
    payments_status_mismatch: number;
    payments_amount_mismatch: number;
  };
  entrada: {
    paid_orders: number;
    paid_revenue_cents: number;
    refunded_orders: number;
    refunded_revenue_cents: number;
  };
  divergences: {
    numbers_vs_paid_orders: boolean;
    refunded_holding_numbers: boolean;
    payments_status_mismatch: boolean;
    payments_amount_mismatch: boolean;
  };
}

// Custos unitários de fabricação (R$)
const DEFAULT_COST_CAMISETA = 38;
const DEFAULT_COST_PULSEIRA = 1.05;
const COST_STORAGE_KEY = "dashboard_costs_v1";

const fmtBRL = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;

interface RifaStatusStats {
  pending_orders: number;
  numbers_available: number;
  numbers_paid: number;
  numbers_reserved: number;
  sellers_count: number;
}

export function DashboardConsolidado({ rifaStatus }: { rifaStatus?: RifaStatusStats } = {}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [consistency, setConsistency] = useState<ConsistencyReport | null>(null);
  const [checkingConsistency, setCheckingConsistency] = useState(false);

  const [costCamiseta, setCostCamiseta] = useState<number>(() => {
    try { const s = JSON.parse(localStorage.getItem(COST_STORAGE_KEY) || "{}"); return Number(s.camiseta) || DEFAULT_COST_CAMISETA; } catch { return DEFAULT_COST_CAMISETA; }
  });
  const [costPulseira, setCostPulseira] = useState<number>(() => {
    try { const s = JSON.parse(localStorage.getItem(COST_STORAGE_KEY) || "{}"); return Number(s.pulseira) || DEFAULT_COST_PULSEIRA; } catch { return DEFAULT_COST_PULSEIRA; }
  });
  useEffect(() => {
    localStorage.setItem(COST_STORAGE_KEY, JSON.stringify({ camiseta: costCamiseta, pulseira: costPulseira }));
  }, [costCamiseta, costPulseira]);

  const range = useMemo<DateRange>(() => ({ from, to }), [from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = await loadDashboardMetrics(range);
      setMetrics(m);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  const runConsistencyCheck = useCallback(async () => {
    setCheckingConsistency(true);
    const { data, error } = await supabase.rpc("admin_dashboard_consistency_check" as never);
    setCheckingConsistency(false);
    if (error) {
      console.error("consistency check failed", error);
      return;
    }
    setConsistency(data as unknown as ConsistencyReport);
  }, []);

  useEffect(() => {
    runConsistencyCheck();
    const iv = setInterval(runConsistencyCheck, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [runConsistencyCheck]);

  // Derivados de UX (custo fabricação, lucro, margem) — não são "métricas de venda"
  const derived = useMemo(() => {
    if (!metrics) return null;
    const shirtCost = Math.round(metrics.entrada.kit.units * costCamiseta * 100);
    const pulseiraCost = Math.round(
      (metrics.entrada.kit.units + metrics.entrada.pulseira.units) * costPulseira * 100
    );
    const fabricationCost = shirtCost + pulseiraCost;
    const totalExpenses = metrics.expenses.paid + fabricationCost;
    const revenueNet = metrics.totals.revenueNet;
    const netProfit = revenueNet - totalExpenses;
    const margin = revenueNet > 0 ? (netProfit / revenueNet) * 100 : 0;
    return { shirtCost, pulseiraCost, fabricationCost, totalExpenses, netProfit, margin };
  }, [metrics, costCamiseta, costPulseira]);

  // Alertas inteligentes
  const alerts: { level: "warn" | "danger"; msg: string }[] = [];
  if (metrics && derived) {
    if (metrics.totals.revenueNet > 0 && derived.margin < 20) {
      alerts.push({
        level: derived.margin < 0 ? "danger" : "warn",
        msg: `Margem ${derived.margin.toFixed(1)}% — abaixo do mínimo saudável (20%).`,
      });
    }
    if (metrics.sponsors.count === 0) {
      alerts.push({ level: "warn", msg: "Nenhum patrocinador confirmado no período." });
    }
    if (derived.totalExpenses > metrics.totals.revenueNet * 0.7 && metrics.totals.revenueNet > 0) {
      alerts.push({ level: "warn", msg: "Gastos representam mais de 70% da receita — atenção ao orçamento." });
    }
    if (metrics.expenses.scheduled > 0) {
      alerts.push({
        level: "warn",
        msg: `Despesas previstas (não pagas): ${fmtBRL(metrics.expenses.scheduled)} — não estão no lucro realizado.`,
      });
    }
  }

  if (!metrics || !derived) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Carregando métricas…</div>
    );
  }

  const profitTone = derived.netProfit > 0 ? "positive" : derived.netProfit < 0 ? "negative" : "neutral";
  const marginTone = derived.margin >= 20 ? "positive" : derived.margin >= 0 ? "warning" : "negative";

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="dashFrom">De</Label>
            <Input id="dashFrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full sm:w-44" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs" htmlFor="dashTo">Até</Label>
            <Input id="dashTo" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full sm:w-44" />
          </div>
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" size="sm" onClick={() => { setFrom(""); setTo(""); }}>Limpar</Button>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Fonte única de métricas — <code>src/services/dashboardMetrics.ts</code>. Todas as categorias respeitam o mesmo filtro de período (America/Sao_Paulo). Taxa MP descontada por método (PIX 0,99% · Cartão 4,99%). Reembolsados/expirados/cancelados nunca entram em receita.
        </p>
      </Card>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                a.level === "danger"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-amber-400/40 bg-amber-400/10 text-amber-700 dark:text-amber-300"
              }`}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{a.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* Verificação automática de consistência (pago vs reembolsado) */}
      <ConsistencyPanel
        report={consistency}
        loading={checkingConsistency}
        onRefresh={runConsistencyCheck}
      />

      {/* Visão estratégica — Receita Total por categoria (D2) */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Receita por categoria (líquida)</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Rifa" value={fmtBRL(metrics.rifa.net)} subtitle={`bruto ${fmtBRL(metrics.rifa.gross)} · ${metrics.rifa.count} ped.`} tone="positive" />
          <StatCard label="Camisetas (kit)" value={fmtBRL(metrics.entrada.kit.net)} subtitle={`bruto ${fmtBRL(metrics.entrada.kit.gross)} · ${metrics.entrada.kit.count} ped. · ${metrics.entrada.kit.units} un.`} tone="positive" />
          <StatCard label="Pulseiras" value={fmtBRL(metrics.entrada.pulseira.net)} subtitle={`bruto ${fmtBRL(metrics.entrada.pulseira.gross)} · ${metrics.entrada.pulseira.count} ped. · ${metrics.entrada.pulseira.units} un.`} tone="positive" />
          <StatCard label="Patrocínios" value={fmtBRL(metrics.sponsors.total)} subtitle={`${metrics.sponsors.count} confirmado(s)`} />
          <StatCard label="Ofertas" value={fmtBRL(metrics.offerings.total)} subtitle={`${metrics.offerings.count} oferta(s)`} tone="positive" />
        </div>
      </div>

      {/* Totais e lucro */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Visão financeira</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Receita Total (bruta)" value={fmtBRL(metrics.totals.revenueGross)} tone="neutral" />
          <StatCard label="Receita Total (líquida)" value={fmtBRL(metrics.totals.revenueNet)} highlight tone="positive" />
          <StatCard label="Gastos realizados" value={fmtBRL(derived.totalExpenses)} tone="negative" subtitle={`${fmtBRL(metrics.expenses.paid)} + ${fmtBRL(derived.fabricationCost)} fabricação`} />
          <StatCard
            label="Lucro Líquido"
            value={fmtBRL(derived.netProfit)}
            tone={profitTone}
            icon={derived.netProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          />
          <StatCard label="Margem" value={`${derived.margin.toFixed(1)}%`} tone={marginTone} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Taxa MP total: {fmtBRL(metrics.totals.feesMP)} · Ticket líquido médio (rifa+entrada): {fmtBRL(metrics.totals.ticketNet)} · Despesas previstas: {fmtBRL(metrics.expenses.scheduled)}
        </p>
      </div>

      {/* Detalhamento Rifa */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Rifa (detalhe)</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Pedidos pagos" value={String(metrics.rifa.count)} />
          <StatCard label="Pendentes" value={String(metrics.rifa.pendingCount)} subtitle={fmtBRL(metrics.rifa.pendingGross)} />
          <StatCard label="Reembolsados" value={String(metrics.rifa.refundedCount)} tone="warning" />
          <StatCard label="Cancelados (total)" value={String(metrics.rifa.cancelledCount)} />
          {rifaStatus && (
            <>
              <StatCard label="Números disponíveis" value={String(rifaStatus.numbers_available)} />
              <StatCard label="Números pagos" value={String(rifaStatus.numbers_paid)} />
              <StatCard label="Números reservados" value={String(rifaStatus.numbers_reserved)} />
              <StatCard label="Vendedores" value={String(rifaStatus.sellers_count)} />
            </>
          )}
        </div>
      </div>

      {/* Detalhamento Camiseta + Pulseira */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Camiseta + Pulseira (detalhe)</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Receita bruta" value={fmtBRL(metrics.entrada.gross)} tone="positive" />
          <StatCard label="Taxa MP" value={fmtBRL(metrics.entrada.fee)} tone="warning" />
          <StatCard label="Receita líquida" value={fmtBRL(metrics.entrada.net)} tone="positive" />
          <StatCard label="Pedidos pagos" value={String(metrics.entrada.count)} subtitle={`${metrics.entrada.pendingCount} pend. · ${metrics.entrada.refundedCount} reemb.`} />
        </div>
      </div>

      {/* Patrocínios resumo */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Patrocínios (detalhe)</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Em dinheiro (confirmado)" value={fmtBRL(metrics.sponsors.cash)} tone="positive" />
          <StatCard label="Em permuta (confirmado)" value={fmtBRL(metrics.sponsors.permuta)} />
          <StatCard label="Patrocinadores confirmados" value={String(metrics.sponsors.count)} subtitle={`${metrics.sponsors.pendingCount} pendente(s)`} />
        </div>
      </div>
    </div>
  );
}

type Tone = "positive" | "negative" | "warning" | "neutral";

function StatCard({
  label, value, highlight, tone = "neutral", subtitle, icon,
}: {
  label: string; value: string; highlight?: boolean;
  tone?: Tone; subtitle?: string; icon?: React.ReactNode;
}) {
  const toneClass: Record<Tone, string> = {
    positive: "text-emerald-600 dark:text-emerald-400",
    negative: "text-red-600 dark:text-red-400",
    warning: "text-amber-600 dark:text-amber-400",
    neutral: highlight ? "text-primary" : "",
  };
  const borderClass: Record<Tone, string> = {
    positive: "border-emerald-500/30 bg-emerald-500/5",
    negative: "border-red-500/30 bg-red-500/5",
    warning: "border-amber-500/30 bg-amber-500/5",
    neutral: highlight ? "border-primary/40 bg-primary/5" : "",
  };
  return (
    <Card className={`p-4 ${borderClass[tone]}`}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        {label}
      </p>
      <p className={`mt-1 font-bold ${highlight ? "text-3xl" : "text-2xl"} ${toneClass[tone]}`}>
        <span className="inline-flex items-center gap-1">
          {icon}
          {value}
        </span>
      </p>
      {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
    </Card>
  );
}

function ConsistencyPanel({
  report, loading, onRefresh,
}: {
  report: ConsistencyReport | null;
  loading: boolean;
  onRefresh: () => void;
}) {
  const divs = report?.divergences;
  const issues: { key: string; label: string; detail: string }[] = [];
  if (report && divs) {
    if (divs.numbers_vs_paid_orders) {
      issues.push({
        key: "numbers_vs_paid_orders",
        label: "Números pagos ≠ números em pedidos pagos",
        detail: `Rifa: ${report.rifa.numbers_status_paid} número(s) marcados como pagos, mas ${report.rifa.numbers_linked_to_paid_orders} estão vinculados a pedidos pagos.`,
      });
    }
    if (divs.refunded_holding_numbers) {
      issues.push({
        key: "refunded_holding_numbers",
        label: "Pedidos reembolsados ainda seguram números",
        detail: `${report.rifa.refunded_orders_still_holding_numbers} número(s) presos a pedidos com status 'refunded'.`,
      });
    }
    if (divs.payments_status_mismatch) {
      issues.push({
        key: "payments_status_mismatch",
        label: "Status do pagamento não bate com o do pedido",
        detail: `${report.rifa.payments_status_mismatch} pedido(s) com status divergente no último pagamento.`,
      });
    }
    if (divs.payments_amount_mismatch) {
      issues.push({
        key: "payments_amount_mismatch",
        label: "Valor do pagamento diverge do pedido",
        detail: `${report.rifa.payments_amount_mismatch} pedido(s) com valor cobrado diferente do total do pedido.`,
      });
    }
  }

  const hasIssues = issues.length > 0;
  const generated = report?.generated_at ? new Date(report.generated_at).toLocaleString("pt-BR") : "—";

  return (
    <Card className={`p-4 border ${hasIssues ? "border-amber-400/50 bg-amber-400/5" : "border-emerald-500/40 bg-emerald-500/5"}`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2">
          {hasIssues ? (
            <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          )}
          <div>
            <h3 className="font-semibold text-sm">
              {report
                ? hasIssues
                  ? `${issues.length} divergência(s) detectada(s)`
                  : "Tudo consistente entre Pago × Reembolsado"
                : "Verificando consistência…"}
            </h3>
            <p className="text-xs text-muted-foreground">
              Última verificação: {generated} · atualizada a cada 5 min automaticamente.
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`mr-2 h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Verificar agora
        </Button>
      </div>

      {report && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-border bg-background/60 p-3 text-xs">
            <p className="font-semibold uppercase tracking-wide text-muted-foreground mb-2">Rifa</p>
            <div className="grid grid-cols-2 gap-y-1">
              <span>Pagos</span><span className="text-right font-medium">{report.rifa.paid_orders} · {fmtBRL(report.rifa.paid_revenue_cents)}</span>
              <span>Reembolsados</span><span className="text-right font-medium text-amber-700 dark:text-amber-400">{report.rifa.refunded_orders} · {fmtBRL(report.rifa.refunded_revenue_cents)}</span>
              <span>Nºs pagos</span><span className="text-right">{report.rifa.numbers_status_paid} / {report.rifa.numbers_linked_to_paid_orders}</span>
            </div>
          </div>
          <div className="rounded-md border border-border bg-background/60 p-3 text-xs">
            <p className="font-semibold uppercase tracking-wide text-muted-foreground mb-2">Camiseta + Pulseira</p>
            <div className="grid grid-cols-2 gap-y-1">
              <span>Pagos</span><span className="text-right font-medium">{report.entrada.paid_orders} · {fmtBRL(report.entrada.paid_revenue_cents)}</span>
              <span>Reembolsados</span><span className="text-right font-medium text-amber-700 dark:text-amber-400">{report.entrada.refunded_orders} · {fmtBRL(report.entrada.refunded_revenue_cents)}</span>
            </div>
          </div>
        </div>
      )}

      {hasIssues && (
        <ul className="mt-4 space-y-2">
          {issues.map((it) => (
            <li key={it.key} className="flex items-start gap-2 rounded-md border border-amber-400/40 bg-amber-400/10 p-2 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div>
                <p className="font-medium text-amber-800 dark:text-amber-300">{it.label}</p>
                <p className="text-xs text-amber-700/90 dark:text-amber-400/90">{it.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
