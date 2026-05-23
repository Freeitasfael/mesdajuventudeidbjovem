CREATE OR REPLACE FUNCTION public.admin_refund_order(_order_id uuid)
RETURNS TABLE(freed_numbers integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $$
DECLARE
  v_freed int := 0;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  -- Lock the order
  PERFORM 1 FROM public.orders WHERE id = _order_id FOR UPDATE;

  -- Free all numbers tied to this order
  WITH freed AS (
    UPDATE public.numbers
       SET status = 'available', reserved_at = NULL, order_id = NULL
     WHERE order_id = _order_id
    RETURNING number
  )
  SELECT count(*)::int INTO v_freed FROM freed;

  -- Mark order as refunded
  UPDATE public.orders
     SET status = 'refunded'
   WHERE id = _order_id;

  -- Cancel any pending payments for this order
  UPDATE public.payments
     SET status = 'cancelled'
   WHERE order_id = _order_id AND status = 'pending';

  freed_numbers := v_freed;
  RETURN NEXT;
END;
$$;