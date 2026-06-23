DROP POLICY IF EXISTS "Public can view public settings" ON public.app_settings;
CREATE POLICY "Public can view public settings" ON public.app_settings
  FOR SELECT USING (key = ANY (ARRAY[
    'raffle_title','price_per_number_cents','hero_prizes','hero_stats',
    'hero_media','entrada_prices','home_vsl_video_url','recap_gallery'
  ]));