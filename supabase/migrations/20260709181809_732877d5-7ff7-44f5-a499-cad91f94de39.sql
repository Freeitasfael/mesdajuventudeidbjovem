
ALTER TABLE public.entrada_orders ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE OR REPLACE FUNCTION public.admin_confirm_manual_entrada_payment(
  _order_id uuid,
  _payment_method text,
  _paid_at timestamptz DEFAULT now()
)
RETURNS TABLE(order_id uuid, status text, payment_method text, paid_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE
  _ord public.entrada_orders%ROWTYPE;
  _pm text := lower(coalesce(nullif(trim(_payment_method), ''), 'pix'));
  _paid timestamptz := coalesce(_paid_at, now());
  _it jsonb;
  _sku text;
  _model text;
  _size text;
  _qty int;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF _pm NOT IN ('pix','card','credit','credit_card','debit','debit_card','cash','dinheiro','manual','other','outro') THEN
    RAISE EXCEPTION 'invalid_payment_method';
  END IF;

  SELECT * INTO _ord FROM public.entrada_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF _ord.mp_payment_id IS NOT NULL THEN
    RAISE EXCEPTION 'not_manual_order' USING ERRCODE = '42501';
  END IF;

  IF _ord.status = 'paid' THEN
    order_id := _ord.id; status := _ord.status; payment_method := _ord.payment_method; paid_at := _ord.paid_at;
    RETURN NEXT; RETURN;
  END IF;

  IF _ord.status <> 'pending' THEN
    RAISE EXCEPTION 'invalid_status: %', _ord.status USING ERRCODE = '22023';
  END IF;

  UPDATE public.entrada_orders
     SET status = 'paid',
         payment_method = _pm,
         paid_at = _paid,
         updated_at = now()
   WHERE id = _order_id;

  -- Desconta estoque (mesma lógica do admin_add_manual_entrada_order paid).
  UPDATE public.entrada_stock
     SET stock = GREATEST(stock - _ord.quantity, 0), updated_at = now()
   WHERE sku = 'pulseira';

  IF _ord.product = 'kit' THEN
    IF _ord.items IS NOT NULL AND jsonb_typeof(_ord.items) = 'array' AND jsonb_array_length(_ord.items) > 0 THEN
      FOR _it IN SELECT * FROM jsonb_array_elements(_ord.items) LOOP
        _model := COALESCE(NULLIF(_it->>'model',''), 'adulto');
        _size := NULLIF(_it->>'size','');
        _qty := COALESCE((_it->>'quantity')::int, 0);
        IF _size IS NOT NULL AND _qty > 0 THEN
          _sku := 'camiseta_' || _model || '_' || _size;
          UPDATE public.entrada_stock
             SET stock = GREATEST(stock - _qty, 0), updated_at = now()
           WHERE sku = _sku;
        END IF;
      END LOOP;
    ELSIF _ord.size IS NOT NULL THEN
      _sku := 'camiseta_' || COALESCE(NULLIF(_ord.model,''),'adulto') || '_' || _ord.size;
      UPDATE public.entrada_stock
         SET stock = GREATEST(stock - _ord.quantity, 0), updated_at = now()
       WHERE sku = _sku;
    END IF;
  END IF;

  order_id := _order_id; status := 'paid'; payment_method := _pm; paid_at := _paid;
  RETURN NEXT;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.admin_confirm_manual_entrada_payment(uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_confirm_manual_entrada_payment(uuid, text, timestamptz) TO authenticated;
