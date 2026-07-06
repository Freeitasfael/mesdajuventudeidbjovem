
CREATE OR REPLACE FUNCTION public.admin_dashboard_consistency_check()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_result jsonb;
  v_rifa_paid_orders int;
  v_rifa_paid_revenue bigint;
  v_rifa_refunded_orders int;
  v_rifa_refunded_revenue bigint;
  v_rifa_numbers_paid int;
  v_rifa_numbers_in_paid_orders int;
  v_rifa_refunded_still_holding int;
  v_payment_mismatch int;
  v_amount_mismatch int;
  v_ent_paid_orders int;
  v_ent_paid_revenue bigint;
  v_ent_refunded_orders int;
  v_ent_refunded_revenue bigint;
  v_ent_refunded_in_paid boolean := false;
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  -- RIFA
  SELECT COUNT(*), COALESCE(SUM(total_cents), 0) INTO v_rifa_paid_orders, v_rifa_paid_revenue
    FROM public.orders WHERE status = 'paid';
  SELECT COUNT(*), COALESCE(SUM(total_cents), 0) INTO v_rifa_refunded_orders, v_rifa_refunded_revenue
    FROM public.orders WHERE status = 'refunded';

  SELECT COUNT(*) INTO v_rifa_numbers_paid FROM public.numbers WHERE status = 'paid';
  SELECT COUNT(*) INTO v_rifa_numbers_in_paid_orders
    FROM public.order_numbers onm JOIN public.orders o ON o.id = onm.order_id WHERE o.status = 'paid';

  -- Refunded orders that still hold non-available numbers
  SELECT COUNT(*) INTO v_rifa_refunded_still_holding
    FROM public.numbers n
    JOIN public.orders o ON o.id = n.order_id
   WHERE o.status = 'refunded' AND n.status <> 'available';

  -- Payments whose latest status doesn't match the order status (paid<->paid, refunded<->refunded)
  SELECT COUNT(*) INTO v_payment_mismatch
    FROM public.orders o
    JOIN LATERAL (
      SELECT status FROM public.payments p WHERE p.order_id = o.id ORDER BY created_at DESC LIMIT 1
    ) lp ON true
   WHERE (o.status = 'paid' AND lp.status NOT IN ('paid','approved'))
      OR (o.status = 'refunded' AND lp.status NOT IN ('refunded'));

  -- Amount mismatch between order total and latest payment amount
  SELECT COUNT(*) INTO v_amount_mismatch
    FROM public.orders o
    JOIN LATERAL (
      SELECT amount_cents FROM public.payments p WHERE p.order_id = o.id ORDER BY created_at DESC LIMIT 1
    ) lp ON true
   WHERE o.status IN ('paid','refunded') AND lp.amount_cents <> o.total_cents;

  -- ENTRADA
  SELECT COUNT(*), COALESCE(SUM(total_cents), 0) INTO v_ent_paid_orders, v_ent_paid_revenue
    FROM public.entrada_orders WHERE status = 'paid';
  SELECT COUNT(*), COALESCE(SUM(total_cents), 0) INTO v_ent_refunded_orders, v_ent_refunded_revenue
    FROM public.entrada_orders WHERE status = 'refunded';

  v_result := jsonb_build_object(
    'generated_at', now(),
    'rifa', jsonb_build_object(
      'paid_orders', v_rifa_paid_orders,
      'paid_revenue_cents', v_rifa_paid_revenue,
      'refunded_orders', v_rifa_refunded_orders,
      'refunded_revenue_cents', v_rifa_refunded_revenue,
      'numbers_status_paid', v_rifa_numbers_paid,
      'numbers_linked_to_paid_orders', v_rifa_numbers_in_paid_orders,
      'refunded_orders_still_holding_numbers', v_rifa_refunded_still_holding,
      'payments_status_mismatch', v_payment_mismatch,
      'payments_amount_mismatch', v_amount_mismatch
    ),
    'entrada', jsonb_build_object(
      'paid_orders', v_ent_paid_orders,
      'paid_revenue_cents', v_ent_paid_revenue,
      'refunded_orders', v_ent_refunded_orders,
      'refunded_revenue_cents', v_ent_refunded_revenue
    ),
    'divergences', jsonb_build_object(
      'numbers_vs_paid_orders', (v_rifa_numbers_paid <> v_rifa_numbers_in_paid_orders),
      'refunded_holding_numbers', (v_rifa_refunded_still_holding > 0),
      'payments_status_mismatch', (v_payment_mismatch > 0),
      'payments_amount_mismatch', (v_amount_mismatch > 0)
    )
  );

  RETURN v_result;
END;
$$;
