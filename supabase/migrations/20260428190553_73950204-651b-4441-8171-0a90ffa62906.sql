-- =========================================
-- ENUMS
-- =========================================
CREATE TYPE public.app_role AS ENUM ('admin', 'seller');

-- =========================================
-- SELLERS
-- =========================================
CREATE TABLE public.sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  phone text,
  ref_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_sellers_ref_code ON public.sellers(ref_code);

-- =========================================
-- BUYERS
-- =========================================
CREATE TABLE public.buyers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Validation trigger for buyers (name >= 2 words, phone digits only)
CREATE OR REPLACE FUNCTION public.validate_buyer()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF array_length(string_to_array(trim(NEW.name), ' '), 1) < 2 THEN
    RAISE EXCEPTION 'Nome deve conter pelo menos 2 palavras';
  END IF;
  IF NEW.phone !~ '^[0-9]{10,11}$' THEN
    RAISE EXCEPTION 'Telefone deve conter apenas 10 ou 11 dígitos';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_buyer
  BEFORE INSERT OR UPDATE ON public.buyers
  FOR EACH ROW EXECUTE FUNCTION public.validate_buyer();

-- =========================================
-- ORDERS (created before numbers because numbers references it)
-- =========================================
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL REFERENCES public.buyers(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES public.sellers(id) ON DELETE SET NULL,
  total_cents int NOT NULL CHECK (total_cents > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','expired','cancelled')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_expires_at ON public.orders(expires_at);
CREATE INDEX idx_orders_seller ON public.orders(seller_id);

-- =========================================
-- NUMBERS (1..400)
-- =========================================
CREATE TABLE public.numbers (
  number int PRIMARY KEY CHECK (number BETWEEN 1 AND 400),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','paid')),
  reserved_at timestamptz,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_numbers_status ON public.numbers(status);

-- Seed 400 numbers
INSERT INTO public.numbers (number)
SELECT generate_series(1, 400);

-- =========================================
-- ORDER_NUMBERS
-- =========================================
CREATE TABLE public.order_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  number int NOT NULL REFERENCES public.numbers(number),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, number)
);
CREATE INDEX idx_order_numbers_order ON public.order_numbers(order_id);

-- =========================================
-- PAYMENTS
-- =========================================
CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'mercadopago',
  provider_payment_id text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','expired','refunded')),
  amount_cents int NOT NULL CHECK (amount_cents > 0),
  qr_code text,
  qr_code_base64 text,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_status ON public.payments(status);
CREATE INDEX idx_payments_provider_payment_id ON public.payments(provider_payment_id);
CREATE INDEX idx_payments_order ON public.payments(order_id);

-- =========================================
-- APP SETTINGS (key/value)
-- =========================================
CREATE TABLE public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (key, value) VALUES
  ('price_per_number_cents', '1000'::jsonb),
  ('raffle_title', '"Rifa Digital"'::jsonb);

-- =========================================
-- USER ROLES (with security definer to avoid recursive RLS)
-- =========================================
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- =========================================
-- updated_at trigger helper
-- =========================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_numbers_updated_at BEFORE UPDATE ON public.numbers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_app_settings_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- ROW LEVEL SECURITY
-- =========================================
ALTER TABLE public.sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- numbers: public read only (writes via edge functions w/ service role)
CREATE POLICY "Anyone can view numbers" ON public.numbers
  FOR SELECT USING (true);

-- sellers: public read (to validate ref_code in URL)
CREATE POLICY "Anyone can view sellers" ON public.sellers
  FOR SELECT USING (true);

-- app_settings: public read
CREATE POLICY "Anyone can view settings" ON public.app_settings
  FOR SELECT USING (true);

-- app_settings: only admins can update
CREATE POLICY "Admins can update settings" ON public.app_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert settings" ON public.app_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- user_roles: only admins can view/manage
CREATE POLICY "Admins can view roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- buyers / orders / order_numbers / payments:
-- No public policies → only service role (edge functions) can read/write.
-- Admins can read everything for the dashboard.
CREATE POLICY "Admins can view buyers" ON public.buyers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view orders" ON public.orders
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view order_numbers" ON public.order_numbers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view payments" ON public.payments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- =========================================
-- REALTIME for numbers
-- =========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.numbers;
ALTER TABLE public.numbers REPLICA IDENTITY FULL;