-- Allow sellers to SELECT their own orders / payments / order_numbers
-- This is required so realtime (postgres_changes) fires for them.

CREATE POLICY "Sellers can view their orders"
ON public.orders
FOR SELECT
TO authenticated
USING (
  seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
);

CREATE POLICY "Sellers can view payments for their orders"
ON public.payments
FOR SELECT
TO authenticated
USING (
  order_id IN (
    SELECT o.id FROM public.orders o
    WHERE o.seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
  )
);

CREATE POLICY "Sellers can view order_numbers for their orders"
ON public.order_numbers
FOR SELECT
TO authenticated
USING (
  order_id IN (
    SELECT o.id FROM public.orders o
    WHERE o.seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid())
  )
);

-- RPC: detalhes de UM pedido do vendedor (com PIX e números)
CREATE OR REPLACE FUNCTION public.get_my_seller_order(_order_id uuid)
RETURNS TABLE (
  order_id uuid,
  status text,
  total_cents int,
  created_at timestamptz,
  expires_at timestamptz,
  buyer_name text,
  buyer_phone text,
  numbers int[],
  payment_id uuid,
  payment_status text,
  qr_code text,
  qr_code_base64 text,
  provider_payment_id text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
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
    COALESCE((SELECT array_agg(n.number ORDER BY n.number)
              FROM public.order_numbers n WHERE n.order_id = o.id), ARRAY[]::int[]),
    p.id, p.status, p.qr_code, p.qr_code_base64, p.provider_payment_id
  FROM public.orders o
  JOIN public.buyers b ON b.id = o.buyer_id
  LEFT JOIN LATERAL (
    SELECT pp.id, pp.status, pp.qr_code, pp.qr_code_base64, pp.provider_payment_id
    FROM public.payments pp
    WHERE pp.order_id = o.id
    ORDER BY pp.created_at DESC
    LIMIT 1
  ) p ON true
  WHERE o.id = _order_id AND o.seller_id = v_seller_id;
END;
$$;