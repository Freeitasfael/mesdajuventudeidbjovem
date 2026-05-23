
REVOKE EXECUTE ON FUNCTION public.reserve_numbers(uuid, integer[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.expire_reservations() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.confirm_payment(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_list_orders(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_free_number(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_seller_ranking() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_seller() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_seller_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_seller_orders() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_seller_order(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.register_seller_self(text, text) FROM PUBLIC;

-- Grant back to authenticated where needed
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_orders(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_free_number(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_ranking() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_seller() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_seller_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_seller_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_seller_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_seller_self(text, text) TO authenticated;
-- reserve_numbers, expire_reservations, confirm_payment stay service-role only
