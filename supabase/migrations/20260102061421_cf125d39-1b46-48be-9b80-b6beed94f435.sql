-- The doctors table should only be accessible for internal function use (like is_doctor_for_appointment)
-- Regular users should use the doctors_public view which excludes email
-- Since security definer functions bypass RLS, we can make the doctors table more restrictive

-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Authenticated users can view doctors" ON public.doctors;

-- Create a more restrictive policy - only allow authenticated users to see their own doctor record
-- (This is for doctors who need to see their own profile)
CREATE POLICY "Doctors can view their own record"
ON public.doctors
FOR SELECT
TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Ensure the doctors_public view (which excludes email) is still accessible
-- (Already granted in previous migration)