CREATE POLICY "Admins can insert alerts"
  ON public.admin_alerts FOR INSERT
  TO authenticated
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));