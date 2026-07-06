// Taxas Mercado Pago aplicadas sobre o valor bruto recebido.
// PIX = 0,99% · Cartão = 4,99% (referência informada pelo cliente).
// Meios manuais (dinheiro, "outro") NÃO passam por MP → taxa 0%.
export const PIX_FEE_RATE = 0.0099;
export const CARD_FEE_RATE = 0.0499;
export const NO_FEE_RATE = 0;

export type PayMethod = string | null | undefined;

/** Normaliza a string de método de pagamento. */
function normalize(method: PayMethod): string {
  return (method ?? "").toString().trim().toLowerCase();
}

/**
 * Retorna a alíquota da taxa aplicada sobre o bruto.
 * - "card" / "credit" / "debit" → 4,99%
 * - "pix" (ou nulo/vazio, padrão histórico) → 0,99%
 * - "cash" / "dinheiro" / "manual" / "other" / "outro" → 0%
 */
export function feeRate(method: PayMethod): number {
  const m = normalize(method);
  if (m === "card" || m === "credit" || m === "credit_card" || m === "debit" || m === "debit_card") {
    return CARD_FEE_RATE;
  }
  if (m === "cash" || m === "dinheiro" || m === "manual" || m === "other" || m === "outro" || m === "none") {
    return NO_FEE_RATE;
  }
  // PIX é o padrão histórico quando não há método explícito.
  return PIX_FEE_RATE;
}

/** Valor da taxa (em centavos) cobrada sobre o bruto — arredondamento bancário nearest, half-up. */
export function feeCents(grossCents: number, method: PayMethod): number {
  if (!Number.isFinite(grossCents) || grossCents <= 0) return 0;
  const rate = feeRate(method);
  if (rate <= 0) return 0;
  // Math.round(x + 0.0) para evitar surpresas em 0.5 (JS já usa half-away-from-zero p/ positivos).
  return Math.round(grossCents * rate);
}

/** Valor líquido (em centavos) após desconto da taxa do meio de pagamento. */
export function netCents(grossCents: number, method: PayMethod): number {
  return grossCents - feeCents(grossCents, method);
}

/** Aplica taxa a uma lista de pedidos com `total_cents` + `payment_method`. */
export function netFromOrders<T extends { total_cents: number; payment_method?: PayMethod }>(
  orders: T[],
): { net: number; gross: number; fee: number } {
  let gross = 0;
  let fee = 0;
  for (const o of orders) {
    gross += o.total_cents;
    fee += feeCents(o.total_cents, o.payment_method);
  }
  return { net: gross - fee, gross, fee };
}
