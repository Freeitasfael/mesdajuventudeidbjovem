ALTER TABLE public.sellers
  ADD COLUMN IF NOT EXISTS church text,
  ADD COLUMN IF NOT EXISTS neighborhood text;

DROP FUNCTION IF EXISTS public.register_seller_self(text, text);
DROP FUNCTION IF EXISTS public.register_seller_self(text, text, text, text);
DROP FUNCTION IF EXISTS public.get_my_seller();

CREATE OR REPLACE FUNCTION public.register_seller_self(
  _name text,
  _phone text,
  _church text DEFAULT NULL,
  _neighborhood text DEFAULT NULL
)
RETURNS TABLE(id uuid, ref_code text, name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_existing_id uuid;
  v_existing_ref text;
  v_new_id uuid;
  v_ref text;
  v_clean_name text := trim(coalesce(_name, ''));
  v_clean_phone text := regexp_replace(coalesce(_phone, ''), '\D', '', 'g');
  v_church text := nullif(trim(coalesce(_church, '')), '');
  v_neigh text := nullif(trim(coalesce(_neighborhood, '')), '');
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

  SELECT s.id, s.ref_code INTO v_existing_id, v_existing_ref
  FROM public.sellers s WHERE s.user_id = v_uid LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.sellers
       SET name = v_clean_name,
           phone = v_clean_phone,
           church = COALESCE(v_church, church),
           neighborhood = COALESCE(v_neigh, neighborhood)
     WHERE id = v_existing_id;
    id := v_existing_id; ref_code := v_existing_ref; name := v_clean_name;
    RETURN NEXT; RETURN;
  END IF;

  v_ref := public.next_seller_ref_code();
  INSERT INTO public.sellers (user_id, name, phone, ref_code, church, neighborhood)
  VALUES (v_uid, v_clean_name, v_clean_phone, v_ref, v_church, v_neigh)
  RETURNING sellers.id INTO v_new_id;

  id := v_new_id; ref_code := v_ref; name := v_clean_name;
  RETURN NEXT;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.register_seller_self(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_seller_self(text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_seller()
RETURNS TABLE(id uuid, name text, ref_code text, phone text, church text, neighborhood text, created_at timestamp with time zone)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT s.id, s.name, s.ref_code, s.phone, s.church, s.neighborhood, s.created_at
  FROM public.sellers s WHERE s.user_id = auth.uid() LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.validate_referral_code(_code text)
RETURNS TABLE(name text, ref_code text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT s.name, s.ref_code FROM public.sellers s
  WHERE s.ref_code = upper(trim(_code)) LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.validate_referral_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO anon, authenticated;