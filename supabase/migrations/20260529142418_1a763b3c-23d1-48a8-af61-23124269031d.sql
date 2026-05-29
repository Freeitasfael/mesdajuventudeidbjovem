
-- 1) Configuração pública de preços do /entrada
INSERT INTO public.app_settings (key, value, updated_at)
VALUES ('entrada_prices', '{"pulseira_cents": 1500, "kit_cents": 6000}'::jsonb, now())
ON CONFLICT (key) DO NOTHING;

-- Permitir leitura pública dessa chave
DROP POLICY IF EXISTS "Public can view public settings" ON public.app_settings;
CREATE POLICY "Public can view public settings"
ON public.app_settings
FOR SELECT
TO anon, authenticated
USING (key = ANY (ARRAY[
  'raffle_title',
  'price_per_number_cents',
  'hero_prizes',
  'hero_stats',
  'hero_media',
  'entrada_prices'
]));

-- 2) Função para listar admins
CREATE OR REPLACE FUNCTION public.admin_list_admins()
RETURNS TABLE(user_id uuid, email text, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT ur.user_id, u.email::text, ur.created_at
      FROM public.user_roles ur
      JOIN auth.users u ON u.id = ur.user_id
     WHERE ur.role = 'admin'::app_role
     ORDER BY ur.created_at DESC;
END;
$$;

-- 3) Função para adicionar admin pelo email
CREATE OR REPLACE FUNCTION public.admin_add_admin_by_email(_email text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_uid uuid;
  v_email text := lower(trim(coalesce(_email, '')));
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF length(v_email) < 3 OR v_email !~ '@' THEN
    RAISE EXCEPTION 'Email inválido';
  END IF;

  SELECT id INTO v_uid FROM auth.users WHERE lower(email) = v_email LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado. Peça para se cadastrar primeiro.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'admin'::app_role) THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'admin'::app_role);
  END IF;
  RETURN v_uid;
END;
$$;

-- 4) Função para remover admin
CREATE OR REPLACE FUNCTION public.admin_remove_admin(_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Você não pode remover a si mesmo';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'::app_role;
END;
$$;
