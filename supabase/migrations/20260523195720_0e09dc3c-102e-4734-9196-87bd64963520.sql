
-- Revoke anon access on all SECURITY DEFINER functions; keep authenticated where appropriate.
REVOKE EXECUTE ON FUNCTION public.get_my_seller() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_seller_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_seller_order(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_seller_orders() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_manual_sales() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_my_seller() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.register_seller_self(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.register_my_manual_sale(text, text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_list_orders(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_free_number(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_refund_order(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_reset_all_data() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_seller_ranking() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_my_seller() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_seller_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_seller_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_seller_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_manual_sales() TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_my_seller() TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_seller_self(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_my_manual_sale(text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_orders(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_free_number(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_refund_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_all_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_seller_ranking() TO authenticated;
