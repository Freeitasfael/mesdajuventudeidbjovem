
CREATE TABLE public.entrada_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_name text NOT NULL,
  buyer_phone text NOT NULL,
  product text NOT NULL CHECK (product IN ('pulseira','kit')),
  size text,
  quantity integer NOT NULL CHECK (quantity > 0 AND quantity <= 99),
  total_cents integer NOT NULL CHECK (total_cents > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','cancelled')),
  expires_at timestamptz NOT NULL,
  mp_payment_id text,
  qr_code text,
  qr_code_base64 text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.entrada_orders TO anon;
GRANT SELECT ON public.entrada_orders TO authenticated;
GRANT ALL ON public.entrada_orders TO service_role;

ALTER TABLE public.entrada_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view entrada order by id"
ON public.entrada_orders
FOR SELECT
TO anon, authenticated
USING (true);

CREATE TRIGGER entrada_orders_set_updated_at
BEFORE UPDATE ON public.entrada_orders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_entrada_orders_mp_payment_id ON public.entrada_orders(mp_payment_id);
CREATE INDEX idx_entrada_orders_status ON public.entrada_orders(status);
