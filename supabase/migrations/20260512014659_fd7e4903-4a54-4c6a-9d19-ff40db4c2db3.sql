
CREATE TABLE public.payment_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  level TEXT NOT NULL DEFAULT 'info',
  event_type TEXT NOT NULL,
  order_id UUID,
  payment_id UUID,
  provider_payment_id TEXT,
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view payment events"
ON public.payment_events
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_payment_events_order ON public.payment_events(order_id);
CREATE INDEX idx_payment_events_payment ON public.payment_events(payment_id);
CREATE INDEX idx_payment_events_level_created ON public.payment_events(level, created_at DESC);
CREATE INDEX idx_payment_events_type_created ON public.payment_events(event_type, created_at DESC);
