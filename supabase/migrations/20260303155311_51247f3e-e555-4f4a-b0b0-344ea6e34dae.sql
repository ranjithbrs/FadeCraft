
-- Create a security definer function to check if current user is a doctor for a given appointment
CREATE OR REPLACE FUNCTION public.is_current_user_doctor_for(p_doctor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.doctors d
    WHERE d.id = p_doctor_id
      AND d.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
$$;

-- Drop the broken policy
DROP POLICY IF EXISTS "Authenticated can view appointments" ON public.appointments;

-- Recreate with security definer function (no direct auth.users access)
CREATE POLICY "Authenticated can view appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_current_user_doctor_for(doctor_id)
);

-- Enable realtime for appointments table
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;
