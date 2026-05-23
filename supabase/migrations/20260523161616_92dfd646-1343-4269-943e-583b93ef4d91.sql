
ALTER TABLE public.numbers DROP CONSTRAINT IF EXISTS numbers_number_check;
ALTER TABLE public.numbers ADD CONSTRAINT numbers_number_check CHECK (number >= 1 AND number <= 600);
INSERT INTO public.numbers (number, status)
SELECT gs, 'available' FROM generate_series(401, 600) gs
ON CONFLICT (number) DO NOTHING;
