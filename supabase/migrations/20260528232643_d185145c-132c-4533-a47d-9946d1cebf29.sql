-- Restrict sellers' realtime subscriptions to topics scoped to their own seller id
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
        OR realtime.topic() LIKE 'seller-' || s.id::text || '-%'
      )
  )
);