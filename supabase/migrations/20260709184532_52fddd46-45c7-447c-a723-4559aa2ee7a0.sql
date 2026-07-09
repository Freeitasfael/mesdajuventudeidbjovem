
-- 1) Tabela de Produção das Camisetas (single-row model)
CREATE TABLE IF NOT EXISTS public.entrada_production (
  id text PRIMARY KEY DEFAULT 'default',
  total_cost_cents integer NOT NULL DEFAULT 0,
  units_produced integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  CONSTRAINT entrada_production_singleton CHECK (id = 'default')
);

GRANT SELECT, INSERT, UPDATE ON public.entrada_production TO authenticated;
GRANT ALL ON public.entrada_production TO service_role;

ALTER TABLE public.entrada_production ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read production" ON public.entrada_production;
CREATE POLICY "Admins read production"
  ON public.entrada_production FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins write production" ON public.entrada_production;
CREATE POLICY "Admins write production"
  ON public.entrada_production FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

-- Semente com valores atuais (não sobrescreve se já existir)
INSERT INTO public.entrada_production (id, total_cost_cents, units_produced)
VALUES ('default', 326800, 86)
ON CONFLICT (id) DO NOTHING;

-- 2) RPC upsert
CREATE OR REPLACE FUNCTION public.admin_upsert_entrada_production(
  _total_cost_cents integer,
  _units_produced integer
) RETURNS public.entrada_production
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_row public.entrada_production;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF _total_cost_cents IS NULL OR _total_cost_cents < 0 THEN
    RAISE EXCEPTION 'invalid_cost';
  END IF;
  IF _units_produced IS NULL OR _units_produced <= 0 THEN
    RAISE EXCEPTION 'invalid_units';
  END IF;

  INSERT INTO public.entrada_production (id, total_cost_cents, units_produced, updated_at, updated_by)
  VALUES ('default', _total_cost_cents, _units_produced, now(), auth.uid())
  ON CONFLICT (id) DO UPDATE
    SET total_cost_cents = EXCLUDED.total_cost_cents,
        units_produced = EXCLUDED.units_produced,
        updated_at = now(),
        updated_by = auth.uid()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$function$;

-- 3) Adicionar parâmetro _consume_stock à criação manual
DROP FUNCTION IF EXISTS public.admin_add_manual_entrada_order(
  text, text, text, jsonb, integer, integer, text, text, text, text, text
);

CREATE OR REPLACE FUNCTION public.admin_add_manual_entrada_order(
  _buyer_name text,
  _buyer_phone text,
  _product text,
  _items jsonb,
  _quantity integer,
  _total_cents integer,
  _payment_method text,
  _seller_ref_code text DEFAULT NULL,
  _model text DEFAULT NULL,
  _size text DEFAULT NULL,
  _status text DEFAULT 'paid',
  _consume_stock boolean DEFAULT true
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_id uuid;
  v_seller_id uuid;
  v_seller_name text;
  v_seller_ref text;
  v_label text;
  v_it jsonb;
  v_sku text;
  v_qty int;
  v_mdl text;
  v_sz text;
  v_pm text := COALESCE(NULLIF(trim(_payment_method), ''), 'pix');
  v_status text := COALESCE(NULLIF(trim(_status), ''), 'paid');
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_status NOT IN ('paid','pending') THEN RAISE EXCEPTION 'invalid_status'; END IF;
  IF _product NOT IN ('pulseira','kit') THEN RAISE EXCEPTION 'invalid_product'; END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN RAISE EXCEPTION 'invalid_quantity'; END IF;
  IF _total_cents IS NULL OR _total_cents <= 0 THEN RAISE EXCEPTION 'invalid_total'; END IF;
  IF _buyer_name IS NULL OR length(trim(_buyer_name)) < 2 THEN RAISE EXCEPTION 'invalid_buyer_name'; END IF;

  IF _seller_ref_code IS NOT NULL AND length(trim(_seller_ref_code)) > 0 THEN
    SELECT s.id, s.name, s.ref_code INTO v_seller_id, v_seller_name, v_seller_ref
      FROM public.sellers s WHERE s.ref_code ILIKE trim(_seller_ref_code) LIMIT 1;
    IF v_seller_id IS NULL THEN RAISE EXCEPTION 'seller_not_found' USING ERRCODE = 'P0002'; END IF;
    v_label := v_seller_name || ' (' || v_seller_ref || ')';
  END IF;

  INSERT INTO public.entrada_orders (
    buyer_name, buyer_phone, product, model, size, quantity, total_cents,
    status, expires_at, mp_payment_id, payment_method, seller_id, referral_label, items, raw
  ) VALUES (
    trim(_buyer_name),
    COALESCE(NULLIF(regexp_replace(COALESCE(_buyer_phone,''), '\D', '', 'g'), ''), '00000000000'),
    _product, _model, _size, _quantity, _total_cents,
    v_status,
    CASE WHEN v_status = 'paid' THEN now() ELSE now() + interval '7 days' END,
    NULL, v_pm, v_seller_id, v_label,
    CASE WHEN _items IS NOT NULL AND jsonb_typeof(_items) = 'array' THEN _items ELSE NULL END,
    jsonb_build_object('manual', true, 'created_by', auth.uid(), 'consume_stock', _consume_stock)
  ) RETURNING id INTO v_id;

  IF v_status = 'paid' AND _consume_stock THEN
    UPDATE public.entrada_stock
       SET stock = GREATEST(stock - _quantity, 0), updated_at = now()
     WHERE sku = 'pulseira';

    IF _product = 'kit' THEN
      IF _items IS NOT NULL AND jsonb_typeof(_items) = 'array' AND jsonb_array_length(_items) > 0 THEN
        FOR v_it IN SELECT * FROM jsonb_array_elements(_items) LOOP
          v_mdl := COALESCE(NULLIF(v_it->>'model',''), 'adulto');
          v_sz := NULLIF(v_it->>'size','');
          v_qty := COALESCE((v_it->>'quantity')::int, 0);
          IF v_sz IS NOT NULL AND v_qty > 0 THEN
            v_sku := 'camiseta_' || v_mdl || '_' || v_sz;
            UPDATE public.entrada_stock SET stock = GREATEST(stock - v_qty, 0), updated_at = now() WHERE sku = v_sku;
          END IF;
        END LOOP;
      ELSIF _size IS NOT NULL THEN
        v_sku := 'camiseta_' || COALESCE(NULLIF(_model,''),'adulto') || '_' || _size;
        UPDATE public.entrada_stock SET stock = GREATEST(stock - _quantity, 0), updated_at = now() WHERE sku = v_sku;
      END IF;
    END IF;
  END IF;

  RETURN v_id;
END;
$function$;
