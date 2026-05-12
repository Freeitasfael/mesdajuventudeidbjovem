
CREATE TABLE IF NOT EXISTS public.admin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  level text NOT NULL DEFAULT 'warn',
  alert_type text NOT NULL,
  message text NOT NULL,
  details jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid
);

CREATE INDEX IF NOT EXISTS idx_admin_alerts_created_at ON public.admin_alerts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_alerts_unack ON public.admin_alerts(acknowledged_at) WHERE acknowledged_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_admin_alerts_type ON public.admin_alerts(alert_type, created_at DESC);

ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view alerts"
  ON public.admin_alerts FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update alerts"
  ON public.admin_alerts FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete alerts"
  ON public.admin_alerts FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.app_settings (key, value) VALUES
  ('alerts.errors_per_run_threshold', '3'::jsonb),
  ('alerts.mp_consecutive_failures_threshold', '3'::jsonb),
  ('alerts.dedupe_minutes', '30'::jsonb)
ON CONFLICT (key) DO NOTHING;
