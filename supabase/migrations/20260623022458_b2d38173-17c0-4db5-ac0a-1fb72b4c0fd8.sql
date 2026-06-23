
CREATE OR REPLACE FUNCTION public.admin_mark_entrada_refunded(_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.entrada_orders
     SET status = 'refunded', updated_at = now()
   WHERE id = _order_id;
END;
$$;
