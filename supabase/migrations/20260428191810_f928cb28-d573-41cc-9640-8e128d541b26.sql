-- Enable scheduling + http calls from the database
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Atomic expiration: expire orders past due, free their numbers, mark payments expired.
CREATE OR REPLACE FUNCTION public.expire_reservations()
RETURNS TABLE (expired_orders int, freed_numbers int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orders int := 0;
  v_numbers int := 0;
BEGIN
  -- Find pending orders that have expired
  WITH due AS (
    SELECT id FROM public.orders
     WHERE status = 'pending'
       AND expires_at < now()
     FOR UPDATE SKIP LOCKED
  ),
  upd_orders AS (
    UPDATE public.orders o
       SET status = 'expired'
      FROM due
     WHERE o.id = due.id
    RETURNING o.id
  ),
  upd_numbers AS (
    UPDATE public.numbers n
       SET status = 'available',
           reserved_at = NULL,
           order_id = NULL
      FROM upd_orders u
     WHERE n.order_id = u.id
       AND n.status = 'reserved'
    RETURNING n.number
  ),
  upd_payments AS (
    UPDATE public.payments p
       SET status = 'expired'
      FROM upd_orders u
     WHERE p.order_id = u.id
       AND p.status = 'pending'
    RETURNING p.id
  )
  SELECT
    (SELECT count(*)::int FROM upd_orders),
    (SELECT count(*)::int FROM upd_numbers)
  INTO v_orders, v_numbers;

  expired_orders := v_orders;
  freed_numbers := v_numbers;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.expire_reservations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_reservations() TO service_role;