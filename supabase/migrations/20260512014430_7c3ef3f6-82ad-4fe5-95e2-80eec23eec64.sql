
-- Expira pagamentos pendentes (QRs gerados com token TEST)
UPDATE public.payments
   SET status = 'expired'
 WHERE status = 'pending';

-- Expira pedidos pendentes correspondentes
UPDATE public.orders
   SET status = 'expired'
 WHERE status = 'pending';

-- Libera números reservados
UPDATE public.numbers
   SET status = 'available',
       reserved_at = NULL,
       order_id = NULL
 WHERE status = 'reserved';
