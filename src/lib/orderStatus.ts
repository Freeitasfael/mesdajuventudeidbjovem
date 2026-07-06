// -----------------------------------------------------------------------------
// Fonte única da verdade para status de pedido / pagamento em TODO o sistema.
// Nenhum componente/painel/relatório pode comparar `status === "paid"` diretamente.
// -----------------------------------------------------------------------------

export type OrderStatus = string | null | undefined;

const norm = (s: OrderStatus): string => (s ?? "").toString().trim().toLowerCase();

/** Status considerado PAGO — inclui variações do MP ("approved"). */
export function isPaid(s: OrderStatus): boolean {
  const v = norm(s);
  return v === "paid" || v === "approved";
}

/** Aguardando pagamento. */
export function isPending(s: OrderStatus): boolean {
  return norm(s) === "pending";
}

/** Estornado / reembolsado. NUNCA conta como venda. */
export function isRefunded(s: OrderStatus): boolean {
  const v = norm(s);
  return v === "refunded" || v === "charged_back";
}

/** Reserva expirada por timeout. */
export function isExpired(s: OrderStatus): boolean {
  return norm(s) === "expired";
}

/** Cancelamento explícito (usuário/admin/rejeitado pelo MP). */
export function isCancelled(s: OrderStatus): boolean {
  const v = norm(s);
  return v === "cancelled" || v === "canceled" || v === "rejected";
}

/**
 * Regra ÚNICA de "cancelado" para dashboards:
 * agrupa cancelamento explícito, expiração e reembolso.
 * Padroniza D3 + D4 em todo o app.
 */
export function isCancelledLike(s: OrderStatus): boolean {
  return isCancelled(s) || isExpired(s) || isRefunded(s);
}

/** Pedido concluído com sucesso (equivalente a `isPaid` hoje, mas semanticamente distinto). */
export function isCompleted(s: OrderStatus): boolean {
  return isPaid(s);
}
