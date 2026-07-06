// -----------------------------------------------------------------------------
// CAMADA ÚNICA DE MÉTRICAS — fonte oficial de todos os indicadores.
//
// Regras (mesmas para TODOS os dashboards):
//  - Vendas contam APENAS pedidos com isPaid() = true.
//  - Reembolsados / expirados / cancelados NUNCA entram em receita ou contagem.
//  - Receita bruta = SUM(total_cents pago); Receita líquida = bruto - taxa MP.
//  - Ofertas entram como valor LÍQUIDO (regra D10, opção A): o valor registrado
//    já é o efetivamente recebido (dinheiro, transferência, PIX pessoal).
//  - Despesas: `paid` conta como realizado; `scheduled` como previsto (não entra
//    no lucro líquido realizado — só no "previsto").
//  - Patrocínios: só `confirmed` entra em receita; `pending` é apenas informativo.
//  - Filtro de período usa `created_at` (ou `expense_date` / `offering_date`)
//    convertido para UTC pelas helpers de `dateUtils.ts`.
// -----------------------------------------------------------------------------

import { supabase } from "@/integrations/supabase/client";
import { netFromOrders, feeCents } from "@/lib/fees";
import {
  isPaid,
  isPending,
  isRefunded,
  isCancelledLike,
} from "@/lib/orderStatus";
import { startOfDayISO, endOfDayISO, type DateRange } from "@/lib/dateUtils";
import { getUniquePayments, type PaymentLike } from "@/lib/payments";

// ---------- Tipos brutos das tabelas usadas ----------
export interface OrderRow {
  id?: string;
  total_cents: number;
  created_at: string;
  status: string;
  payment_method: string | null;
}
export interface EntradaRow extends OrderRow {
  product: string; // "kit" | "pulseira"
  quantity: number;
}
export interface ExpenseRow {
  amount_cents: number;
  expense_date: string;
  category: string;
  status: "paid" | "scheduled" | string;
}
export interface SponsorRow {
  amount_cents: number;
  kind: "cash" | "permuta";
  status: "confirmed" | "pending" | string;
  created_at: string;
}
export interface OfferingRow {
  amount_cents: number;
  offering_date: string;
  payment_method: string;
}

// ---------- Agregados devolvidos por categoria ----------
export interface CategoryTotals {
  count: number;              // # pedidos pagos
  pendingCount: number;
  cancelledCount: number;     // agrupado: cancel + expired + refunded
  refundedCount: number;
  gross: number;              // R$ bruto (centavos)
  net: number;                // R$ líquido após taxa MP (centavos)
  fee: number;                // taxa MP (centavos)
  pendingGross: number;
}

export interface EntradaTotals extends CategoryTotals {
  kit: CategoryTotals & { units: number };
  pulseira: CategoryTotals & { units: number };
  units: number;              // kit + pulseira
}

export interface SponsorTotals {
  cash: number;
  permuta: number;
  total: number;
  count: number;              // confirmados
  pendingCount: number;
  pendingCash: number;
}

export interface ExpenseTotals {
  paid: number;               // realizado
  scheduled: number;          // previsto
  count: number;
}

export interface OfferingTotals {
  total: number;              // já líquido (regra D10-A)
  count: number;
}

export interface DashboardMetrics {
  range: DateRange;
  rifa: CategoryTotals;
  entrada: EntradaTotals;
  sponsors: SponsorTotals;
  offerings: OfferingTotals;
  expenses: ExpenseTotals;
  totals: {
    revenueGross: number;     // rifa+entrada bruto + sponsors + offerings
    revenueNet: number;       // rifa+entrada líquido + sponsors + offerings
    feesMP: number;
    ordersPaid: number;       // rifa + entrada
    ticketNet: number;
    netProfit: number;        // revenueNet - expenses.paid (- fabricação, calculado por quem consome)
  };
}

// ---------- Agregadores puros (testáveis sem Supabase) ----------
export function computeCategoryTotals<T extends OrderRow>(
  orders: T[],
): CategoryTotals {
  const paid = orders.filter((o) => isPaid(o.status));
  const pending = orders.filter((o) => isPending(o.status));
  const cancelled = orders.filter((o) => isCancelledLike(o.status));
  const refunded = orders.filter((o) => isRefunded(o.status));
  const agg = netFromOrders(paid);
  const pendingGross = pending.reduce((a, o) => a + o.total_cents, 0);
  return {
    count: paid.length,
    pendingCount: pending.length,
    cancelledCount: cancelled.length,
    refundedCount: refunded.length,
    gross: agg.gross,
    net: agg.net,
    fee: agg.fee,
    pendingGross,
  };
}

export function computeEntradaTotals(rows: EntradaRow[]): EntradaTotals {
  const kitRows = rows.filter((r) => r.product === "kit");
  const pulRows = rows.filter((r) => r.product === "pulseira");
  const kit = computeCategoryTotals(kitRows);
  const pul = computeCategoryTotals(pulRows);
  const kitUnits = kitRows
    .filter((r) => isPaid(r.status))
    .reduce((a, r) => a + (r.quantity || 1), 0);
  const pulUnits = pulRows
    .filter((r) => isPaid(r.status))
    .reduce((a, r) => a + (r.quantity || 1), 0);
  return {
    count: kit.count + pul.count,
    pendingCount: kit.pendingCount + pul.pendingCount,
    cancelledCount: kit.cancelledCount + pul.cancelledCount,
    refundedCount: kit.refundedCount + pul.refundedCount,
    gross: kit.gross + pul.gross,
    net: kit.net + pul.net,
    fee: kit.fee + pul.fee,
    pendingGross: kit.pendingGross + pul.pendingGross,
    kit: { ...kit, units: kitUnits },
    pulseira: { ...pul, units: pulUnits },
    units: kitUnits + pulUnits,
  };
}

export function computeSponsorTotals(rows: SponsorRow[]): SponsorTotals {
  const confirmed = rows.filter((s) => s.status === "confirmed");
  const cash = confirmed
    .filter((s) => s.kind === "cash")
    .reduce((a, s) => a + s.amount_cents, 0);
  const permuta = confirmed
    .filter((s) => s.kind === "permuta")
    .reduce((a, s) => a + s.amount_cents, 0);
  const pending = rows.filter((s) => s.status === "pending");
  const pendingCash = pending
    .filter((s) => s.kind === "cash")
    .reduce((a, s) => a + s.amount_cents, 0);
  return {
    cash,
    permuta,
    total: cash + permuta,
    count: confirmed.length,
    pendingCount: pending.length,
    pendingCash,
  };
}

export function computeExpenseTotals(rows: ExpenseRow[]): ExpenseTotals {
  const paid = rows
    .filter((e) => e.status === "paid")
    .reduce((a, e) => a + e.amount_cents, 0);
  const scheduled = rows
    .filter((e) => e.status === "scheduled")
    .reduce((a, e) => a + e.amount_cents, 0);
  return { paid, scheduled, count: rows.length };
}

export function computeOfferingTotals(rows: OfferingRow[]): OfferingTotals {
  // D10 (opção A): valor cadastrado JÁ é líquido.
  return {
    total: rows.reduce((a, o) => a + o.amount_cents, 0),
    count: rows.length,
  };
}

/** Agrega tudo em um único objeto (usa buffers já filtrados pelo caller ou o loader). */
export function assembleDashboardMetrics(input: {
  range: DateRange;
  rifaOrders: OrderRow[];
  entradaOrders: EntradaRow[];
  sponsors: SponsorRow[];
  expenses: ExpenseRow[];
  offerings: OfferingRow[];
}): DashboardMetrics {
  const rifa = computeCategoryTotals(input.rifaOrders);
  const entrada = computeEntradaTotals(input.entradaOrders);
  const sponsors = computeSponsorTotals(input.sponsors);
  const offerings = computeOfferingTotals(input.offerings);
  const expenses = computeExpenseTotals(input.expenses);

  const revenueGross = rifa.gross + entrada.gross + sponsors.total + offerings.total;
  const revenueNet = rifa.net + entrada.net + sponsors.total + offerings.total;
  const feesMP = rifa.fee + entrada.fee;
  const ordersPaid = rifa.count + entrada.count;
  const ticketNet = ordersPaid > 0 ? Math.round((rifa.net + entrada.net) / ordersPaid) : 0;
  const netProfit = revenueNet - expenses.paid;

  return {
    range: input.range,
    rifa,
    entrada,
    sponsors,
    offerings,
    expenses,
    totals: { revenueGross, revenueNet, feesMP, ordersPaid, ticketNet, netProfit },
  };
}

// ---------- Loader (Supabase) ----------

async function fetchWithRange<T>(
  table: string,
  select: string,
  dateColumn: string,
  range: DateRange,
  extra?: (q: ReturnType<typeof supabase.from>) => unknown,
): Promise<T[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase.from(table).select(select).limit(5000);
  if (extra) q = extra(q);
  if (range.from) {
    const iso = dateColumn.endsWith("_date") ? range.from : startOfDayISO(range.from);
    q = q.gte(dateColumn, iso);
  }
  if (range.to) {
    const iso = dateColumn.endsWith("_date") ? range.to : endOfDayISO(range.to);
    q = q.lte(dateColumn, iso);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as T[];
}

export async function loadDashboardMetrics(range: DateRange): Promise<DashboardMetrics> {
  const [rifaOrders, entradaOrders, expenses, sponsors, offerings] = await Promise.all([
    fetchWithRange<OrderRow>(
      "orders",
      "id, total_cents, created_at, status, payment_method",
      "created_at",
      range,
    ),
    fetchWithRange<EntradaRow>(
      "entrada_orders",
      "id, total_cents, created_at, status, payment_method, product, quantity",
      "created_at",
      range,
    ),
    fetchWithRange<ExpenseRow>(
      "expenses",
      "amount_cents, expense_date, category, status",
      "expense_date",
      range,
    ),
    // D8: patrocínios agora RESPEITAM o filtro de período (created_at)
    fetchWithRange<SponsorRow>(
      "sponsorships",
      "amount_cents, kind, status, created_at",
      "created_at",
      range,
    ),
    fetchWithRange<OfferingRow>(
      "offerings",
      "amount_cents, offering_date, payment_method",
      "offering_date",
      range,
    ),
  ]);

  return assembleDashboardMetrics({
    range,
    rifaOrders,
    entradaOrders,
    sponsors,
    expenses,
    offerings,
  });
}

// ---------- Utilidade: KPIs de Pagamentos (Admin > aba Pagamentos) ----------
/**
 * Consolida pagamentos deduplicando por `order_id` (D5). Usa o método de
 * pagamento do pedido vinculado para calcular a taxa correta.
 */
export function computePaymentKpis(
  payments: (PaymentLike & { amount_cents: number; status: string })[],
  ordersById: Map<string, { payment_method: string | null }>,
) {
  const unique = getUniquePayments(payments);
  const enriched = unique.map((p) => ({
    total_cents: p.amount_cents,
    payment_method: (p.order_id && ordersById.get(p.order_id)?.payment_method) ?? null,
    status: p.status,
  }));
  const approved = enriched.filter((p) => isPaid(p.status));
  const pending = enriched.filter((p) => isPending(p.status));
  const agg = netFromOrders(approved);
  return {
    revPaidGross: agg.gross,
    revPaidNet: agg.net,
    revPaidFee: agg.fee,
    revPendingGross: pending.reduce((a, p) => a + p.total_cents, 0),
    approvedCount: approved.length,
    pendingCount: pending.length,
    uniqueCount: unique.length,
    rawCount: payments.length,
  };
}

// Re-export para conveniência de testes/consumidores
export { feeCents };
