
CREATE TABLE IF NOT EXISTS public.reconcile_lock (
  id smallint PRIMARY KEY DEFAULT 1,
  locked_until timestamptz,
  locked_at timestamptz,
  locked_by text,
  CONSTRAINT reconcile_lock_singleton CHECK (id = 1)
);

INSERT INTO public.reconcile_lock (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.reconcile_lock ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy: somente service_role (que bypassa RLS) pode acessar.
