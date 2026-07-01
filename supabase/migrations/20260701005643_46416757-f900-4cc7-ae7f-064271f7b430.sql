
CREATE TABLE public.offerings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  description text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  offering_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text NOT NULL DEFAULT 'pix' CHECK (payment_method IN ('pix','cash','card','transfer','other')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.offerings TO authenticated;
GRANT ALL ON public.offerings TO service_role;

ALTER TABLE public.offerings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage offerings"
  ON public.offerings
  FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER offerings_set_updated_at
  BEFORE UPDATE ON public.offerings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX offerings_date_idx ON public.offerings (offering_date DESC);
