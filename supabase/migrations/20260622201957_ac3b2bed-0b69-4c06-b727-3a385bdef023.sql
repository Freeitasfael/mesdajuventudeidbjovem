DROP POLICY IF EXISTS "Public can view public settings" ON public.app_settings;
CREATE POLICY "Public can view public settings"
ON public.app_settings
FOR SELECT
USING (
  key = ANY (ARRAY[
    'raffle_title'::text,
    'price_per_number_cents'::text,
    'hero_prizes'::text,
    'hero_stats'::text,
    'hero_media'::text,
    'entrada_prices'::text,
    'home_vsl_video_url'::text
  ])
);