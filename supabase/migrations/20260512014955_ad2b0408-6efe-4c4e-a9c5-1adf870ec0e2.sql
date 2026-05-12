
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS reconcile_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reconcile_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_reconcile_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_reconcile_error text;

CREATE INDEX IF NOT EXISTS idx_payments_pending_next_reconcile
  ON public.payments (next_reconcile_at)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.reconcile_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  expired_orders integer NOT NULL DEFAULT 0,
  freed_numbers integer NOT NULL DEFAULT 0,
  candidates integer NOT NULL DEFAULT 0,
  processed integer NOT NULL DEFAULT 0,
  reconciled integer NOT NULL DEFAULT 0,
  approved integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  notes text
);

ALTER TABLE public.reconcile_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view reconcile runs"
  ON public.reconcile_runs
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_reconcile_runs_started_at
  ON public.reconcile_runs (started_at DESC);
