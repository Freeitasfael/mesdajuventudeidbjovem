import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { netFromOrders } from "@/lib/fees";

interface OrderLite { total_cents: number; created_at: string; status: string; payment_method: string | null; }
interface EntradaLite { total_cents: number; created_at: string; status: string; product: string; quantity: number; payment_method: string | null; }
interface ExpenseLite { amount_cents: number; expense_date: string; category: string; }
interface SponsorLite { amount_cents: number; kind: "cash" | "permuta"; status: "confirmed" | "pending"; created_at: string; }
interface OfferingLite { amount_cents: number; offering_date: string; payment_method: string; }

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
  const [camisetasOrders, setCamisetasOrders] = useState<OrderLite[]>([]);
  const [entrada, setEntrada] = useState<EntradaLite[]>([]);
  const [expenses, setExpenses] = useState<ExpenseLite[]>([]);
  const [sponsors, setSponsors] = useState<SponsorLite[]>([]);
  const [offerings, setOfferings] = useState<OfferingLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [costCamiseta, setCostCamiseta] = useState<number>(() => {
    try { const s = JSON.parse(localStorage.getItem(COST_STORAGE_KEY) || "{}"); return Number(s.camiseta) || DEFAULT_COST_CAMISETA; } catch { return DEFAULT_COST_CAMISETA; }
  });
  const [costPulseira, setCostPulseira] = useState<number>(() => {
    try { const s = JSON.parse(localStorage.getItem(COST_STORAGE_KEY) || "{}"); return Number(s.pulseira) || DEFAULT_COST_PULSEIRA; } catch { return DEFAULT_COST_PULSEIRA; }
  });
  useEffect(() => {
    localStorage.setItem(COST_STORAGE_KEY, JSON.stringify({ camiseta: costCamiseta, pulseira: costPulseira }));
  }, [costCamiseta, costPulseira]);

  const load = async () => {
    setLoading(true);
    let camisetasQ = supabase.from("orders").select("total_cents, created_at, status, payment_method").eq("status", "paid").limit(5000);
    let entQ = supabase.from("entrada_orders").select("total_cents, created_at, status, product, quantity, payment_method").limit(5000);
    let expQ = supabase.from("expenses").select("amount_cents, expense_date, category").limit(5000);
    const sponsorsQ = supabase.from("sponsorships").select("amount_cents, kind, status, created_at").limit(5000);
    let offeringsQ = supabase.from("offerings").select("amount_cents, offering_date, payment_method").limit(5000);

    if (from) {
      const f = new Date(from + "T00:00:00").toISOString();
      camisetasQ = camisetasQ.gte("created_at", f);
      entQ = entQ.gte("created_at", f);
      expQ = expQ.gte("expense_date", from);
      offeringsQ = offeringsQ.gte("offering_date", from);
    }
    if (to) {
      const t = new Date(to + "T23:59:59").toISOString();
      camisetasQ = camisetasQ.lte("created_at", t);
      entQ = entQ.lte("created_at", t);
      expQ = expQ.lte("expense_date", to);
      offeringsQ = offeringsQ.lte("offering_date", to);
    }
    const [r, e, x, s, o] = await Promise.all([camisetasQ, entQ, expQ, sponsorsQ, offeringsQ]);
    if (r.data) setCamisetasOrders(r.data as OrderLite[]);
    if (e.data) setEntrada(e.data as EntradaLite[]);
    if (x.data) setExpenses(x.data as ExpenseLite[]);
    if (s.data) setSponsors(s.data as SponsorLite[]);
    if (o.data) setOfferings(o.data as OfferingLite[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to]);

  const metrics = useMemo(() => {
    const camisetasAgg = netFromOrders(camisetasOrders);
    const camisetasGross = camisetasAgg.gross;
    const camisetasTotal = camisetasAgg.net;
    const camisetasCount = camisetasOrders.length;

    // Entrada: separar por produto (camiseta = kit) e (pulseira)
    const kitOrders = entrada.filter((e) => e.product === "kit");
    const pulOrders = entrada.filter((e) => e.product === "pulseira");

    // ---- CAMISETA (kit) ----
    const kitPaid = kitOrders.filter((e) => e.status === "paid");
    const kitPending = kitOrders.filter((e) => e.status === "pending");
    const kitCanceled = kitOrders.filter((e) => e.status === "canceled" || e.status === "cancelled" || e.status === "rejected");
    const kitAgg = netFromOrders(kitPaid);
    const kitGross = kitAgg.gross;
    const kitFee = kitAgg.fee;
    const kitNet = kitAgg.net;
    const kitPendingGross = kitPending.reduce((a, o) => a + o.total_cents, 0);
    const kitUnits = kitPaid.reduce((a, o) => a + (o.quantity || 1), 0);
    const shirtCost = Math.round(kitUnits * costCamiseta * 100);
    const shirtProfit = kitGross - shirtCost - kitFee;

    // ---- PULSEIRA ----
    const pulPaid = pulOrders.filter((e) => e.status === "paid");
    const pulPending = pulOrders.filter((e) => e.status === "pending");
    const pulCanceled = pulOrders.filter((e) => e.status === "canceled" || e.status === "cancelled" || e.status === "rejected");
    const pulAgg = netFromOrders(pulPaid);
    const pulGross = pulAgg.gross;
    const pulFee = pulAgg.fee;
    const pulNet = pulAgg.net;
    const pulUnits = pulPaid.reduce((a, o) => a + (o.quantity || 1), 0);

    // ---- TOTAIS (camiseta + pulseira) ----
    const entGross = kitGross + pulGross;
    const entFee = kitFee + pulFee;
    const entTotal = kitNet + pulNet;
    const entCount = kitPaid.length + pulPaid.length;
    const entPendingCount = kitPending.length + pulPending.length;
    const entCanceledCount = kitCanceled.length + pulCanceled.length;
    const entPendingGross = kitPendingGross + pulPending.reduce((a, o) => a + o.total_cents, 0);

    // Patrocínios (apenas confirmados em dinheiro contam para receita)
    const sponsorsConfirmedCash = sponsors
      .filter((s) => s.status === "confirmed" && s.kind === "cash")
      .reduce((a, s) => a + s.amount_cents, 0);
    const sponsorsConfirmedPermuta = sponsors
      .filter((s) => s.status === "confirmed" && s.kind === "permuta")
      .reduce((a, s) => a + s.amount_cents, 0);
    const sponsorsConfirmedTotal = sponsorsConfirmedCash + sponsorsConfirmedPermuta;
    const sponsorsCount = sponsors.filter((s) => s.status === "confirmed").length;

    // Gastos
    const expensesTotal = expenses.reduce((a, e) => a + e.amount_cents, 0);
    const fabricationCost = shirtCost;
    const totalExpenses = expensesTotal + fabricationCost;

    // Receita Total = Camisetas + Entrada + Patrocínios confirmados
    // Ofertas (soma total)
    const offeringsTotal = offerings.reduce((a, o) => a + o.amount_cents, 0);
    const offeringsCount = offerings.length;

    const totalRevenue = camisetasTotal + entTotal + sponsorsConfirmedTotal + offeringsTotal;
    const totalGross = camisetasGross + entGross;
    const totalFee = camisetasAgg.fee + entFee;

    // Lucro líquido & margem
    const netProfit = totalRevenue - totalExpenses;
    const margin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const totalCount = camisetasCount + entCount;
    const ticket = totalCount > 0 ? Math.round((camisetasTotal + entTotal) / totalCount) : 0;

    return {
      camisetasTotal, camisetasGross, camisetasCount,
      entTotal, entGross, entCount, entFee, entPendingCount, entCanceledCount, entPendingGross,
      // camiseta (kit)
      kitCount: kitPaid.length, kitGross, kitFee, kitNet, kitUnits, shirtCost, shirtProfit,
      // pulseira
      pulCount: pulPaid.length, pulGross, pulFee, pulNet, pulUnits,
      sponsorsConfirmedCash, sponsorsConfirmedPermuta, sponsorsConfirmedTotal, sponsorsCount,
      expensesTotal, fabricationCost, totalExpenses,
      totalRevenue, totalGross, feeCents: totalFee,
      netProfit, margin, totalCount, ticket,
    };
  }, [camisetasOrders, entrada, expenses, sponsors, costCamiseta]);

  // Alertas inteligentes
  const alerts: { level: "warn" | "danger"; msg: string }[] = [];
  if (metrics.totalRevenue > 0 && metrics.margin < 20) {
    alerts.push({
      level: metrics.margin < 0 ? "danger" : "warn",
      msg: `Margem ${metrics.margin.toFixed(1)}% — abaixo do mínimo saudável (20%).`,
    });
  }
  if (metrics.sponsorsCount === 0) {
    alerts.push({ level: "warn", msg: "Nenhum patrocinador confirmado ainda." });
  }
  if (metrics.totalExpenses > metrics.totalRevenue * 0.7 && metrics.totalRevenue > 0) {
    alerts.push({
      level: "warn",
      msg: "Gastos representam mais de 70% da receita — atenção ao orçamento.",
    });
  }

  const profitTone = metrics.netProfit > 0 ? "positive" : metrics.netProfit < 0 ? "negative" : "neutral";
  const marginTone = metrics.margin >= 20 ? "positive" : metrics.margin >= 0 ? "warning" : "negative";

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
          Considera apenas pedidos pagos (taxa do Mercado Pago descontada conforme o método: PIX 0,99% · Cartão 4,99%) e patrocínios confirmados. Sem filtro = histórico completo.
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

      {/* Visão estratégica */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Visão financeira</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Receita Total" value={fmtBRL(metrics.totalRevenue)} highlight tone="positive" />
          <StatCard label="Gastos Totais" value={fmtBRL(metrics.totalExpenses)} tone="negative" />
          <StatCard label="Patrocínios (confirmados)" value={fmtBRL(metrics.sponsorsConfirmedTotal)} tone="neutral" subtitle={`${metrics.sponsorsCount} patrocinador(es)`} />
          <StatCard
            label="Lucro Líquido"
            value={fmtBRL(metrics.netProfit)}
            tone={profitTone}
            icon={metrics.netProfit >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
          />
          <StatCard label="Margem Total" value={`${metrics.margin.toFixed(1)}%`} tone={marginTone} />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Bruto vendas: {fmtBRL(metrics.totalGross)} · Taxa PIX descontada: {fmtBRL(metrics.feeCents)} · Custo fabricação: {fmtBRL(metrics.fabricationCost)} · Outros gastos: {fmtBRL(metrics.expensesTotal)}
        </p>
      </div>

      {/* Rifa */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Rifa</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Arrecadado (rifa)" value={fmtBRL(metrics.camisetasTotal)} />
          <StatCard label="Pedidos pagos" value={String(metrics.camisetasCount)} />
          <StatCard label="Ticket médio" value={fmtBRL(metrics.camisetasCount > 0 ? Math.round(metrics.camisetasTotal / metrics.camisetasCount) : 0)} />
          {rifaStatus && (
            <>
              <StatCard label="Pedidos pendentes" value={String(rifaStatus.pending_orders)} />
              <StatCard label="Números disponíveis" value={String(rifaStatus.numbers_available)} />
              <StatCard label="Números pagos" value={String(rifaStatus.numbers_paid)} />
              <StatCard label="Números reservados" value={String(rifaStatus.numbers_reserved)} />
              <StatCard label="Vendedores" value={String(rifaStatus.sellers_count)} />
            </>
          )}
        </div>
      </div>

      {/* Resumo da Camiseta */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Resumo da Camiseta</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Receita paga"
            value={fmtBRL(metrics.kitGross)}
            subtitle="Valor bruto (sem descontar taxas)"
            tone="positive"
          />
          <StatCard
            label="Preço de custo"
            value={fmtBRL(metrics.shirtCost)}
            subtitle="Custo × camisetas vendidas"
            tone="warning"
          />
          <StatCard
            label="Taxa de Mercado Pago"
            value={fmtBRL(metrics.kitFee)}
            subtitle="PIX 0,99% · Cartão 4,99%"
            tone="warning"
          />
          <StatCard
            label="Lucro líquido"
            value={fmtBRL(metrics.shirtProfit)}
            subtitle="Receita − (custo + taxa MP)"
            tone={metrics.shirtProfit >= 0 ? "positive" : "negative"}
          />
          <StatCard label="Camisetas vendidas" value={String(metrics.kitUnits)} />
          <StatCard label="Pedidos pagos" value={String(metrics.kitCount)} />
          <StatCard label="Vendas pendentes" value={String(metrics.entPendingCount)} subtitle={fmtBRL(metrics.entPendingGross)} />
          <StatCard label="Vendas canceladas" value={String(metrics.entCanceledCount)} />
        </div>
      </div>

      {/* Resumo da Pulseira */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Resumo da Pulseira</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Receita paga"
            value={fmtBRL(metrics.pulGross)}
            subtitle="Valor bruto (sem descontar taxas)"
            tone="positive"
          />
          <StatCard
            label="Taxa de Mercado Pago"
            value={fmtBRL(metrics.pulFee)}
            subtitle="PIX 0,99% · Cartão 4,99%"
            tone="warning"
          />
          <StatCard
            label="Receita líquida"
            value={fmtBRL(metrics.pulNet)}
            subtitle="Receita − taxa MP"
            tone={metrics.pulNet >= 0 ? "positive" : "negative"}
          />
          <StatCard label="Pulseiras vendidas" value={String(metrics.pulUnits)} subtitle={`${metrics.pulCount} pedido(s)`} />
        </div>
      </div>

      {/* Total combinado (Camiseta + Pulseira) */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Total (Camiseta + Pulseira)</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Receita paga (bruto)" value={fmtBRL(metrics.entGross)} tone="positive" />
          <StatCard label="Taxa MP total" value={fmtBRL(metrics.entFee)} tone="warning" />
          <StatCard label="Receita líquida" value={fmtBRL(metrics.entTotal)} tone="positive" />
          <StatCard label="Pedidos pagos" value={String(metrics.entCount)} />
        </div>
      </div>

      {/* Patrocínios resumo */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Patrocínios</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Em dinheiro (confirmado)" value={fmtBRL(metrics.sponsorsConfirmedCash)} tone="positive" />
          <StatCard label="Em permuta (confirmado)" value={fmtBRL(metrics.sponsorsConfirmedPermuta)} />
          <StatCard label="Patrocinadores ativos" value={String(metrics.sponsorsCount)} />
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
