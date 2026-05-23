CREATE OR REPLACE FUNCTION public.next_seller_ref_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_attempts int := 0;
  chars text := '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
BEGIN
  LOOP
    v_attempts := v_attempts + 1;
    v_code := 'IDB' || 
              substr(chars, 1 + floor(random() * 36)::int, 1) ||
              substr(chars, 1 + floor(random() * 36)::int, 1) ||
              substr(chars, 1 + floor(random() * 36)::int, 1);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.sellers WHERE ref_code = v_code);
    IF v_attempts > 50 THEN
      RAISE EXCEPTION 'Não foi possível gerar código IDB único';
    END IF;
  END LOOP;
  RETURN v_code;
END;
$$;