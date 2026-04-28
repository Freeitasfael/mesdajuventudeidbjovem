-- Fix function search_path warnings
CREATE OR REPLACE FUNCTION public.validate_buyer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF array_length(string_to_array(trim(NEW.name), ' '), 1) < 2 THEN
    RAISE EXCEPTION 'Nome deve conter pelo menos 2 palavras';
  END IF;
  IF NEW.phone !~ '^[0-9]{10,11}$' THEN
    RAISE EXCEPTION 'Telefone deve conter apenas 10 ou 11 dígitos';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Restrict has_role execution to authenticated users and service_role only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;