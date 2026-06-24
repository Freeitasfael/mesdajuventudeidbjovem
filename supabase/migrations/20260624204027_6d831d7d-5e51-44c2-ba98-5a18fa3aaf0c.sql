CREATE POLICY "Home VSL videos are publicly readable"
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (
  bucket_id = 'vsl-videos'
  AND name LIKE 'home/%'
);