-- Allow admins to view all emergency alerts
CREATE POLICY "Admins can view all emergency alerts"
ON public.emergency_alerts
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Allow admins to update emergency alert status
CREATE POLICY "Admins can update emergency alerts"
ON public.emergency_alerts
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));