
-- Restrict public read of public.numbers to non-sensitive columns only (hide order_id and reserved_at)
REVOKE SELECT ON public.numbers FROM anon, authenticated;
GRANT SELECT (number, status) ON public.numbers TO anon, authenticated;
GRANT ALL ON public.numbers TO service_role;

-- Remove public read on vsl-videos storage objects; only admins (existing policy) may read
DROP POLICY IF EXISTS "vsl-videos public read" ON storage.objects;
