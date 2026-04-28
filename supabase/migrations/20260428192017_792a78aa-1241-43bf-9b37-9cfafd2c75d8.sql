-- Index for faster ranking queries
CREATE INDEX IF NOT EXISTS idx_orders_seller_status ON public.orders(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_order_numbers_order ON public.order_numbers(order_id);
CREATE INDEX IF NOT EXISTS idx_sellers_ref_code ON public.sellers(ref_code);

-- Public ranking function: returns sellers with totals (only paid orders)
CREATE OR REPLACE FUNCTION public.get_seller_ranking()
RETURNS TABLE(
  seller_id uuid,
  seller_name text,
  ref_code text,
  total_numbers bigint,
  total_cents bigint,
  total_orders bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id AS seller_id,
    s.name AS seller_name,
    s.ref_code,
    COALESCE(SUM(num_count.cnt), 0)::bigint AS total_numbers,
    COALESCE(SUM(o.total_cents), 0)::bigint AS total_cents,
    COUNT(DISTINCT o.id)::bigint AS total_orders
  FROM public.sellers s
  LEFT JOIN public.orders o
    ON o.seller_id = s.id AND o.status = 'paid'
  LEFT JOIN LATERAL (
    SELECT count(*)::int AS cnt
      FROM public.order_numbers onm
     WHERE onm.order_id = o.id
  ) num_count ON true
  GROUP BY s.id, s.name, s.ref_code
  ORDER BY total_cents DESC, total_numbers DESC, s.name ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_seller_ranking() TO anon, authenticated;

-- Allow public to read aggregated stats (function is SECURITY DEFINER)
-- Add a helper to fetch a seller by ref_code (public)
CREATE OR REPLACE FUNCTION public.get_seller_by_ref(_ref_code text)
RETURNS TABLE(id uuid, name text, ref_code text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, ref_code FROM public.sellers WHERE ref_code = _ref_code LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_seller_by_ref(text) TO anon, authenticated;