CREATE OR REPLACE FUNCTION public.admin_reset_all_data()
RETURNS TABLE(orders_deleted integer, numbers_reset integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  v_orders int := 0;
  v_numbers int := 0;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.payment_events;
  DELETE FROM public.payments;
  DELETE FROM public.order_numbers;

  WITH d AS (DELETE FROM public.orders RETURNING id)
  SELECT count(*)::int INTO v_orders FROM d;

  DELETE FROM public.buyers;

  WITH u AS (
    UPDATE public.numbers
       SET status = 'available', reserved_at = NULL, order_id = NULL
     WHERE status <> 'available' OR order_id IS NOT NULL OR reserved_at IS NOT NULL
    RETURNING number
  )
  SELECT count(*)::int INTO v_numbers FROM u;

  orders_deleted := v_orders;
  numbers_reset := v_numbers;
  RETURN NEXT;
END;
$$;