
CREATE OR REPLACE FUNCTION public.admin_refund_entrada_order(_order_id uuid)
RETURNS TABLE(order_id uuid, previous_status text, new_status text, restocked boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _ord public.entrada_orders%ROWTYPE;
  _restocked boolean := false;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _ord FROM public.entrada_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF _ord.status NOT IN ('paid','pending') THEN
    RAISE EXCEPTION 'invalid_status: %', _ord.status USING ERRCODE = '22023';
  END IF;

  -- Repõe estoque apenas se já estava pago (pending não baixa estoque na confirmação? por segurança repor só se paid)
  IF _ord.status = 'paid' THEN
    UPDATE public.entrada_stock SET stock = stock + _ord.quantity, updated_at = now()
      WHERE sku = 'pulseira';
    IF _ord.product = 'kit' AND _ord.size IS NOT NULL THEN
      UPDATE public.entrada_stock SET stock = stock + _ord.quantity, updated_at = now()
        WHERE sku = 'camiseta_' || _ord.size;
    END IF;
    _restocked := true;
  END IF;

  UPDATE public.entrada_orders
    SET status = 'refunded', updated_at = now()
    WHERE id = _order_id;

  RETURN QUERY SELECT _order_id, _ord.status, 'refunded'::text, _restocked;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_refund_entrada_order(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_refund_entrada_order(uuid) TO authenticated;
