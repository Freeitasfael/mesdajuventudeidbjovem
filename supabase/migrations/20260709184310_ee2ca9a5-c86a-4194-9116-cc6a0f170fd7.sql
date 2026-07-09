
CREATE OR REPLACE FUNCTION public.admin_revert_all_manual_entrada_to_pending()
 RETURNS TABLE(reverted_count integer, restocked_pulseiras integer, restocked_shirts integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _ord public.entrada_orders%ROWTYPE;
  _it jsonb;
  _model text;
  _size text;
  _qty int;
  _sku text;
  _count int := 0;
  _pul int := 0;
  _shirts int := 0;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  FOR _ord IN
    SELECT * FROM public.entrada_orders
     WHERE status = 'paid' AND mp_payment_id IS NULL
     FOR UPDATE
  LOOP
    -- devolve estoque da pulseira
    UPDATE public.entrada_stock
       SET stock = stock + _ord.quantity, updated_at = now()
     WHERE sku = 'pulseira';
    _pul := _pul + _ord.quantity;

    -- devolve estoque das camisetas (kit)
    IF _ord.product = 'kit' THEN
      IF _ord.items IS NOT NULL AND jsonb_typeof(_ord.items) = 'array' AND jsonb_array_length(_ord.items) > 0 THEN
        FOR _it IN SELECT * FROM jsonb_array_elements(_ord.items) LOOP
          _model := COALESCE(NULLIF(_it->>'model',''), 'adulto');
          _size := NULLIF(_it->>'size','');
          _qty := COALESCE((_it->>'quantity')::int, 0);
          IF _size IS NOT NULL AND _qty > 0 THEN
            _sku := 'camiseta_' || _model || '_' || _size;
            UPDATE public.entrada_stock
               SET stock = stock + _qty, updated_at = now()
             WHERE sku = _sku;
            _shirts := _shirts + _qty;
          END IF;
        END LOOP;
      ELSIF _ord.size IS NOT NULL THEN
        _sku := 'camiseta_' || COALESCE(NULLIF(_ord.model,''),'adulto') || '_' || _ord.size;
        UPDATE public.entrada_stock
           SET stock = stock + _ord.quantity, updated_at = now()
         WHERE sku = _sku;
        _shirts := _shirts + _ord.quantity;
      END IF;
    END IF;

    UPDATE public.entrada_orders
       SET status = 'pending',
           paid_at = NULL,
           expires_at = now() + interval '30 days',
           updated_at = now()
     WHERE id = _ord.id;

    _count := _count + 1;
  END LOOP;

  reverted_count := _count;
  restocked_pulseiras := _pul;
  restocked_shirts := _shirts;
  RETURN NEXT;
END;
$function$;
