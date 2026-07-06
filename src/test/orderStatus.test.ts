import { describe, it, expect } from "vitest";
import {
  isPaid,
  isPending,
  isRefunded,
  isCancelled,
  isCancelledLike,
  isExpired,
  isCompleted,
} from "@/lib/orderStatus";

describe("orderStatus helpers", () => {
  it("isPaid aceita 'paid' e 'approved'", () => {
    expect(isPaid("paid")).toBe(true);
    expect(isPaid("APPROVED")).toBe(true);
    expect(isPaid("pending")).toBe(false);
    expect(isPaid(null)).toBe(false);
  });

  it("isRefunded aceita variações", () => {
    expect(isRefunded("refunded")).toBe(true);
    expect(isRefunded("charged_back")).toBe(true);
    expect(isRefunded("paid")).toBe(false);
  });

  it("reembolsado NUNCA é pago", () => {
    for (const s of ["refunded", "charged_back", "REFUNDED"]) {
      expect(isPaid(s)).toBe(false);
      expect(isCompleted(s)).toBe(false);
    }
  });

  it("isCancelledLike agrupa cancel/expired/refunded (regra única D3+D4)", () => {
    expect(isCancelledLike("cancelled")).toBe(true);
    expect(isCancelledLike("canceled")).toBe(true);
    expect(isCancelledLike("rejected")).toBe(true);
    expect(isCancelledLike("expired")).toBe(true);
    expect(isCancelledLike("refunded")).toBe(true);
    expect(isCancelledLike("paid")).toBe(false);
    expect(isCancelledLike("pending")).toBe(false);
  });

  it("categorias são mutuamente exclusivas em pares chave", () => {
    for (const s of ["paid", "pending", "refunded", "expired", "cancelled"]) {
      const flags = [isPaid(s), isPending(s), isRefunded(s), isExpired(s), isCancelled(s)];
      const truthy = flags.filter(Boolean).length;
      expect(truthy).toBe(1);
    }
  });
});
