-- Allow admins to manage sellers
CREATE POLICY "Admins can insert sellers"
  ON public.sellers FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update sellers"
  ON public.sellers FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete sellers"
  ON public.sellers FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admin dashboard aggregate stats
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS TABLE(
  paid_orders bigint,
  pending_orders bigint,
  total_revenue_cents bigint,
  numbers_paid bigint,
  numbers_reserved bigint,
  numbers_available bigint,
  sellers_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*)::bigint FROM public.orders WHERE status = 'paid'),
    (SELECT count(*)::bigint FROM public.orders WHERE status = 'pending'),
    (SELECT COALESCE(SUM(total_cents),0)::bigint FROM public.orders WHERE status = 'paid'),
    (SELECT count(*)::bigint FROM public.numbers WHERE status = 'paid'),
    (SELECT count(*)::bigint FROM public.numbers WHERE status = 'reserved'),
    (SELECT count(*)::bigint FROM public.numbers WHERE status = 'available'),
    (SELECT count(*)::bigint FROM public.sellers);
$$;

REVOKE EXECUTE ON FUNCTION public.admin_dashboard_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;