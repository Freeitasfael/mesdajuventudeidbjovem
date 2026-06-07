ALTER TABLE public.buyers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.entrada_orders ADD COLUMN IF NOT EXISTS buyer_email text;