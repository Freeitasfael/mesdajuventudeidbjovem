
-- 1. Sellers: remove public SELECT, restrict to admins + owners
DROP POLICY IF EXISTS "Anyone can view sellers" ON public.sellers;

CREATE POLICY "Admins can view sellers"
ON public.sellers FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Sellers can view own row"
ON public.sellers FOR SELECT TO authenticated
USING (user_id = auth.uid());

-- 2. app_settings: split public vs internal keys
DROP POLICY IF EXISTS "Anyone can view settings" ON public.app_settings;

CREATE POLICY "Public can view public settings"
ON public.app_settings FOR SELECT TO anon, authenticated
USING (key IN ('raffle_title','price_per_number_cents','hero_prizes','hero_stats','hero_media'));

CREATE POLICY "Admins can view all settings"
ON public.app_settings FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 3. reconcile_lock: add admin-only policies (RLS enabled but no policies)
CREATE POLICY "Admins can view reconcile lock"
ON public.reconcile_lock FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 4. Storage: drop overly broad public SELECT on hero-media (public URL endpoint still works without it)
DROP POLICY IF EXISTS "hero-media public read" ON storage.objects;

-- Allow direct GET of specific objects via storage API while preventing listing:
-- public buckets serve files via /object/public/<path> which doesn't require a SELECT policy.

-- 5. Revoke EXECUTE on SECURITY DEFINER functions from anon/authenticated where not intended
REVOKE EXECUTE ON FUNCTION public.reserve_numbers(uuid, integer[]) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_reservations() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_payment(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_stats() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_list_orders(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_free_number(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_seller_ranking() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_seller() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_seller_stats() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_seller_orders() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_seller_order(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.register_seller_self(text, text) FROM anon;

-- Add admin auth check to admin_dashboard_stats (previously no internal check)
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
 RETURNS TABLE(paid_orders bigint, pending_orders bigint, total_revenue_cents bigint, numbers_paid bigint, numbers_reserved bigint, numbers_available bigint, sellers_count bigint)
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
    (SELECT count(*)::bigint FROM public.orders WHERE status = 'paid'),
    (SELECT count(*)::bigint FROM public.orders WHERE status = 'pending'),
    (SELECT COALESCE(SUM(total_cents),0)::bigint FROM public.orders WHERE status = 'paid'),
    (SELECT count(*)::bigint FROM public.numbers WHERE status = 'paid'),
    (SELECT count(*)::bigint FROM public.numbers WHERE status = 'reserved'),
    (SELECT count(*)::bigint FROM public.numbers WHERE status = 'available'),
    (SELECT count(*)::bigint FROM public.sellers);
END;
$function$;

-- 6. Realtime authorization: restrict realtime.messages subscriptions to admins + sellers
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can subscribe to realtime" ON realtime.messages;
CREATE POLICY "Admins can subscribe to realtime"
ON realtime.messages FOR SELECT TO authenticated
USING (private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Sellers can subscribe to realtime" ON realtime.messages;
CREATE POLICY "Sellers can subscribe to realtime"
ON realtime.messages FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.sellers WHERE user_id = auth.uid()));
