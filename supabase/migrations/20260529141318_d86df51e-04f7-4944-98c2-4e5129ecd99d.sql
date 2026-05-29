-- Stock control for /entrada products
CREATE TABLE public.entrada_stock (
  sku text PRIMARY KEY,
  label text NOT NULL,
  stock integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.entrada_stock TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entrada_stock TO authenticated;
GRANT ALL ON public.entrada_stock TO service_role;

ALTER TABLE public.entrada_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view entrada stock"
  ON public.entrada_stock FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins manage entrada stock"
  ON public.entrada_stock FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

-- Seed SKUs
INSERT INTO public.entrada_stock (sku, label, stock) VALUES
  ('pulseira', 'Pulseira', 0),
  ('camiseta_PP', 'Camiseta PP', 0),
  ('camiseta_P', 'Camiseta P', 0),
  ('camiseta_M', 'Camiseta M', 0),
  ('camiseta_G', 'Camiseta G', 0),
  ('camiseta_GG', 'Camiseta GG', 0),
  ('camiseta_XGG', 'Camiseta XGG', 0)
ON CONFLICT (sku) DO NOTHING;

-- Decrement function (used by webhook on payment confirmed). Allows going to 0 but not below if strict=true.
CREATE OR REPLACE FUNCTION public.decrement_entrada_stock(_sku text, _qty integer)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new integer;
BEGIN
  UPDATE public.entrada_stock
     SET stock = GREATEST(stock - _qty, 0),
         updated_at = now()
   WHERE sku = _sku
   RETURNING stock INTO v_new;
  RETURN v_new;
END;
$$;

-- Admin: list entrada orders
CREATE OR REPLACE FUNCTION public.admin_list_entrada_orders(_limit integer DEFAULT 200)
RETURNS SETOF public.entrada_orders
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT * FROM public.entrada_orders
    ORDER BY created_at DESC
    LIMIT GREATEST(1, LEAST(_limit, 1000));
END;
$$;
