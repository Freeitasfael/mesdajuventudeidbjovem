DROP FUNCTION IF EXISTS public.admin_list_orders(integer);
DROP FUNCTION IF EXISTS public.get_my_seller_orders();

CREATE OR REPLACE FUNCTION public.admin_list_orders(_limit integer DEFAULT 100)
 RETURNS TABLE(order_id uuid, status text, total_cents integer, created_at timestamp with time zone, expires_at timestamp with time zone, buyer_name text, buyer_phone text, seller_name text, referral_label text, numbers integer[], payment_id uuid, provider_payment_id text, payment_status text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    o.id, o.status, o.total_cents, o.created_at, o.expires_at,
    b.name, b.phone, s.name, o.referral_label,
    COALESCE(
      (SELECT array_agg(onm.number ORDER BY onm.number)
         FROM public.order_numbers onm WHERE onm.order_id = o.id),
      ARRAY[]::int[]
    ),
    p.id, p.provider_payment_id, p.status
  FROM public.orders o
  JOIN public.buyers b ON b.id = o.buyer_id
  LEFT JOIN public.sellers s ON s.id = o.seller_id
  LEFT JOIN LATERAL (
    SELECT pp.id, pp.provider_payment_id, pp.status
      FROM public.payments pp
     WHERE pp.order_id = o.id
     ORDER BY pp.created_at DESC
     LIMIT 1
  ) p ON true
  ORDER BY o.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_seller_orders()
 RETURNS TABLE(order_id uuid, status text, total_cents integer, created_at timestamp with time zone, expires_at timestamp with time zone, buyer_name text, buyer_phone text, referral_label text, numbers integer[])
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_seller_id uuid;
BEGIN
  SELECT id INTO v_seller_id FROM public.sellers WHERE user_id = auth.uid() LIMIT 1;
  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Não é vendedor' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    o.id, o.status, o.total_cents, o.created_at, o.expires_at,
    b.name, b.phone, o.referral_label,
    COALESCE(
      (SELECT array_agg(onm.number ORDER BY onm.number)
         FROM public.order_numbers onm WHERE onm.order_id = o.id),
      ARRAY[]::int[]
    )
  FROM public.orders o
  JOIN public.buyers b ON b.id = o.buyer_id
  WHERE o.seller_id = v_seller_id
  ORDER BY o.created_at DESC
  LIMIT 500;
END;
$function$;