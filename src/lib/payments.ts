// -----------------------------------------------------------------------------
// Deduplicação de pagamentos por pedido (D5).
// Um pedido pode ter múltiplos registros em `payments` (retry, webhook duplicado,
// reprocessamento). Sempre pegar apenas o mais recente por `order_id`.
// -----------------------------------------------------------------------------

export interface PaymentLike {
  order_id: string | null | undefined;
  created_at?: string | null;
  amount_cents?: number;
  status?: string | null;
  [k: string]: unknown;
}

/**
 * Retorna somente o pagamento mais recente por `order_id`.
 * - Pagamentos sem `order_id` são preservados como-is (órfãos: caso raro,
 *   auditar separadamente).
 * - Ordenação por `created_at` desc; empate mantém o primeiro visitado.
 */
export function getUniquePayments<T extends PaymentLike>(payments: T[]): T[] {
  const orphans: T[] = [];
  const byOrder = new Map<string, T>();
  for (const p of payments) {
    if (!p.order_id) {
      orphans.push(p);
      continue;
    }
    const prev = byOrder.get(p.order_id);
    if (!prev) {
      byOrder.set(p.order_id, p);
      continue;
    }
    const a = new Date(p.created_at ?? 0).getTime();
    const b = new Date(prev.created_at ?? 0).getTime();
    if (a >= b) byOrder.set(p.order_id, p);
  }
  return [...byOrder.values(), ...orphans];
}
