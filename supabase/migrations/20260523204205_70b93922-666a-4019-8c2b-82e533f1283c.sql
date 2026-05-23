CREATE OR REPLACE FUNCTION public.admin_refund_order(_order_id uuid)
RETURNS TABLE(freed_numbers integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_freed int := 0;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.orders WHERE id = _order_id FOR UPDATE;

  WITH freed AS (
    UPDATE public.numbers
       SET status = 'available', reserved_at = NULL, order_id = NULL
     WHERE order_id = _order_id
    RETURNING number
  )
  SELECT count(*)::int INTO v_freed FROM freed;

  UPDATE public.orders
     SET status = 'cancelled'
   WHERE id = _order_id;

  UPDATE public.payments
     SET status = 'cancelled'
   WHERE order_id = _order_id AND status = 'pending';

  freed_numbers := v_freed;
  RETURN NEXT;
END;
$function$;