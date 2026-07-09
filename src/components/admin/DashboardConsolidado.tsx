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
  Heart: _Heart,
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
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

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
const DEFAULT_COST_RIFA_PREMIO = 500;
const COST_STORAGE_KEY = "dashboard_costs_v1";

const fmtBRL = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;

interface RifaStatusStats {
  pending_orders: number;
  numbers_available: number;
  numbers_paid: number;
  numbers_reserved: number;
  sellers_count: number;
}

export function DashboardConsolidado({ rifaStatus, onNavigate }: { rifaStatus?: RifaStatusStats; onNavigate?: (tab: string) => void } = {}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [consistency, setConsistency] = useState<ConsistencyReport | null>(null);
  const [checkingConsistency, setCheckingConsistency] = useState(false);
  const [activeAlerts, setActiveAlerts] = useState<number | null>(null);
  const [hideValues, setHideValues] = useState<boolean>(() => {
    try { return localStorage.getItem("dashboard_hide_values") === "1"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("dashboard_hide_values", hideValues ? "1" : "0"); } catch { /* noop */ }
  }, [hideValues]);

  const [costCamiseta, setCostCamiseta] = useState<number>(() => {
    try { const s = JSON.parse(localStorage.getItem(COST_STORAGE_KEY) || "{}"); return Number(s.camiseta) || DEFAULT_COST_CAMISETA; } catch { return DEFAULT_COST_CAMISETA; }
  });
  const [costPulseira, setCostPulseira] = useState<number>(() => {
    try { const s = JSON.parse(localStorage.getItem(COST_STORAGE_KEY) || "{}"); return Number(s.pulseira) || DEFAULT_COST_PULSEIRA; } catch { return DEFAULT_COST_PULSEIRA; }
  });
  const [costRifaPremio, setCostRifaPremio] = useState<number>(() => {
    try { const s = JSON.parse(localStorage.getItem(COST_STORAGE_KEY) || "{}"); return Number(s.rifaPremio) || DEFAULT_COST_RIFA_PREMIO; } catch { return DEFAULT_COST_RIFA_PREMIO; }
  });
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(COST_STORAGE_KEY) || "{}");
      localStorage.setItem(COST_STORAGE_KEY, JSON.stringify({ ...s, camiseta: costCamiseta, pulseira: costPulseira, rifaPremio: costRifaPremio }));
    } catch {
      localStorage.setItem(COST_STORAGE_KEY, JSON.stringify({ camiseta: costCamiseta, pulseira: costPulseira, rifaPremio: costRifaPremio }));
    }
    // sync when other panels update the same key
    const handler = (e: StorageEvent) => {
      if (e.key !== COST_STORAGE_KEY || !e.newValue) return;
      try {
        const s = JSON.parse(e.newValue);
        if (typeof s.rifaPremio === "number") setCostRifaPremio(s.rifaPremio);
      } catch { /* noop */ }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [costCamiseta, costPulseira, costRifaPremio]);

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

  const loadActiveAlerts = useCallback(async () => {
    const { count } = await supabase
      .from("admin_alerts")
      .select("*", { count: "exact", head: true })
      .is("acknowledged_at", null);
    setActiveAlerts(count ?? 0);
  }, []);
  useEffect(() => { loadActiveAlerts(); }, [loadActiveAlerts]);

  // Derivados de UX (custo fabricação, lucro, margem) — não são "métricas de venda"
  const derived = useMemo(() => {
    if (!metrics) return null;
    const shirtCost = Math.round(metrics.entrada.kit.units * costCamiseta * 100);
    const pulseiraCost = Math.round(
      (metrics.entrada.kit.units + metrics.entrada.pulseira.units) * costPulseira * 100
    );
    const fabricationCost = shirtCost + pulseiraCost;
    const prizeCost = Math.round(costRifaPremio * 100);
    const totalExpenses = metrics.expenses.paid + fabricationCost + prizeCost + metrics.totals.feesMP;
    const revenueNet = metrics.totals.revenueNet;
    // revenueNet já é bruto − taxa MP; para "Gastos totais" separado somamos as
    // taxas explicitamente ⇒ lucro = bruto − (despesas + fabricação + prêmio + taxas)
    const netProfit = metrics.totals.revenueGross - totalExpenses;
    const margin = revenueNet > 0 ? (netProfit / revenueNet) * 100 : 0;
    return { shirtCost, pulseiraCost, fabricationCost, prizeCost, totalExpenses, netProfit, margin };
  }, [metrics, costCamiseta, costPulseira, costRifaPremio]);

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
        msg: `Despesas pendentes (agendadas): ${fmtBRL(metrics.expenses.scheduled)} — ainda não impactam o lucro realizado.`,
      });
    }
    if (metrics.sponsors.pendingCount > 0) {
      alerts.push({
        level: "warn",
        msg: `${metrics.sponsors.pendingCount} patrocínio(s) pendente(s) de confirmação${metrics.sponsors.pendingCash > 0 ? ` — ${fmtBRL(metrics.sponsors.pendingCash)} em dinheiro` : ""}.`,
      });
    }
    const pendingOrders = metrics.rifa.pendingCount + metrics.entrada.pendingCount;
    if (pendingOrders > 0) {
      const pendingGross = metrics.rifa.pendingGross + metrics.entrada.pendingGross;
      alerts.push({
        level: "warn",
        msg: `${pendingOrders} pedido(s) aguardando pagamento — ${fmtBRL(pendingGross)} em receita pendente.`,
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

  // Composições (usadas nos cards executivos)
  const revenueBreakdown = [
    { label: "Patrocínios", value: metrics.sponsors.total, tab: "sponsors" },
    { label: "Camisetas (kits)", value: metrics.entrada.kit.net, tab: "entrada" },
    { label: "Rifa", value: metrics.rifa.net, tab: "orders" },
    { label: "Ofertas", value: metrics.offerings.total, tab: "offerings" },
    { label: "Pulseiras", value: metrics.entrada.pulseira.net, tab: "entrada" },
  ];
  const expenseBreakdown = [
    { label: "Despesas gerais do evento", value: metrics.expenses.paid, tab: "expenses" },
    { label: "Custo de fabricação (camisetas + pulseiras)", value: derived.fabricationCost, tab: "entrada" },
    { label: "Taxas Mercado Pago (Rifa + Camisetas)", value: metrics.totals.feesMP },
    { label: "Custo do prêmio da Rifa", value: derived.prizeCost },
  ];
  const profitBreakdown = [
    { label: "Receita Líquida", value: metrics.totals.revenueNet, sign: "" as const },
    { label: "(−) Gastos Totais", value: derived.totalExpenses, sign: "-" as const },
    { label: "(=) Lucro Líquido", value: derived.netProfit, sign: "=" as const },
  ];

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
    { key: "sponsors", tab: "sponsors", label: "Patrocínios", icon: <Handshake className="h-3.5 w-3.5" />, value: metrics.sponsors.total, sub: `${metrics.sponsors.count} confirmado(s)` },
    { key: "rifa", tab: "orders", label: "Rifa", icon: <Ticket className="h-3.5 w-3.5" />, value: metrics.rifa.net, sub: `${metrics.rifa.count} ped. · bruto ${fmtBRL(metrics.rifa.gross)}` },
    { key: "kit", tab: "entrada", label: "Camisetas (kit)", icon: <Shirt className="h-3.5 w-3.5" />, value: metrics.entrada.kit.net, sub: `${metrics.entrada.kit.count} ped. · ${metrics.entrada.kit.units} un.` },
    { key: "pulseira", tab: "entrada", label: "Pulseiras", icon: <Shirt className="h-3.5 w-3.5" />, value: metrics.entrada.pulseira.net, sub: `${metrics.entrada.pulseira.count} ped. · ${metrics.entrada.pulseira.units} un.` },
    { key: "offerings", tab: "offerings", label: "Ofertas", icon: <Gift className="h-3.5 w-3.5" />, value: metrics.offerings.total, sub: `${metrics.offerings.count} oferta(s)` },
  ]
    .map((r) => ({ ...r, pct: (r.value / revenueBase) * 100 }))
    .sort((a, b) => b.value - a.value);

  // Barras da rifa (visual)
  const rifaBarBase = Math.max(1, metrics.rifa.count + metrics.rifa.pendingCount + metrics.rifa.cancelledCount + metrics.rifa.refundedCount);

  return (
    <div className={`space-y-8 dashboard-privacy ${hideValues ? "is-hidden" : ""}`}>
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
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={hideValues ? "default" : "outline"}
                    size="sm"
                    onClick={() => setHideValues((v) => !v)}
                    aria-label={hideValues ? "Mostrar valores" : "Ocultar valores"}
                    aria-pressed={hideValues}
                  >
                    {hideValues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    <span className="ml-1.5 hidden sm:inline text-xs">
                      {hideValues ? "Mostrar" : "Ocultar"}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  {hideValues ? "Clique para revelar os valores" : "Clique para ocultar valores (modo apresentação)"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button variant="outline" size="sm" onClick={() => { setFrom(""); setTo(""); }}>Limpar</Button>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
          </div>
        </div>
      </Card>

      {/* ============== EXECUTIVO ============== */}
      <Section title="Executivo" icon={<Activity className="h-3.5 w-3.5" />}>
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {/* Health Score movido para a aba "Saúde Técnica". */}
          <HeroKpi
            label="Receita Líquida"
            value={fmtBRL(metrics.totals.revenueNet)}
            tone="positive"
            icon={<Wallet className="h-4 w-4" />}
            subtitle={`bruto ${fmtBRL(metrics.totals.revenueGross)}`}
            help="Soma de todas as receitas confirmadas (rifa + camisetas + patrocínios + ofertas) menos as taxas do Mercado Pago."
            extra={metrics.rifa.pendingGross + metrics.entrada.pendingGross > 0
              ? `Receitas pendentes: ${fmtBRL(metrics.rifa.pendingGross + metrics.entrada.pendingGross)}`
              : undefined}
            breakdown={revenueBreakdown.map((b) => ({ label: b.label, value: fmtBRL(b.value) }))}
          />
          <HeroKpi
            label="Lucro Líquido"
            value={fmtBRL(derived.netProfit)}
            tone={profitTone}
            icon={derived.netProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            subtitle={`gastos ${fmtBRL(derived.totalExpenses)}`}
            help="Receita líquida menos gastos totais (despesas pagas + fabricação + taxas MP + prêmio da rifa)."
            breakdown={profitBreakdown.map((b) => ({ label: b.label, value: fmtBRL(b.value), emphasis: b.sign === "=" }))}
          />
          <HeroKpi
            label="Margem"
            value={`${derived.margin.toFixed(1)}%`}
            tone={marginTone}
            icon={<Percent className="h-4 w-4" />}
            subtitle={derived.margin >= 20 ? "Saudável" : derived.margin >= 0 ? "Abaixo do ideal" : "Negativa"}
            help="Lucro líquido dividido pela receita líquida. Meta interna: acima de 20%."
          />
          <HeroKpi
            label="Pedidos Pagos"
            value={String(metrics.rifa.count + metrics.entrada.count)}
            tone="info"
            icon={<ShoppingCart className="h-4 w-4" />}
            subtitle={`rifa ${metrics.rifa.count} · entrada ${metrics.entrada.count}`}
            help="Total de pedidos confirmados como pagos no período (rifa + camisetas)."
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
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{r.label}</p>
                      {onNavigate && (
                        <button
                          type="button"
                          onClick={() => onNavigate(r.tab)}
                          className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary hover:underline"
                        >
                          abrir <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
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
            help="Receita líquida menos despesas pagas e custo estimado de fabricação (camisetas e pulseiras)."
            highlight
          />
          <StatCard
            label="Receita Líquida"
            value={fmtBRL(metrics.totals.revenueNet)}
            tone="positive"
            icon={<Wallet className="h-3.5 w-3.5" />}
            help="Receita bruta confirmada menos as taxas do Mercado Pago (PIX 0,99% / Cartão 4,99%)."
            extra={metrics.rifa.pendingGross + metrics.entrada.pendingGross > 0
              ? `Receitas pendentes: ${fmtBRL(metrics.rifa.pendingGross + metrics.entrada.pendingGross)}`
              : undefined}
          />
          <StatCard
            label="Margem"
            value={`${derived.margin.toFixed(1)}%`}
            tone={marginTone}
            icon={<Percent className="h-3.5 w-3.5" />}
            help="Lucro líquido dividido pela receita líquida."
          />
          <StatCard
            label="Receita Bruta"
            value={fmtBRL(metrics.totals.revenueGross)}
            tone="neutral"
            icon={<DollarSign className="h-3.5 w-3.5" />}
            help="Soma de todos os valores confirmados antes de qualquer desconto de taxa."
          />
          <StatCard
            label="Gastos realizados"
            value={fmtBRL(derived.totalExpenses)}
            tone="negative"
            icon={<Receipt className="h-3.5 w-3.5" />}
            subtitle={`realizado + fabricação + taxas + prêmio`}
            help="Soma total dos gastos realizados. Despesas agendadas não entram."
            extra={metrics.expenses.scheduled > 0 ? `Despesas pendentes: ${fmtBRL(metrics.expenses.scheduled)}` : undefined}
            onOpen={onNavigate ? () => onNavigate("expenses") : undefined}
            openLabel="Abrir Gastos"
            breakdown={expenseBreakdown.map((b) => ({ label: b.label, value: fmtBRL(b.value) }))}
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

      {/* Validação de fórmulas e Última auditoria movidas para a aba "Saúde Técnica". */}

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

type BreakdownItem = { label: string; value: string; emphasis?: boolean };

function Breakdown({ items }: { items: BreakdownItem[] }) {
  if (!items?.length) return null;
  return (
    <ul className="mt-2 space-y-0.5 border-t border-border/40 pt-2">
      {items.map((b, i) => (
        <li
          key={i}
          className={`flex items-center justify-between gap-2 text-[11px] tabular-nums ${
            b.emphasis ? "font-semibold text-foreground pt-0.5" : "text-muted-foreground"
          }`}
        >
          <span className="truncate">{b.label}</span>
          <span className="shrink-0">{b.value}</span>
        </li>
      ))}
    </ul>
  );
}

function HeroKpi({
  label, value, unit, subtitle, tone = "neutral", icon, help, extra, breakdown,
}: { label: string; value: string; unit?: string; subtitle?: string; tone?: Tone; icon?: React.ReactNode; help?: string; extra?: string; breakdown?: BreakdownItem[] }) {
  return (
    <Card className={`p-4 min-h-[110px] flex flex-col justify-between transition-colors hover:border-primary/30 ${toneBorder[tone]}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium truncate">{label}</p>
          {help && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground/70 hover:text-foreground shrink-0">
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px] text-xs leading-snug">
                  {help}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
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
        {extra && <p className="mt-0.5 text-[11px] text-orange-600 dark:text-orange-400 truncate">{extra}</p>}
        {breakdown && <Breakdown items={breakdown} />}
      </div>
    </Card>
  );
}

function StatCard({
  label, value, highlight, tone = "neutral", subtitle, icon, help, extra, onOpen, openLabel, breakdown,
}: {
  label: string; value: string; highlight?: boolean;
  tone?: Tone; subtitle?: string; icon?: React.ReactNode;
  help?: string; extra?: string;
  onOpen?: () => void; openLabel?: string;
  breakdown?: BreakdownItem[];
}) {
  return (
    <Card className={`p-3 min-h-[92px] flex flex-col justify-between ${toneBorder[tone]} ${highlight ? "ring-1 ring-primary/30" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium truncate">{label}</p>
          {help && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground/70 hover:text-foreground shrink-0">
                    <Info className="h-3 w-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[240px] text-xs leading-snug">
                  {help}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        {icon && <span className={toneText[tone]}>{icon}</span>}
      </div>
      <div>
        <p className={`font-display font-bold tabular-nums ${highlight ? "text-2xl" : "text-xl"} ${toneText[tone]}`}>
          {value}
        </p>
        {subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{subtitle}</p>}
        {extra && <p className="mt-0.5 text-[11px] text-orange-600 dark:text-orange-400 truncate">{extra}</p>}
        {breakdown && <Breakdown items={breakdown} />}
        {onOpen && (
          <button
            type="button"
            onClick={onOpen}
            className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
          >
            {openLabel ?? "Abrir módulo"} <ArrowRight className="h-3 w-3" />
          </button>
        )}
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

export function AuditSummary({
  report, score, issues, activeAlerts,
}: {
  report: ConsistencyReport | null;
  score: number | null;
  issues: number;
  activeAlerts: number | null;
}) {
  const hasIssues = issues > 0;
  const generated = report?.generated_at ? new Date(report.generated_at).toLocaleString("pt-BR") : "—";
  const statusTone: Tone = hasIssues ? "warning" : "info";
  return (
    <Card className={`p-3 border ${hasIssues ? "border-orange-400/40 bg-orange-400/[0.04]" : "border-sky-500/25 bg-sky-500/[0.04]"}`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${hasIssues ? "bg-orange-500/15 text-orange-600 dark:text-orange-400" : "bg-sky-500/15 text-sky-600 dark:text-sky-400"}`}>
          {hasIssues ? <ShieldAlert className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold truncate">
              {report ? (hasIssues ? `${issues} divergência(s) detectada(s)` : "Sistema consistente") : "Verificando…"}
            </p>
            {score !== null && (
              <Badge variant="outline" className={`h-5 text-[10px] font-semibold ${toneText[statusTone]}`}>
                Health {score}/100
              </Badge>
            )}
            {activeAlerts !== null && activeAlerts > 0 && (
              <Badge variant="outline" className="h-5 text-[10px] font-semibold text-orange-600 dark:text-orange-400 border-orange-400/40">
                {activeAlerts} alerta(s) ativo(s)
              </Badge>
            )}
            {activeAlerts === 0 && (
              <Badge variant="outline" className="h-5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                Sem alertas ativos
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">Última auditoria: {generated}</p>
        </div>
      </div>
    </Card>
  );
}

export function FormulaChecks({
  metrics, fabricationCost, prizeCost, totalExpenses, netProfit,
}: {
  metrics: DashboardMetrics;
  fabricationCost: number;
  prizeCost: number;
  totalExpenses: number;
  netProfit: number;
}) {
  const rows = [
    {
      label: "Receita Bruta",
      formula: "Rifa + Camisetas + Pulseiras + Patrocínios + Ofertas",
      parts: [
        metrics.rifa.gross,
        metrics.entrada.kit.gross,
        metrics.entrada.pulseira.gross,
        metrics.sponsors.total,
        metrics.offerings.total,
      ],
      expected: metrics.totals.revenueGross,
    },
    {
      label: "Receita Líquida",
      formula: "Receita Bruta − Taxas Mercado Pago",
      parts: [metrics.totals.revenueGross, -metrics.totals.feesMP],
      expected: metrics.totals.revenueNet,
    },
    {
      label: "Gastos Totais",
      formula: "Despesas pagas + Fabricação + Taxas MP + Prêmio",
      parts: [metrics.expenses.paid, fabricationCost, metrics.totals.feesMP, prizeCost],
      expected: totalExpenses,
    },
    {
      label: "Lucro Líquido",
      formula: "Receita Bruta − Gastos Totais",
      parts: [metrics.totals.revenueGross, -totalExpenses],
      expected: netProfit,
    },
  ];
  return (
    <Card className="p-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Indicador</th>
              <th className="text-left px-3 py-2">Fórmula</th>
              <th className="text-right px-3 py-2">Soma dos módulos</th>
              <th className="text-right px-3 py-2">Valor no Dashboard</th>
              <th className="text-left px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const sum = r.parts.reduce((a, v) => a + v, 0);
              const diff = sum - r.expected;
              const ok = Math.abs(diff) <= 1; // tolerância de 1 centavo por arredondamento
              return (
                <tr key={r.label} className="border-t">
                  <td className="px-3 py-2 font-medium">{r.label}</td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">{r.formula}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(sum)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtBRL(r.expected)}</td>
                  <td className="px-3 py-2">
                    {ok ? (
                      <Badge variant="outline" className="h-5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> OK
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="h-5 text-[10px] font-semibold text-red-600 dark:text-red-400 border-red-500/40">
                        <AlertTriangle className="h-3 w-3 mr-1" /> Δ {fmtBRL(diff)}
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
