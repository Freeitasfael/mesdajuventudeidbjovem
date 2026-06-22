-- 1) Hide internal order_id column on public.numbers from client roles.
-- Admins read via SECURITY DEFINER functions, so anon/authenticated never need this column directly.
REVOKE SELECT (order_id) ON public.numbers FROM anon;
REVOKE SELECT (order_id) ON public.numbers FROM authenticated;

-- 2) Tighten the sellers' realtime subscription policy to exact known topic patterns
-- instead of a broad "seller-<id>-%" wildcard.
DROP POLICY IF EXISTS "Sellers can subscribe to realtime" ON realtime.messages;

CREATE POLICY "Sellers can subscribe to realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.sellers s
    WHERE s.user_id = auth.uid()
      AND (
        realtime.topic() = 'seller-orders-' || s.id::text
        OR realtime.topic() LIKE 'seller-' || s.id::text || '-order-%'
      )
  )
);