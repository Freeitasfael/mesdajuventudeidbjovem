ALTER TABLE public.entrada_orders
  ADD COLUMN IF NOT EXISTS items jsonb;

CREATE OR REPLACE FUNCTION public.admin_refund_entrada_order(_order_id uuid)
 RETURNS TABLE(order_id uuid, previous_status text, new_status text, restocked boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _ord public.entrada_orders%ROWTYPE;
  _restocked boolean := false;
  _shirt_sku text;
  _it jsonb;
  _model text;
  _size text;
  _qty integer;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _ord FROM public.entrada_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002'; END IF;
  IF _ord.status NOT IN ('paid','pending') THEN
    RAISE EXCEPTION 'invalid_status: %', _ord.status USING ERRCODE = '22023';
  END IF;

  IF _ord.status = 'paid' THEN
    UPDATE public.entrada_stock SET stock = stock + _ord.quantity, updated_at = now()
      WHERE sku = 'pulseira';

    IF _ord.items IS NOT NULL AND jsonb_typeof(_ord.items) = 'array' AND jsonb_array_length(_ord.items) > 0 THEN
      FOR _it IN SELECT * FROM jsonb_array_elements(_ord.items) LOOP
        _model := COALESCE(NULLIF(_it->>'model',''), 'adulto');
        _size := NULLIF(_it->>'size','');
        _qty := COALESCE((_it->>'quantity')::int, 0);
        IF _size IS NOT NULL AND _qty > 0 THEN
          _shirt_sku := 'camiseta_' || _model || '_' || _size;
          UPDATE public.entrada_stock SET stock = stock + _qty, updated_at = now()
            WHERE sku = _shirt_sku;
        END IF;
      END LOOP;
    ELSIF _ord.product = 'kit' AND _ord.size IS NOT NULL THEN
      _shirt_sku := 'camiseta_' || COALESCE(NULLIF(_ord.model,''),'adulto') || '_' || _ord.size;
      UPDATE public.entrada_stock SET stock = stock + _ord.quantity, updated_at = now()
        WHERE sku = _shirt_sku;
    END IF;

    _restocked := true;
  END IF;

  UPDATE public.entrada_orders
     SET status = 'refunded', updated_at = now()
   WHERE id = _order_id;

  RETURN QUERY SELECT _order_id, _ord.status, 'refunded'::text, _restocked;
END;
$function$;