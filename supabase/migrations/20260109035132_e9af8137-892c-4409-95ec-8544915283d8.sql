-- Drop the incorrect policies
DROP POLICY IF EXISTS "Doctors can view their own record" ON public.doctors;
DROP POLICY IF EXISTS "anon_select_public_doctors" ON public.doctors;

-- Create a proper policy that allows anyone to view public doctors
CREATE POLICY "Anyone can view public doctors"
ON public.doctors
FOR SELECT
TO anon, authenticated
USING (is_public IS NOT FALSE);