// Taxas Mercado Pago aplicadas sobre o valor bruto recebido.
// PIX = 0,99% · Cartão = 4,99% (referência informada pelo cliente).
export const PIX_FEE_RATE = 0.0099;
export const CARD_FEE_RATE = 0.0499;

export type PayMethod = string | null | undefined;

/** Retorna a alíquota da taxa para o método de pagamento. */
export function feeRate(method: PayMethod): number {
  return method === "card" ? CARD_FEE_RATE : PIX_FEE_RATE;
}

/** Valor da taxa (em centavos) cobrada sobre o bruto. */
export function feeCents(grossCents: number, method: PayMethod): number {
  return Math.round(grossCents * feeRate(method));
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
