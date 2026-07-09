CREATE OR REPLACE FUNCTION public.admin_set_order_seller(_order_id uuid, _ref_code text)
RETURNS TABLE(order_id uuid, seller_id uuid, referral_label text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_seller_id uuid;
  v_name text;
  v_ref text;
  v_label text;
  v_code text := trim(coalesce(_ref_code, ''));
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_code = '' THEN
    UPDATE public.orders
       SET seller_id = NULL, referral_label = NULL
     WHERE id = _order_id;
    order_id := _order_id; seller_id := NULL; referral_label := NULL;
    RETURN NEXT; RETURN;
  END IF;

  SELECT s.id, s.name, s.ref_code INTO v_seller_id, v_name, v_ref
    FROM public.sellers s
   WHERE s.ref_code ILIKE v_code
   LIMIT 1;

  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'seller_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_label := v_name || ' (' || v_ref || ')';
  UPDATE public.orders
     SET seller_id = v_seller_id, referral_label = v_label
   WHERE id = _order_id;

  order_id := _order_id; seller_id := v_seller_id; referral_label := v_label;
  RETURN NEXT;
END;
$function$;