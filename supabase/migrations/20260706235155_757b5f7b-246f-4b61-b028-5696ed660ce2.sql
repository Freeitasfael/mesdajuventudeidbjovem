
-- =========================================================
-- Health check logs
-- =========================================================
CREATE TABLE IF NOT EXISTS public.dashboard_health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  run_id uuid NOT NULL,
  indicator text NOT NULL,
  database_value numeric,
  service_value numeric,
  difference numeric,
  status text NOT NULL CHECK (status IN ('ok','warning','error','critical','na')),
  details jsonb,
  execution_time_ms integer,
  version text,
  environment text
);

GRANT SELECT, INSERT ON public.dashboard_health_logs TO authenticated;
GRANT ALL ON public.dashboard_health_logs TO service_role;

ALTER TABLE public.dashboard_health_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read health logs"
  ON public.dashboard_health_logs FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can insert health logs"
  ON public.dashboard_health_logs FOR INSERT
  TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX IF NOT EXISTS idx_dashboard_health_logs_run
  ON public.dashboard_health_logs (run_id, indicator);
CREATE INDEX IF NOT EXISTS idx_dashboard_health_logs_created
  ON public.dashboard_health_logs (created_at DESC);

-- =========================================================
-- Snapshot RPC — agregados brutos do banco em UMA chamada.
-- Usados como fonte "database" na comparação com o serviço JS.
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_health_snapshot(
  _from timestamptz DEFAULT NULL,
  _to   timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v jsonb;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  WITH
  rifa AS (
    SELECT
      COALESCE(SUM(total_cents) FILTER (WHERE status IN ('paid','approved')),0)::bigint AS gross,
      COUNT(*)          FILTER (WHERE status IN ('paid','approved'))::bigint AS paid,
      COUNT(*)          FILTER (WHERE status = 'pending')::bigint AS pending,
      COUNT(*)          FILTER (WHERE status IN ('cancelled','canceled','rejected'))::bigint AS cancelled,
      COUNT(*)          FILTER (WHERE status = 'expired')::bigint AS expired,
      COUNT(*)          FILTER (WHERE status = 'refunded')::bigint AS refunded,
      COUNT(*)          FILTER (WHERE status = 'charged_back')::bigint AS chargeback,
      COUNT(*)::bigint  AS total
    FROM public.orders
    WHERE (_from IS NULL OR created_at >= _from)
      AND (_to   IS NULL OR created_at <= _to)
  ),
  ent AS (
    SELECT
      COALESCE(SUM(total_cents) FILTER (WHERE status IN ('paid','approved') AND product='kit'),0)::bigint AS kit_gross,
      COALESCE(SUM(total_cents) FILTER (WHERE status IN ('paid','approved') AND product='pulseira'),0)::bigint AS pul_gross,
      COUNT(*) FILTER (WHERE status IN ('paid','approved'))::bigint AS paid,
      COUNT(*) FILTER (WHERE status = 'pending')::bigint AS pending,
      COUNT(*) FILTER (WHERE status IN ('cancelled','canceled','rejected'))::bigint AS cancelled,
      COUNT(*) FILTER (WHERE status = 'expired')::bigint AS expired,
      COUNT(*) FILTER (WHERE status = 'refunded')::bigint AS refunded,
      COUNT(*)::bigint AS total
    FROM public.entrada_orders
    WHERE (_from IS NULL OR created_at >= _from)
      AND (_to   IS NULL OR created_at <= _to)
  ),
  spo AS (
    SELECT
      COALESCE(SUM(amount_cents) FILTER (WHERE status='confirmed'),0)::bigint AS total,
      COUNT(*) FILTER (WHERE status='confirmed')::bigint AS confirmed,
      COUNT(*) FILTER (WHERE status='pending')::bigint   AS pending
    FROM public.sponsorships
    WHERE (_from IS NULL OR created_at >= _from)
      AND (_to   IS NULL OR created_at <= _to)
  ),
  ofr AS (
    SELECT
      COALESCE(SUM(amount_cents),0)::bigint AS total,
      COUNT(*)::bigint AS cnt
    FROM public.offerings
    WHERE (_from IS NULL OR offering_date >= _from)
      AND (_to   IS NULL OR offering_date <= _to)
  ),
  exp AS (
    SELECT
      COALESCE(SUM(amount_cents) FILTER (WHERE status='paid'),0)::bigint AS paid,
      COALESCE(SUM(amount_cents) FILTER (WHERE status='scheduled'),0)::bigint AS scheduled,
      COUNT(*)::bigint AS cnt
    FROM public.expenses
    WHERE (_from IS NULL OR expense_date >= _from)
      AND (_to   IS NULL OR expense_date <= _to)
  ),
  pay AS (
    SELECT
      COUNT(*)::bigint AS raw_count,
      COUNT(DISTINCT order_id)::bigint AS unique_by_order,
      COUNT(*) FILTER (WHERE order_id IS NULL)::bigint AS orphan
    FROM public.payments
    WHERE (_from IS NULL OR created_at >= _from)
      AND (_to   IS NULL OR created_at <= _to)
  ),
  wh AS (
    SELECT COUNT(*)::bigint AS cnt
    FROM public.payment_events
    WHERE (_from IS NULL OR created_at >= _from)
      AND (_to   IS NULL OR created_at <= _to)
  ),
  dup AS (
    SELECT COUNT(*)::bigint AS dup_orders
    FROM (
      SELECT order_id FROM public.payments
      WHERE order_id IS NOT NULL
        AND (_from IS NULL OR created_at >= _from)
        AND (_to   IS NULL OR created_at <= _to)
      GROUP BY order_id HAVING COUNT(*) > 1
    ) d
  )
  SELECT jsonb_build_object(
    'generated_at', now(),
    'range', jsonb_build_object('from', _from, 'to', _to),
    'rifa',      row_to_json(rifa)::jsonb,
    'entrada',   row_to_json(ent)::jsonb,
    'sponsors',  row_to_json(spo)::jsonb,
    'offerings', row_to_json(ofr)::jsonb,
    'expenses',  row_to_json(exp)::jsonb,
    'payments',  row_to_json(pay)::jsonb,
    'webhooks',  row_to_json(wh)::jsonb,
    'duplicates',row_to_json(dup)::jsonb
  ) INTO v
  FROM rifa, ent, spo, ofr, exp, pay, wh, dup;

  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_health_snapshot(timestamptz, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_health_snapshot(timestamptz, timestamptz) TO authenticated;

-- =========================================================
-- Latest health run helper
-- =========================================================
CREATE OR REPLACE FUNCTION public.admin_latest_health_run()
RETURNS TABLE(
  run_id uuid,
  created_at timestamptz,
  indicators bigint,
  errors bigint,
  warnings bigint,
  criticals bigint,
  total_ms bigint,
  max_ms integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH latest AS (
    SELECT dhl.run_id AS rid, MAX(dhl.created_at) AS ts
    FROM public.dashboard_health_logs dhl
    GROUP BY dhl.run_id
    ORDER BY ts DESC
    LIMIT 1
  )
  SELECT
    l.rid,
    l.ts,
    COUNT(*)::bigint,
    COUNT(*) FILTER (WHERE dhl.status='error')::bigint,
    COUNT(*) FILTER (WHERE dhl.status='warning')::bigint,
    COUNT(*) FILTER (WHERE dhl.status='critical')::bigint,
    COALESCE(SUM(dhl.execution_time_ms),0)::bigint,
    COALESCE(MAX(dhl.execution_time_ms),0)::int
  FROM latest l
  JOIN public.dashboard_health_logs dhl ON dhl.run_id = l.rid
  GROUP BY l.rid, l.ts;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_latest_health_run() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_latest_health_run() TO authenticated;
