import { describe, expect, it } from "vitest";
import {
  CARD_FEE_RATE,
  PIX_FEE_RATE,
  feeCents,
  feeRate,
  netCents,
  netFromOrders,
} from "@/lib/fees";

describe("feeRate", () => {
  it("cartão (variações) → 4,99%", () => {
    for (const m of ["card", "credit", "credit_card", "debit", "debit_card", "CARD", " Card "]) {
      expect(feeRate(m)).toBe(CARD_FEE_RATE);
    }
  });
  it("pix explícito → 0,99%", () => {
    expect(feeRate("pix")).toBe(PIX_FEE_RATE);
    expect(feeRate("PIX")).toBe(PIX_FEE_RATE);
  });
  it("nulo/vazio → padrão histórico PIX 0,99%", () => {
    expect(feeRate(null)).toBe(PIX_FEE_RATE);
    expect(feeRate(undefined)).toBe(PIX_FEE_RATE);
    expect(feeRate("")).toBe(PIX_FEE_RATE);
  });
  it("dinheiro/manual/outro → 0%", () => {
    for (const m of ["cash", "dinheiro", "manual", "other", "outro", "none"]) {
      expect(feeRate(m)).toBe(0);
    }
  });
});

describe("feeCents (arredondamento em centavos)", () => {
  it("PIX R$60,00 → 59c", () => expect(feeCents(6000, "pix")).toBe(59));
  it("Cartão R$60,00 → 299c", () => expect(feeCents(6000, "card")).toBe(299));
  it("PIX R$15,00 → 15c (14,85 arredonda p/ 15)", () => expect(feeCents(1500, "pix")).toBe(15));
  it("PIX R$1,00 → 1c", () => expect(feeCents(100, "pix")).toBe(1));
  it("Cartão R$1,00 → 5c", () => expect(feeCents(100, "card")).toBe(5));
  it("Cash R$999,00 → 0c", () => expect(feeCents(99900, "cash")).toBe(0));
  it("Zero/negativo → 0", () => {
    expect(feeCents(0, "pix")).toBe(0);
    expect(feeCents(-100, "card")).toBe(0);
  });
});

describe("netCents", () => {
  it("PIX R$60 → 5941c líquido", () => expect(netCents(6000, "pix")).toBe(5941));
  it("Cartão R$60 → 5701c líquido", () => expect(netCents(6000, "card")).toBe(5701));
  it("Manual/dinheiro → líquido = bruto", () => {
    expect(netCents(15000, "cash")).toBe(15000);
    expect(netCents(15000, "outro")).toBe(15000);
  });
});

describe("netFromOrders", () => {
  it("soma corretamente pedidos misturados (PIX + cartão + manual)", () => {
    const orders = [
      { total_cents: 6000, payment_method: "pix" },    // fee 59
      { total_cents: 6000, payment_method: "card" },   // fee 299
      { total_cents: 6000, payment_method: "cash" },   // fee 0
      { total_cents: 1500, payment_method: null },     // default pix, fee 15
    ];
    const r = netFromOrders(orders);
    expect(r.gross).toBe(19500);
    expect(r.fee).toBe(59 + 299 + 0 + 15);
    expect(r.net).toBe(19500 - (59 + 299 + 0 + 15));
  });
  it("cada pedido individualmente tem net = gross - fee", () => {
    const values = [100, 500, 999, 1500, 6000, 12345, 99900];
    const methods = ["pix", "card", "cash", null, undefined];
    for (const v of values) {
      for (const m of methods) {
        const single = netFromOrders([{ total_cents: v, payment_method: m as never }]);
        expect(single.net + single.fee).toBe(single.gross);
        expect(single.gross).toBe(v);
        expect(single.fee).toBe(feeCents(v, m as never));
      }
    }
  });
});
