
-- 1) Schema interno (não exposto via PostgREST)
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

-- 2) Mover has_role para private; políticas RLS referenciam por OID e continuam válidas
ALTER FUNCTION public.has_role(uuid, app_role) SET SCHEMA private;
REVOKE ALL ON FUNCTION private.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, app_role) TO anon, authenticated, service_role;

-- 3) Funções consumidas pelo frontend: SECURITY INVOKER (RLS faz o controle)
ALTER FUNCTION public.admin_dashboard_stats() SECURITY INVOKER;
ALTER FUNCTION public.get_seller_by_ref(text) SECURITY INVOKER;

-- get_seller_ranking precisa qualificar private.has_role e incluir private no search_path
CREATE OR REPLACE FUNCTION public.get_seller_ranking()
 RETURNS TABLE(seller_id uuid, seller_name text, ref_code text, total_numbers bigint, total_cents bigint, total_orders bigint)
 LANGUAGE plpgsql
 STABLE
 SECURITY INVOKER
 SET search_path TO 'public', 'private'
AS $function$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
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
$function$;

-- 4) Funções internas usadas apenas pelo backend (service_role)
REVOKE ALL ON FUNCTION public.confirm_payment(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_payment(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_payment(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.reserve_numbers(uuid, integer[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_numbers(uuid, integer[]) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_numbers(uuid, integer[]) TO service_role;

REVOKE ALL ON FUNCTION public.expire_reservations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_reservations() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_reservations() TO service_role;
