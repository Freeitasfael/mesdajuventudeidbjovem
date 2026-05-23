ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS referral_label text;
NOTIFY pgrst, 'reload schema';