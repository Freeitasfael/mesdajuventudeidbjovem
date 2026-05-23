
-- Sequence for IDB codes
CREATE SEQUENCE IF NOT EXISTS public.seller_ref_seq START 1;

-- Seed sequence past any existing numeric IDB codes so we never collide
SELECT setval(
  'public.seller_ref_seq',
  GREATEST(
    (SELECT COALESCE(MAX((substring(ref_code from 4))::int), 0)
       FROM public.sellers
      WHERE ref_code ~ '^IDB[0-9]+$'),
    0
  ) + 1,
  false
);

-- Helper: next unique IDB code
CREATE OR REPLACE FUNCTION public.next_seller_ref_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n bigint;
  v_code text;
  v_attempts int := 0;
BEGIN
  LOOP
    v_attempts := v_attempts + 1;
    v_n := nextval('public.seller_ref_seq');
    v_code := 'IDB' || lpad(v_n::text, 3, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.sellers WHERE ref_code = v_code);
    IF v_attempts > 50 THEN
      RAISE EXCEPTION 'Não foi possível gerar código IDB único';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;

-- Update ensure_my_seller to use IDB codes
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

  SELECT coalesce(
           NULLIF(trim(u.raw_user_meta_data->>'full_name'), ''),
           NULLIF(trim(u.raw_user_meta_data->>'name'), ''),
           split_part(u.email, '@', 1)
         )
    INTO v_name
    FROM auth.users u
   WHERE u.id = v_uid;

  IF v_name IS NULL OR length(v_name) = 0 THEN
    v_name := 'Revendedor';
  END IF;

  v_ref := public.next_seller_ref_code();

  INSERT INTO public.sellers (user_id, name, ref_code)
  VALUES (v_uid, v_name, v_ref)
  RETURNING sellers.id INTO v_new_id;

  id := v_new_id; ref_code := v_ref; name := v_name;
  RETURN NEXT;
END;
$$;

-- Update register_seller_self to use IDB codes
CREATE OR REPLACE FUNCTION public.register_seller_self(_name text, _phone text)
RETURNS TABLE(id uuid, ref_code text, name text)
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
  v_clean_name text := trim(coalesce(_name, ''));
  v_clean_phone text := regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Login obrigatório' USING ERRCODE = '42501';
  END IF;

  IF length(v_clean_name) < 3 OR array_length(string_to_array(v_clean_name, ' '), 1) < 2 THEN
    RAISE EXCEPTION 'Nome deve conter pelo menos 2 palavras';
  END IF;

  IF v_clean_phone !~ '^[0-9]{10,11}$' THEN
    RAISE EXCEPTION 'Telefone deve conter 10 ou 11 dígitos';
  END IF;

  SELECT s.id, s.ref_code, s.name
    INTO v_existing_id, v_existing_ref, v_existing_name
  FROM public.sellers s
  WHERE s.user_id = v_uid
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    id := v_existing_id;
    ref_code := v_existing_ref;
    name := v_existing_name;
    RETURN NEXT;
    RETURN;
  END IF;

  v_ref := public.next_seller_ref_code();

  INSERT INTO public.sellers (user_id, name, phone, ref_code)
  VALUES (v_uid, v_clean_name, v_clean_phone, v_ref)
  RETURNING sellers.id INTO v_new_id;

  id := v_new_id;
  ref_code := v_ref;
  name := v_clean_name;
  RETURN NEXT;
END;
$$;
