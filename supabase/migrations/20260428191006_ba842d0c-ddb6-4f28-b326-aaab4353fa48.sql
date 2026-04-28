-- Atomic reservation: locks rows, checks availability, marks as reserved.
-- Raises exception if any number is unavailable, rolling back the whole tx.
CREATE OR REPLACE FUNCTION public.reserve_numbers(_order_id uuid, _numbers int[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  unavailable int[];
BEGIN
  -- Lock requested rows in order to prevent deadlocks
  PERFORM 1 FROM public.numbers
   WHERE number = ANY(_numbers)
   ORDER BY number
   FOR UPDATE;

  -- Find any that aren't available
  SELECT array_agg(number ORDER BY number) INTO unavailable
    FROM public.numbers
   WHERE number = ANY(_numbers) AND status <> 'available';

  IF unavailable IS NOT NULL AND array_length(unavailable, 1) > 0 THEN
    RAISE EXCEPTION 'Números indisponíveis: %', unavailable
      USING ERRCODE = 'P0001';
  END IF;

  -- Mark as reserved
  UPDATE public.numbers
     SET status = 'reserved',
         reserved_at = now(),
         order_id = _order_id
   WHERE number = ANY(_numbers);

  -- Link order_numbers
  INSERT INTO public.order_numbers (order_id, number)
  SELECT _order_id, unnest(_numbers);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reserve_numbers(uuid, int[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_numbers(uuid, int[]) TO service_role;