import { describe, it, expect } from "vitest";
import {
  computeCategoryTotals,
  computeEntradaTotals,
  computeExpenseTotals,
  computeSponsorTotals,
  computeOfferingTotals,
  assembleDashboardMetrics,
  computePaymentKpis,
} from "@/services/dashboardMetrics";
import { getUniquePayments } from "@/lib/payments";

const order = (over: Partial<{ total_cents: number; status: string; payment_method: string | null; created_at: string; product: string; quantity: number }> = {}) => ({
  total_cents: 1000,
  status: "paid",
  payment_method: "pix",
  created_at: "2026-07-01T10:00:00Z",
  product: "kit",
  quantity: 1,
  ...over,
});

describe("computeCategoryTotals", () => {
  it("conta apenas pedidos pagos como receita", () => {
    const rows = [
      order({ total_cents: 5000, status: "paid" }),
      order({ total_cents: 3000, status: "pending" }),
      order({ total_cents: 2000, status: "refunded" }),
      order({ total_cents: 1000, status: "expired" }),
      order({ total_cents: 4000, status: "cancelled" }),
    ];
    const t = computeCategoryTotals(rows);
    expect(t.count).toBe(1);
    expect(t.gross).toBe(5000);
    expect(t.pendingCount).toBe(1);
    expect(t.pendingGross).toBe(3000);
    expect(t.refundedCount).toBe(1);
    // refunded + expired + cancelled todos agrupados como cancelled-like
    expect(t.cancelledCount).toBe(3);
  });

  it("REEMBOLSADO nunca aparece em receita (regra crítica D9)", () => {
    const rows = [
      order({ total_cents: 10000, status: "refunded" }),
      order({ total_cents: 10000, status: "charged_back" }),
    ];
    const t = computeCategoryTotals(rows);
    expect(t.count).toBe(0);
    expect(t.gross).toBe(0);
    expect(t.net).toBe(0);
  });

  it("aplica taxa MP correta por método", () => {
    const rows = [
      order({ total_cents: 10000, payment_method: "pix" }),   // 0,99%
      order({ total_cents: 10000, payment_method: "card" }),  // 4,99%
    ];
    const t = computeCategoryTotals(rows);
    expect(t.gross).toBe(20000);
    expect(t.fee).toBe(99 + 499);
    expect(t.net).toBe(20000 - (99 + 499));
  });
});

describe("computeEntradaTotals", () => {
  it("separa kit de pulseira e soma unidades apenas dos pagos", () => {
    const rows = [
      order({ product: "kit", quantity: 2, status: "paid", total_cents: 12000 }),
      order({ product: "kit", quantity: 5, status: "refunded", total_cents: 30000 }),
      order({ product: "pulseira", quantity: 3, status: "paid", total_cents: 900 }),
      order({ product: "pulseira", quantity: 10, status: "pending", total_cents: 3000 }),
    ];
    const t = computeEntradaTotals(rows);
    expect(t.kit.count).toBe(1);
    expect(t.kit.units).toBe(2);
    expect(t.pulseira.count).toBe(1);
    expect(t.pulseira.units).toBe(3);
    expect(t.count).toBe(2);
    expect(t.units).toBe(5);
    // refundeds nunca contam
    expect(t.gross).toBe(12000 + 900);
  });
});

describe("computeExpenseTotals", () => {
  it("separa pago (realizado) de agendado (previsto)", () => {
    const t = computeExpenseTotals([
      { amount_cents: 5000, expense_date: "2026-07-01", category: "x", status: "paid" },
      { amount_cents: 3000, expense_date: "2026-07-02", category: "x", status: "scheduled" },
    ]);
    expect(t.paid).toBe(5000);
    expect(t.scheduled).toBe(3000);
  });
});

describe("computeSponsorTotals", () => {
  it("só conta patrocínios confirmados; separa cash de permuta", () => {
    const t = computeSponsorTotals([
      { amount_cents: 100000, kind: "cash", status: "confirmed", created_at: "" },
      { amount_cents: 50000, kind: "permuta", status: "confirmed", created_at: "" },
      { amount_cents: 200000, kind: "cash", status: "pending", created_at: "" },
    ]);
    expect(t.cash).toBe(100000);
    expect(t.permuta).toBe(50000);
    expect(t.total).toBe(150000);
    expect(t.count).toBe(2);
    expect(t.pendingCash).toBe(200000);
  });
});

describe("computeOfferingTotals", () => {
  it("ofertas somam pelo valor bruto (regra D10-A: já é líquido)", () => {
    const t = computeOfferingTotals([
      { amount_cents: 10000, offering_date: "2026-07-01", payment_method: "cash" },
      { amount_cents: 5000, offering_date: "2026-07-02", payment_method: "pix" },
    ]);
    expect(t.total).toBe(15000);
    expect(t.count).toBe(2);
  });
});

describe("assembleDashboardMetrics", () => {
  it("Receita Total = Rifa + Entrada + Patrocínios + Ofertas (D2)", () => {
    const m = assembleDashboardMetrics({
      range: { from: "", to: "" },
      rifaOrders: [order({ total_cents: 10000, payment_method: "pix", product: "rifa" })],
      entradaOrders: [order({ total_cents: 5000, payment_method: "pix", product: "kit", quantity: 1 })],
      sponsors: [{ amount_cents: 100000, kind: "cash", status: "confirmed", created_at: "" }],
      expenses: [{ amount_cents: 20000, expense_date: "2026-07-01", category: "x", status: "paid" }],
      offerings: [{ amount_cents: 3000, offering_date: "2026-07-01", payment_method: "cash" }],
    });
    expect(m.rifa.gross).toBe(10000);
    expect(m.entrada.gross).toBe(5000);
    expect(m.sponsors.total).toBe(100000);
    expect(m.offerings.total).toBe(3000);
    expect(m.totals.revenueGross).toBe(10000 + 5000 + 100000 + 3000);
    // Net = bruto - taxas MP (só rifa+entrada); patrocínios e ofertas entram integrais
    const feePix = Math.round(10000 * 0.0099) + Math.round(5000 * 0.0099);
    expect(m.totals.feesMP).toBe(feePix);
    expect(m.totals.revenueNet).toBe(m.totals.revenueGross - feePix);
    expect(m.totals.netProfit).toBe(m.totals.revenueNet - 20000);
  });
});

describe("getUniquePayments (D5)", () => {
  it("mantém apenas o pagamento mais recente por order_id", () => {
    const p = [
      { order_id: "a", amount_cents: 100, status: "pending", created_at: "2026-07-01T00:00:00Z" },
      { order_id: "a", amount_cents: 100, status: "approved", created_at: "2026-07-02T00:00:00Z" },
      { order_id: "b", amount_cents: 200, status: "approved", created_at: "2026-07-01T00:00:00Z" },
    ];
    const u = getUniquePayments(p);
    expect(u).toHaveLength(2);
    const a = u.find((x) => x.order_id === "a")!;
    expect(a.status).toBe("approved");
  });

  it("pagamentos órfãos (sem order_id) são preservados", () => {
    const p = [
      { order_id: null, amount_cents: 100, status: "approved", created_at: "2026-07-01T00:00:00Z" },
      { order_id: "a", amount_cents: 100, status: "approved", created_at: "2026-07-01T00:00:00Z" },
    ];
    expect(getUniquePayments(p)).toHaveLength(2);
  });
});

describe("computePaymentKpis", () => {
  it("deduplica pagamentos duplicados antes de somar", () => {
    const orders = new Map([
      ["a", { payment_method: "pix" }],
      ["b", { payment_method: "card" }],
    ]);
    const payments = [
      { order_id: "a", amount_cents: 10000, status: "pending", created_at: "2026-07-01" },
      { order_id: "a", amount_cents: 10000, status: "approved", created_at: "2026-07-02" }, // vencedor
      { order_id: "b", amount_cents: 20000, status: "approved", created_at: "2026-07-01" },
    ];
    const k = computePaymentKpis(payments, orders);
    expect(k.uniqueCount).toBe(2);
    expect(k.rawCount).toBe(3);
    expect(k.approvedCount).toBe(2);
    expect(k.revPaidGross).toBe(30000);
    // Sem dedupe teria contado 40000 → o teste falha se alguém remover a dedupe
  });
});
