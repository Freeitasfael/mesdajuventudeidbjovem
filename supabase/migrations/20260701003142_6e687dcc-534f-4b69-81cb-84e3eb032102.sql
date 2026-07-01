ALTER TABLE public.sponsorships ADD COLUMN IF NOT EXISTS tier text;
ALTER TABLE public.sponsorships DROP CONSTRAINT IF EXISTS sponsorships_tier_check;
ALTER TABLE public.sponsorships ADD CONSTRAINT sponsorships_tier_check CHECK (tier IS NULL OR tier IN ('apoio','standard','premium'));