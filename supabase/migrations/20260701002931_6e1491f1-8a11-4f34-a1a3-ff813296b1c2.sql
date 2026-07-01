ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS paid_date date,
  ADD COLUMN IF NOT EXISTS receipt_path text;

ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_status_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_status_check CHECK (status IN ('paid','scheduled'));