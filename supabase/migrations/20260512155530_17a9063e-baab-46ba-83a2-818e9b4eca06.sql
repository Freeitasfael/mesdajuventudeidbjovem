
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'hero-media',
  'hero-media',
  true,
  52428800,
  ARRAY['image/png','image/jpeg','image/webp','image/gif','video/mp4','video/webm','video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "hero-media public read" ON storage.objects;
CREATE POLICY "hero-media public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'hero-media');

DROP POLICY IF EXISTS "hero-media admin insert" ON storage.objects;
CREATE POLICY "hero-media admin insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'hero-media' AND private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "hero-media admin update" ON storage.objects;
CREATE POLICY "hero-media admin update"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'hero-media' AND private.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "hero-media admin delete" ON storage.objects;
CREATE POLICY "hero-media admin delete"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'hero-media' AND private.has_role(auth.uid(), 'admin'::app_role));
