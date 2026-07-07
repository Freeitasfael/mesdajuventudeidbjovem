import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  ShieldAlert,
  Heart,
  Wallet,
  Percent,
  ShoppingCart,
  DollarSign,
  Ticket,
  Shirt,
  Handshake,
  Gift,
  Receipt,
  Activity,
  ArrowDown,
} from "lucide-react";

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
  const [activeAlerts, setActiveAlerts] = useState<number | null>(null);

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

  // Health score derivado do relatório de consistência (visual apenas)
  const health = useMemo(() => {
    if (!consistency) return { score: null as number | null, issues: 0, status: "unknown" as const };
    const divs = consistency.divergences;
    const issues = Object.values(divs).filter(Boolean).length;
    const score = Math.max(0, 100 - issues * 20);
    const status = issues === 0 ? "ok" : issues <= 2 ? "warn" : "danger";
    return { score, issues, status };
  }, [consistency]);

  if (!metrics || !derived) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Carregando métricas…</div>
    );
  }

  const profitTone: Tone = derived.netProfit > 0 ? "positive" : derived.netProfit < 0 ? "negative" : "neutral";
  const marginTone: Tone = derived.margin >= 20 ? "positive" : derived.margin >= 0 ? "warning" : "negative";

  // % participação por categoria (visual apenas)
  const revenueBase = Math.max(
    1,
    metrics.rifa.net +
      metrics.entrada.kit.net +
      metrics.entrada.pulseira.net +
      metrics.sponsors.total +
      metrics.offerings.total,
  );
  const catRows = [
    { key: "sponsors", label: "Patrocínios", icon: <Handshake className="h-3.5 w-3.5" />, value: metrics.sponsors.total, sub: `${metrics.sponsors.count} confirmado(s)` },
    { key: "rifa", label: "Rifa", icon: <Ticket className="h-3.5 w-3.5" />, value: metrics.rifa.net, sub: `${metrics.rifa.count} ped. · bruto ${fmtBRL(metrics.rifa.gross)}` },
    { key: "kit", label: "Camisetas (kit)", icon: <Shirt className="h-3.5 w-3.5" />, value: metrics.entrada.kit.net, sub: `${metrics.entrada.kit.count} ped. · ${metrics.entrada.kit.units} un.` },
    { key: "pulseira", label: "Pulseiras", icon: <Shirt className="h-3.5 w-3.5" />, value: metrics.entrada.pulseira.net, sub: `${metrics.entrada.pulseira.count} ped. · ${metrics.entrada.pulseira.units} un.` },
    { key: "offerings", label: "Ofertas", icon: <Gift className="h-3.5 w-3.5" />, value: metrics.offerings.total, sub: `${metrics.offerings.count} oferta(s)` },
  ]
    .map((r) => ({ ...r, pct: (r.value / revenueBase) * 100 }))
    .sort((a, b) => b.value - a.value);

  // Barras da rifa (visual)
  const rifaBarBase = Math.max(1, metrics.rifa.count + metrics.rifa.pendingCount + metrics.rifa.cancelledCount + metrics.rifa.refundedCount);

  return (
    <div className="space-y-8">
      {/* Filtros */}
      <Card className="p-3 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:flex-wrap">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground" htmlFor="dashFrom">De</Label>
            <Input id="dashFrom" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-full sm:w-40" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground" htmlFor="dashTo">Até</Label>
            <Input id="dashTo" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-full sm:w-40" />
          </div>
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" size="sm" onClick={() => { setFrom(""); setTo(""); }}>Limpar</Button>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        </div>
      </Card>

      {/* ============== EXECUTIVO ============== */}
      <Section title="Executivo" icon={<Activity className="h-3.5 w-3.5" />}>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <HeroKpi
            label="Health Score"
            value={health.score !== null ? `${health.score}` : "—"}
            unit={health.score !== null ? "/100" : undefined}
            tone={health.status === "ok" ? "info" : health.status === "warn" ? "warning" : "negative"}
            icon={<Heart className="h-4 w-4" />}
            subtitle={health.issues === 0 ? "Sem divergências" : `${health.issues} divergência(s)`}
          />
          <HeroKpi
            label="Receita Líquida"
            value={fmtBRL(metrics.totals.revenueNet)}
            tone="positive"
            icon={<Wallet className="h-4 w-4" />}
            subtitle={`bruto ${fmtBRL(metrics.totals.revenueGross)}`}
          />
          <HeroKpi
            label="Lucro Líquido"
            value={fmtBRL(derived.netProfit)}
            tone={profitTone}
            icon={derived.netProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            subtitle={`gastos ${fmtBRL(derived.totalExpenses)}`}
          />
          <HeroKpi
            label="Margem"
            value={`${derived.margin.toFixed(1)}%`}
            tone={marginTone}
            icon={<Percent className="h-4 w-4" />}
            subtitle={derived.margin >= 20 ? "Saudável" : derived.margin >= 0 ? "Abaixo do ideal" : "Negativa"}
          />
          <HeroKpi
            label="Pedidos Pagos"
            value={String(metrics.rifa.count + metrics.entrada.count)}
            tone="info"
            icon={<ShoppingCart className="h-4 w-4" />}
            subtitle={`rifa ${metrics.rifa.count} · entrada ${metrics.entrada.count}`}
          />
        </div>
      </Section>

      {/* Alertas */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${
                a.level === "danger"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-orange-400/40 bg-orange-400/10 text-orange-700 dark:text-orange-300"
              }`}
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{a.msg}</span>
            </div>
          ))}
        </div>
      )}

      {/* ============== RECEITAS ============== */}
      <Section title="Receitas por categoria" icon={<DollarSign className="h-3.5 w-3.5" />}
        subtitle="Distribuição da receita líquida no período">
        <Card className="p-4">
          <div className="space-y-3">
            {catRows.map((r) => (
              <div key={r.key} className="grid grid-cols-12 items-center gap-3">
                <div className="col-span-12 sm:col-span-4 flex items-center gap-2 min-w-0">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 shrink-0">
                    {r.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.label}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{r.sub}</p>
                  </div>
                </div>
                <div className="col-span-8 sm:col-span-6">
                  <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500/80"
                      style={{ width: `${Math.min(100, r.pct).toFixed(1)}%` }}
                    />
                  </div>
                </div>
                <div className="col-span-4 sm:col-span-2 text-right">
                  <p className="text-sm font-semibold tabular-nums">{fmtBRL(r.value)}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">{r.pct.toFixed(1)}%</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </Section>

      {/* ============== FINANCEIRO ============== */}
      <Section title="Visão financeira" icon={<Wallet className="h-3.5 w-3.5" />}>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="Lucro Líquido"
            value={fmtBRL(derived.netProfit)}
            tone={profitTone}
            icon={derived.netProfit >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            highlight
          />
          <StatCard label="Receita Líquida" value={fmtBRL(metrics.totals.revenueNet)} tone="positive" icon={<Wallet className="h-3.5 w-3.5" />} />
          <StatCard label="Margem" value={`${derived.margin.toFixed(1)}%`} tone={marginTone} icon={<Percent className="h-3.5 w-3.5" />} />
          <StatCard label="Receita Bruta" value={fmtBRL(metrics.totals.revenueGross)} tone="neutral" icon={<DollarSign className="h-3.5 w-3.5" />} />
          <StatCard
            label="Gastos realizados"
            value={fmtBRL(derived.totalExpenses)}
            tone="negative"
            icon={<Receipt className="h-3.5 w-3.5" />}
            subtitle={`${fmtBRL(metrics.expenses.paid)} + ${fmtBRL(derived.fabricationCost)} fabricação`}
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          Taxa MP: {fmtBRL(metrics.totals.feesMP)} · Ticket líquido médio: {fmtBRL(metrics.totals.ticketNet)} · Despesas previstas: {fmtBRL(metrics.expenses.scheduled)}
        </p>
      </Section>

      {/* ============== OPERAÇÃO — Rifa ============== */}
      <Section title="Rifa — operação" icon={<Ticket className="h-3.5 w-3.5" />}>
        <div className="grid gap-3 lg:grid-cols-2">
          <Card className="p-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">Pedidos por status</p>
            <div className="space-y-2">
              <BarRow label="Pagos" value={metrics.rifa.count} base={rifaBarBase} tone="positive" />
              <BarRow label="Pendentes" value={metrics.rifa.pendingCount} base={rifaBarBase} tone="warning" sub={fmtBRL(metrics.rifa.pendingGross)} />
              <BarRow label="Cancelados" value={metrics.rifa.cancelledCount} base={rifaBarBase} tone="neutral" />
              <BarRow label="Reembolsados" value={metrics.rifa.refundedCount} base={rifaBarBase} tone="warning" />
            </div>
          </Card>
          {rifaStatus && (
            <Card className="p-4">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-3">Números</p>
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Disponíveis" value={String(rifaStatus.numbers_available)} />
                <MiniStat label="Pagos" value={String(rifaStatus.numbers_paid)} tone="positive" />
                <MiniStat label="Reservados" value={String(rifaStatus.numbers_reserved)} tone="warning" />
                <MiniStat label="Vendedores" value={String(rifaStatus.sellers_count)} />
              </div>
            </Card>
          )}
        </div>
      </Section>

      {/* ============== OPERAÇÃO — Camiseta + Pulseira (fluxo) ============== */}
      <Section title="Camiseta + Pulseira — fluxo financeiro" icon={<Shirt className="h-3.5 w-3.5" />}>
        <Card className="p-4">
          <div className="grid gap-3 sm:grid-cols-4 items-stretch">
            <FlowStep label="Receita Bruta" value={fmtBRL(metrics.entrada.gross)} tone="positive" />
            <FlowStep label="Taxa Mercado Pago" value={`− ${fmtBRL(metrics.entrada.fee)}`} tone="warning" />
            <FlowStep label="Receita Líquida" value={fmtBRL(metrics.entrada.net)} tone="positive" highlight />
            <FlowStep
              label="Pedidos Pagos"
              value={String(metrics.entrada.count)}
              tone="info"
              subtitle={`${metrics.entrada.pendingCount} pend. · ${metrics.entrada.refundedCount} reemb.`}
            />
          </div>
        </Card>
      </Section>

      {/* ============== PATROCÍNIOS ============== */}
      <Section title="Patrocínios — detalhe" icon={<Handshake className="h-3.5 w-3.5" />}>
        <Card className="p-4">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <MiniStat label="Confirmados" value={String(metrics.sponsors.count)} tone="positive" />
            <MiniStat label="Pendentes" value={String(metrics.sponsors.pendingCount)} tone="warning" />
            <MiniStat label="Em dinheiro" value={fmtBRL(metrics.sponsors.cash)} tone="positive" />
            <MiniStat label="Em permuta" value={fmtBRL(metrics.sponsors.permuta)} tone="neutral" />
          </div>
        </Card>
      </Section>

      {/* ============== RESUMO EXECUTIVO DA AUDITORIA ============== */}
      <Section title="Última auditoria" icon={<Heart className="h-3.5 w-3.5" />}
        subtitle="Resumo — detalhes técnicos na aba Saúde Técnica">
        <AuditSummary
          report={consistency}
          score={health.score}
          issues={health.issues}
        />
      </Section>
    </div>
  );
}

function Section({
  title, subtitle, icon, children,
}: { title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
          {icon}{title}
        </h2>
        {subtitle && <span className="text-[11px] text-muted-foreground">— {subtitle}</span>}
      </div>
      {children}
    </section>
  );
}

type Tone = "positive" | "negative" | "warning" | "neutral" | "info";

const toneText: Record<Tone, string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-red-600 dark:text-red-400",
  warning: "text-orange-600 dark:text-orange-400",
  info: "text-sky-600 dark:text-sky-400",
  neutral: "",
};
const toneBorder: Record<Tone, string> = {
  positive: "border-emerald-500/25 bg-emerald-500/[0.04]",
  negative: "border-red-500/25 bg-red-500/[0.04]",
  warning: "border-orange-500/25 bg-orange-500/[0.04]",
  info: "border-sky-500/25 bg-sky-500/[0.04]",
  neutral: "",
};
const toneBar: Record<Tone, string> = {
  positive: "bg-emerald-500/80",
  negative: "bg-red-500/80",
  warning: "bg-orange-500/80",
  info: "bg-sky-500/80",
  neutral: "bg-muted-foreground/40",
};

function HeroKpi({
  label, value, unit, subtitle, tone = "neutral", icon,
}: { label: string; value: string; unit?: string; subtitle?: string; tone?: Tone; icon?: React.ReactNode }) {
  return (
    <Card className={`p-4 min-h-[110px] flex flex-col justify-between transition-colors hover:border-primary/30 ${toneBorder[tone]}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
        <span className={`inline-flex h-6 w-6 items-center justify-center rounded-md bg-background/60 ${toneText[tone]}`}>
          {icon}
        </span>
      </div>
      <div>
        <p className={`font-display font-bold text-2xl lg:text-3xl leading-none tabular-nums ${toneText[tone]}`}>
          {value}
          {unit && <span className="text-sm font-medium text-muted-foreground ml-0.5">{unit}</span>}
        </p>
        {subtitle && <p className="mt-1 text-[11px] text-muted-foreground truncate">{subtitle}</p>}
      </div>
    </Card>
  );
}

function StatCard({
  label, value, highlight, tone = "neutral", subtitle, icon,
}: {
  label: string; value: string; highlight?: boolean;
  tone?: Tone; subtitle?: string; icon?: React.ReactNode;
}) {
  return (
    <Card className={`p-3 min-h-[92px] flex flex-col justify-between ${toneBorder[tone]} ${highlight ? "ring-1 ring-primary/30" : ""}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
        {icon && <span className={toneText[tone]}>{icon}</span>}
      </div>
      <div>
        <p className={`font-display font-bold tabular-nums ${highlight ? "text-2xl" : "text-xl"} ${toneText[tone]}`}>
          {value}
        </p>
        {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{subtitle}</p>}
      </div>
    </Card>
  );
}

function MiniStat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className={`rounded-lg border p-3 ${toneBorder[tone]}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display font-bold text-lg tabular-nums ${toneText[tone]}`}>{value}</p>
    </div>
  );
}

function BarRow({
  label, value, base, tone = "neutral", sub,
}: { label: string; value: number; base: number; tone?: Tone; sub?: string }) {
  const pct = Math.min(100, (value / base) * 100);
  return (
    <div className="grid grid-cols-12 items-center gap-3">
      <div className="col-span-4 sm:col-span-3">
        <p className="text-xs font-medium">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </div>
      <div className="col-span-6 sm:col-span-7">
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full ${toneBar[tone]}`} style={{ width: `${pct.toFixed(1)}%` }} />
        </div>
      </div>
      <div className="col-span-2 text-right">
        <p className={`text-sm font-semibold tabular-nums ${toneText[tone]}`}>{value}</p>
      </div>
    </div>
  );
}

function FlowStep({
  label, value, subtitle, tone = "neutral", highlight,
}: { label: string; value: string; subtitle?: string; tone?: Tone; highlight?: boolean }) {
  return (
    <div className="relative flex flex-col justify-between">
      <div className={`rounded-lg border p-3 h-full ${toneBorder[tone]} ${highlight ? "ring-1 ring-emerald-500/40" : ""}`}>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{label}</p>
        <p className={`mt-1 font-display font-bold text-lg tabular-nums ${toneText[tone]}`}>{value}</p>
        {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      {/* seta entre steps — visível apenas em telas maiores */}
      <ArrowDown className="hidden sm:block absolute -right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 rotate-[-90deg] sm:last:hidden" />
    </div>
  );
}

function ConsistencyCompact({
  report, loading, onRefresh, score, issues,
}: {
  report: ConsistencyReport | null;
  loading: boolean;
  onRefresh: () => void;
  score: number | null;
  issues: number;
}) {
  const hasIssues = issues > 0;
  const generated = report?.generated_at ? new Date(report.generated_at).toLocaleString("pt-BR") : "—";
  const statusTone: Tone = hasIssues ? "warning" : "info";

  return (
    <Card className={`p-3 border ${hasIssues ? "border-orange-400/40 bg-orange-400/[0.04]" : "border-sky-500/25 bg-sky-500/[0.04]"}`}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${hasIssues ? "bg-orange-500/15 text-orange-600 dark:text-orange-400" : "bg-sky-500/15 text-sky-600 dark:text-sky-400"}`}>
            {hasIssues ? <ShieldAlert className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold truncate">
                {report
                  ? hasIssues
                    ? `${issues} divergência(s) detectada(s)`
                    : "Sistema consistente"
                  : "Verificando…"}
              </p>
              {score !== null && (
                <Badge variant="outline" className={`h-5 text-[10px] font-semibold ${toneText[statusTone]}`}>
                  Health {score}/100
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              Última auditoria: {generated}
              {report && (
                <>
                  {" · "}Rifa {report.rifa.paid_orders} pagos / {report.rifa.refunded_orders} reemb.
                  {" · "}Entrada {report.entrada.paid_orders} pagos / {report.entrada.refunded_orders} reemb.
                </>
              )}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={`mr-2 h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Executar auditoria
        </Button>
      </div>

      {hasIssues && report && (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {report.divergences.numbers_vs_paid_orders && (
            <IssueLine text={`Números pagos ≠ vinculados (${report.rifa.numbers_status_paid} / ${report.rifa.numbers_linked_to_paid_orders})`} />
          )}
          {report.divergences.refunded_holding_numbers && (
            <IssueLine text={`${report.rifa.refunded_orders_still_holding_numbers} número(s) presos a pedidos reembolsados`} />
          )}
          {report.divergences.payments_status_mismatch && (
            <IssueLine text={`${report.rifa.payments_status_mismatch} pagamento(s) com status divergente`} />
          )}
          {report.divergences.payments_amount_mismatch && (
            <IssueLine text={`${report.rifa.payments_amount_mismatch} pagamento(s) com valor divergente`} />
          )}
        </ul>
      )}
    </Card>
  );
}

function IssueLine({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 rounded-md border border-orange-400/30 bg-orange-400/10 px-2 py-1.5 text-xs text-orange-800 dark:text-orange-300">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{text}</span>
    </li>
  );
}
