ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notified_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_orders_notified_at ON public.orders(notified_at);