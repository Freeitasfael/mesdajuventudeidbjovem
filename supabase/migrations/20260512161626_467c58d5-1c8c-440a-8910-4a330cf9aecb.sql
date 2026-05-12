
-- ================================
-- SELLER SELF-SERVICE
-- ================================

-- Returns the seller record for the currently authenticated user (if any)
CREATE OR REPLACE FUNCTION public.get_my_seller()
RETURNS TABLE(id uuid, name text, ref_code text, phone text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, s.name, s.ref_code, s.phone, s.created_at
  FROM public.sellers s
  WHERE s.user_id = auth.uid()
  LIMIT 1;
$$;

-- Stats for the current logged-in seller
CREATE OR REPLACE FUNCTION public.get_my_seller_stats()
RETURNS TABLE(
  total_orders bigint,
  paid_orders bigint,
  pending_orders bigint,
  total_numbers_paid bigint,
  total_revenue_cents bigint,
  pending_revenue_cents bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid;
BEGIN
  SELECT id INTO v_seller_id FROM public.sellers WHERE user_id = auth.uid() LIMIT 1;
  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Não é vendedor' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS total_orders,
    COUNT(*) FILTER (WHERE o.status = 'paid')::bigint AS paid_orders,
    COUNT(*) FILTER (WHERE o.status = 'pending')::bigint AS pending_orders,
    COALESCE(SUM(
      CASE WHEN o.status = 'paid' THEN
        (SELECT count(*) FROM public.order_numbers onm WHERE onm.order_id = o.id)
      ELSE 0 END
    ), 0)::bigint AS total_numbers_paid,
    COALESCE(SUM(o.total_cents) FILTER (WHERE o.status = 'paid'), 0)::bigint AS total_revenue_cents,
    COALESCE(SUM(o.total_cents) FILTER (WHERE o.status = 'pending'), 0)::bigint AS pending_revenue_cents
  FROM public.orders o
  WHERE o.seller_id = v_seller_id;
END;
$$;

-- Detailed list of orders for the current logged-in seller
CREATE OR REPLACE FUNCTION public.get_my_seller_orders()
RETURNS TABLE(
  order_id uuid,
  status text,
  total_cents int,
  created_at timestamptz,
  expires_at timestamptz,
  buyer_name text,
  buyer_phone text,
  numbers int[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seller_id uuid;
BEGIN
  SELECT id INTO v_seller_id FROM public.sellers WHERE user_id = auth.uid() LIMIT 1;
  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Não é vendedor' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.status,
    o.total_cents,
    o.created_at,
    o.expires_at,
    b.name,
    b.phone,
    COALESCE(
      (SELECT array_agg(onm.number ORDER BY onm.number)
         FROM public.order_numbers onm WHERE onm.order_id = o.id),
      ARRAY[]::int[]
    )
  FROM public.orders o
  JOIN public.buyers b ON b.id = o.buyer_id
  WHERE o.seller_id = v_seller_id
  ORDER BY o.created_at DESC
  LIMIT 500;
END;
$$;

-- Self-registration as seller (idempotent). Generates unique ref_code.
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
  v_attempts int := 0;
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

  -- If already a seller, just return existing
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

  -- Generate unique ref_code (8 chars, retry on collision)
  LOOP
    v_attempts := v_attempts + 1;
    v_ref := upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 8));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.sellers WHERE ref_code = v_ref);
    IF v_attempts > 8 THEN
      RAISE EXCEPTION 'Não foi possível gerar código único, tente novamente';
    END IF;
  END LOOP;

  INSERT INTO public.sellers (user_id, name, phone, ref_code)
  VALUES (v_uid, v_clean_name, v_clean_phone, v_ref)
  RETURNING sellers.id INTO v_new_id;

  id := v_new_id;
  ref_code := v_ref;
  name := v_clean_name;
  RETURN NEXT;
END;
$$;

-- ================================
-- ADMIN ACTIONS
-- ================================

-- List recent orders with payment + buyer info for admin UI
CREATE OR REPLACE FUNCTION public.admin_list_orders(_limit int DEFAULT 100)
RETURNS TABLE(
  order_id uuid,
  status text,
  total_cents int,
  created_at timestamptz,
  expires_at timestamptz,
  buyer_name text,
  buyer_phone text,
  seller_name text,
  numbers int[],
  payment_id uuid,
  provider_payment_id text,
  payment_status text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.status,
    o.total_cents,
    o.created_at,
    o.expires_at,
    b.name,
    b.phone,
    s.name,
    COALESCE(
      (SELECT array_agg(onm.number ORDER BY onm.number)
         FROM public.order_numbers onm WHERE onm.order_id = o.id),
      ARRAY[]::int[]
    ),
    p.id,
    p.provider_payment_id,
    p.status
  FROM public.orders o
  JOIN public.buyers b ON b.id = o.buyer_id
  LEFT JOIN public.sellers s ON s.id = o.seller_id
  LEFT JOIN LATERAL (
    SELECT pp.id, pp.provider_payment_id, pp.status
      FROM public.payments pp
     WHERE pp.order_id = o.id
     ORDER BY pp.created_at DESC
     LIMIT 1
  ) p ON true
  ORDER BY o.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
END;
$$;

-- Free a single number manually (cancels related pending order if any)
CREATE OR REPLACE FUNCTION public.admin_free_number(_number int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;

  SELECT order_id INTO v_order_id
    FROM public.numbers
   WHERE number = _number
   FOR UPDATE;

  UPDATE public.numbers
     SET status = 'available', reserved_at = NULL, order_id = NULL
   WHERE number = _number;

  IF v_order_id IS NOT NULL THEN
    UPDATE public.orders
       SET status = 'cancelled'
     WHERE id = v_order_id AND status = 'pending';
    UPDATE public.payments
       SET status = 'cancelled'
     WHERE order_id = v_order_id AND status = 'pending';
  END IF;
END;
$$;
