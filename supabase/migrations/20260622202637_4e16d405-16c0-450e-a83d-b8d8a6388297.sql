CREATE POLICY "vsl-videos public read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'vsl-videos');