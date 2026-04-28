CREATE OR REPLACE FUNCTION public.confirm_payment(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_status text;
BEGIN
  -- Lock order row, check current state (idempotent)
  SELECT status INTO current_status
    FROM public.orders
   WHERE id = _order_id
   FOR UPDATE;

  IF current_status IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado: %', _order_id USING ERRCODE = 'P0002';
  END IF;

  IF current_status = 'paid' THEN
    -- Already confirmed, nothing to do
    RETURN;
  END IF;

  IF current_status NOT IN ('pending') THEN
    RAISE EXCEPTION 'Pedido em estado inválido para pagamento: %', current_status
      USING ERRCODE = 'P0001';
  END IF;

  -- Mark order as paid
  UPDATE public.orders SET status = 'paid' WHERE id = _order_id;

  -- Mark numbers as paid
  UPDATE public.numbers
     SET status = 'paid', reserved_at = NULL
   WHERE order_id = _order_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.confirm_payment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment(uuid) TO service_role;