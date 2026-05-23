
-- 1) manual_sales table
CREATE TABLE public.manual_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  buyer_name text NOT NULL,
  amount_cents integer,
  receipt_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_manual_sales_seller ON public.manual_sales(seller_id, created_at DESC);

ALTER TABLE public.manual_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sellers view own manual sales"
  ON public.manual_sales FOR SELECT
  TO authenticated
  USING (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));

CREATE POLICY "Sellers insert own manual sales"
  ON public.manual_sales FOR INSERT
  TO authenticated
  WITH CHECK (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()));

CREATE POLICY "Admins view all manual sales"
  ON public.manual_sales FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete manual sales"
  ON public.manual_sales FOR DELETE
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- 2) Private storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('manual-sale-receipts', 'manual-sale-receipts', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Reseller uploads own receipt"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'manual-sale-receipts'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Reseller reads own receipt"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'manual-sale-receipts'
    AND (
      auth.uid()::text = (storage.foldername(name))[1]
      OR private.has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- 3) Ensure current user has a seller profile (default everyone = reseller)
CREATE OR REPLACE FUNCTION public.ensure_my_seller()
RETURNS TABLE(id uuid, name text, ref_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing_id uuid;
  v_existing_ref text;
  v_existing_name text;
  v_new_id uuid;
  v_ref text;
  v_name text;
  v_email text;
  v_attempts int := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Login obrigatório' USING ERRCODE = '42501';
  END IF;

  SELECT s.id, s.ref_code, s.name
    INTO v_existing_id, v_existing_ref, v_existing_name
    FROM public.sellers s
   WHERE s.user_id = v_uid
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    id := v_existing_id; ref_code := v_existing_ref; name := v_existing_name;
    RETURN NEXT; RETURN;
  END IF;

  SELECT u.email,
         coalesce(
           NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
           NULLIF(trim(u.raw_user_meta_data->>'name'), ''),
           split_part(u.email, '@', 1)
         )
    INTO v_email, v_name
    FROM auth.users u
   WHERE u.id = v_uid;

  IF v_name IS NULL OR length(v_name) = 0 THEN
    v_name := 'Revendedor';
  END IF;

  LOOP
    v_attempts := v_attempts + 1;
    v_ref := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.sellers WHERE ref_code = v_ref);
    IF v_attempts > 8 THEN
      RAISE EXCEPTION 'Não foi possível gerar código único';
    END IF;
  END LOOP;

  INSERT INTO public.sellers (user_id, name, ref_code)
  VALUES (v_uid, v_name, v_ref)
  RETURNING sellers.id INTO v_new_id;

  id := v_new_id; ref_code := v_ref; name := v_name;
  RETURN NEXT;
END;
$$;

-- 4) Read current reseller's manual sales
CREATE OR REPLACE FUNCTION public.get_my_manual_sales()
RETURNS TABLE(id uuid, buyer_name text, amount_cents integer, receipt_path text, created_at timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid;
BEGIN
  SELECT s.id INTO v_seller_id FROM public.sellers s WHERE s.user_id = auth.uid() LIMIT 1;
  IF v_seller_id IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
    SELECT m.id, m.buyer_name, m.amount_cents, m.receipt_path, m.created_at
      FROM public.manual_sales m
     WHERE m.seller_id = v_seller_id
     ORDER BY m.created_at DESC;
END;
$$;

-- 5) Insert a manual sale for current reseller (requires receipt)
CREATE OR REPLACE FUNCTION public.register_my_manual_sale(
  _buyer_name text,
  _receipt_path text,
  _amount_cents integer DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid;
  v_id uuid;
  v_name text := trim(coalesce(_buyer_name, ''));
  v_path text := trim(coalesce(_receipt_path, ''));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Login obrigatório' USING ERRCODE = '42501';
  END IF;
  IF length(v_name) < 2 THEN
    RAISE EXCEPTION 'Informe o nome do comprador';
  END IF;
  IF length(v_path) = 0 THEN
    RAISE EXCEPTION 'Comprovante PIX é obrigatório';
  END IF;

  SELECT s.id INTO v_seller_id FROM public.sellers s WHERE s.user_id = auth.uid() LIMIT 1;
  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Cadastre-se como revendedor primeiro';
  END IF;

  INSERT INTO public.manual_sales (seller_id, buyer_name, receipt_path, amount_cents)
  VALUES (v_seller_id, v_name, v_path, _amount_cents)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
