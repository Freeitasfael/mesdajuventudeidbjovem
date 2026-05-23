
-- Revoke public/anon/authenticated EXECUTE on SECURITY DEFINER functions
-- that should only be invoked from edge functions (service_role) or triggers.
REVOKE EXECUTE ON FUNCTION public.reserve_numbers(uuid, integer[]) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_payment(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_reservations() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.next_seller_ref_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_seller_by_ref(text) FROM PUBLIC, anon;

-- Keep authenticated access to get_seller_by_ref so logged-in users can validate
-- a referral code at checkout (returns only public seller name/code).
GRANT EXECUTE ON FUNCTION public.get_seller_by_ref(text) TO authenticated;
