CREATE POLICY "vsl-videos admin insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'vsl-videos' AND private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "vsl-videos admin update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'vsl-videos' AND private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "vsl-videos admin delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'vsl-videos' AND private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "vsl-videos admin select"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'vsl-videos' AND private.has_role(auth.uid(), 'admin'::public.app_role));