REVOKE EXECUTE ON FUNCTION public.get_seller_ranking() FROM anon, authenticated, public;

CREATE OR REPLACE FUNCTION public.get_seller_ranking()
RETURNS TABLE(
  seller_id uuid,
  seller_name text,
  ref_code text,
  total_numbers bigint,
  total_cents bigint,
  total_orders bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.ref_code,
    COALESCE(SUM(num_count.cnt), 0)::bigint,
    COALESCE(SUM(o.total_cents), 0)::bigint,
    COUNT(DISTINCT o.id)::bigint
  FROM public.sellers s
  LEFT JOIN public.orders o
    ON o.seller_id = s.id AND o.status = 'paid'
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS cnt
      FROM public.order_numbers onm
     WHERE onm.order_id = o.id
  ) num_count ON true
  GROUP BY s.id, s.name, s.ref_code
  ORDER BY 5 DESC, 4 DESC, s.name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_seller_ranking() TO authenticated;