
-- 1) entrada_orders: novas colunas
ALTER TABLE public.entrada_orders
  ADD COLUMN IF NOT EXISTS model text NOT NULL DEFAULT 'adulto',
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'pix',
  ADD COLUMN IF NOT EXISTS seller_id uuid,
  ADD COLUMN IF NOT EXISTS referral_label text,
  ADD COLUMN IF NOT EXISTS init_point text;

-- 2) orders (rifa): payment_method
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'pix';

-- 3) entrada_stock: rename adulto + insere novos SKUs (baby + infantil)
UPDATE public.entrada_stock
   SET sku = 'camiseta_adulto_' || split_part(sku, '_', 2),
       label = 'Camiseta Adulto ' || split_part(sku, '_', 2)
 WHERE sku LIKE 'camiseta\_%' ESCAPE '\'
   AND sku NOT LIKE 'camiseta_adulto_%'
   AND sku NOT LIKE 'camiseta_baby_%'
   AND sku NOT LIKE 'camiseta_infantil_%';

INSERT INTO public.entrada_stock (sku, label, stock)
VALUES
  ('camiseta_baby_P',  'Babylook P',  0),
  ('camiseta_baby_M',  'Babylook M',  0),
  ('camiseta_baby_G',  'Babylook G',  0),
  ('camiseta_baby_GG', 'Babylook GG', 0),
  ('camiseta_infantil_02', 'Infantil 02 anos', 0),
  ('camiseta_infantil_04', 'Infantil 04 anos', 0),
  ('camiseta_infantil_06', 'Infantil 06 anos', 0),
  ('camiseta_infantil_08', 'Infantil 08 anos', 0),
  ('camiseta_infantil_10', 'Infantil 10 anos', 0)
ON CONFLICT (sku) DO NOTHING;

-- 4) Normaliza ref_code existentes e cria trigger para padronização
UPDATE public.sellers SET ref_code = upper(trim(ref_code))
 WHERE ref_code <> upper(trim(ref_code));

CREATE OR REPLACE FUNCTION public.sellers_normalize_ref_code()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ref_code IS NOT NULL THEN
    NEW.ref_code := upper(trim(NEW.ref_code));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sellers_normalize_ref_code ON public.sellers;
CREATE TRIGGER trg_sellers_normalize_ref_code
  BEFORE INSERT OR UPDATE ON public.sellers
  FOR EACH ROW EXECUTE FUNCTION public.sellers_normalize_ref_code();

-- 5) Corrige validate_referral_code para ser tolerante (case-insensitive)
CREATE OR REPLACE FUNCTION public.validate_referral_code(_code text)
RETURNS TABLE(name text, ref_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.name, s.ref_code FROM public.sellers s
  WHERE s.ref_code ILIKE trim(_code)
  ORDER BY s.created_at ASC
  LIMIT 1;
$$;

-- 6) Atualiza admin_refund_entrada_order considerando model
CREATE OR REPLACE FUNCTION public.admin_refund_entrada_order(_order_id uuid)
 RETURNS TABLE(order_id uuid, previous_status text, new_status text, restocked boolean)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _ord public.entrada_orders%ROWTYPE;
  _restocked boolean := false;
  _shirt_sku text;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO _ord FROM public.entrada_orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found' USING ERRCODE = 'P0002'; END IF;
  IF _ord.status NOT IN ('paid','pending') THEN
    RAISE EXCEPTION 'invalid_status: %', _ord.status USING ERRCODE = '22023';
  END IF;

  IF _ord.status = 'paid' THEN
    UPDATE public.entrada_stock SET stock = stock + _ord.quantity, updated_at = now()
      WHERE sku = 'pulseira';
    IF _ord.product = 'kit' AND _ord.size IS NOT NULL THEN
      _shirt_sku := 'camiseta_' || COALESCE(NULLIF(_ord.model,''),'adulto') || '_' || _ord.size;
      UPDATE public.entrada_stock SET stock = stock + _ord.quantity, updated_at = now()
        WHERE sku = _shirt_sku;
    END IF;
    _restocked := true;
  END IF;

  UPDATE public.entrada_orders
     SET status = 'refunded', updated_at = now()
   WHERE id = _order_id;

  RETURN QUERY SELECT _order_id, _ord.status, 'refunded'::text, _restocked;
END;
$function$;

-- 7) Nova RPC: admin vincula manualmente revendedor a um pedido /entrada
CREATE OR REPLACE FUNCTION public.admin_set_entrada_order_seller(_order_id uuid, _ref_code text)
RETURNS TABLE(order_id uuid, seller_id uuid, referral_label text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_seller_id uuid;
  v_name text;
  v_ref text;
  v_label text;
  v_code text := trim(coalesce(_ref_code,''));
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF v_code = '' THEN
    UPDATE public.entrada_orders
       SET seller_id = NULL, referral_label = NULL, updated_at = now()
     WHERE id = _order_id;
    order_id := _order_id; seller_id := NULL; referral_label := NULL;
    RETURN NEXT; RETURN;
  END IF;

  SELECT s.id, s.name, s.ref_code INTO v_seller_id, v_name, v_ref
    FROM public.sellers s
   WHERE s.ref_code ILIKE v_code
   LIMIT 1;

  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'seller_not_found' USING ERRCODE = 'P0002';
  END IF;

  v_label := v_name || ' (' || v_ref || ')';
  UPDATE public.entrada_orders
     SET seller_id = v_seller_id, referral_label = v_label, updated_at = now()
   WHERE id = _order_id;

  order_id := _order_id; seller_id := v_seller_id; referral_label := v_label;
  RETURN NEXT;
END;
$$;

-- 8) Atualiza admin_list_entrada_orders já está com SELECT * — pegará novas colunas automaticamente.
