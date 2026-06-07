-- Fix 1: Restrict entrada_orders SELECT to admins only.
-- Public/buyer access is served via the entrada-status edge function (service role).
DROP POLICY IF EXISTS "Public can view entrada order by id" ON public.entrada_orders;

CREATE POLICY "Admins can read entrada orders"
ON public.entrada_orders
FOR SELECT
TO authenticated
USING (private.has_role(auth.uid(), 'admin'::public.app_role));

-- Revoke anon SELECT grant (no policy allows it anyway, but tighten privileges)
REVOKE SELECT ON public.entrada_orders FROM anon;

-- Fix 2: Add DELETE/UPDATE storage policies for the manual-sale-receipts bucket.
CREATE POLICY "Admins can delete manual sale receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'manual-sale-receipts'
  AND private.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Admins can update manual sale receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'manual-sale-receipts'
  AND private.has_role(auth.uid(), 'admin'::public.app_role)
)
WITH CHECK (
  bucket_id = 'manual-sale-receipts'
  AND private.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "Resellers can delete own manual sale receipt"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'manual-sale-receipts'
  AND owner = auth.uid()
);