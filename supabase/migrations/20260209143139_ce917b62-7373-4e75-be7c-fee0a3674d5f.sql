-- Fix doctors: Change RESTRICTIVE policies to PERMISSIVE (OR logic)
DROP POLICY IF EXISTS "Anyone can view public doctors" ON public.doctors;
DROP POLICY IF EXISTS "Users can view doctors for their appointments" ON public.doctors;

CREATE POLICY "Anyone can view public doctors"
ON public.doctors FOR SELECT
TO public
USING (
  is_public IS NOT FALSE
  AND availability_status IS DISTINCT FROM 'inactive'
);

CREATE POLICY "Users can view doctors for their appointments"
ON public.doctors FOR SELECT
TO authenticated
USING (
  id IN (SELECT doctor_id FROM appointments WHERE user_id = auth.uid())
);

-- Fix appointments: Change RESTRICTIVE policies to PERMISSIVE (OR logic)
DROP POLICY IF EXISTS "appointments_select_authenticated" ON public.appointments;
DROP POLICY IF EXISTS "Doctors can view their queue" ON public.appointments;

CREATE POLICY "Users can view their own appointments"
ON public.appointments FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Doctors can view their queue"
ON public.appointments FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'doctor') 
  AND doctor_id IN (
    SELECT d.id FROM doctors d 
    WHERE d.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Fix hospitals: make publicly accessible (same pattern as doctors)
DROP POLICY IF EXISTS "Authenticated users can view hospitals" ON public.hospitals;

CREATE POLICY "Anyone can view active hospitals"
ON public.hospitals FOR SELECT
TO public
USING (status IS DISTINCT FROM 'inactive');