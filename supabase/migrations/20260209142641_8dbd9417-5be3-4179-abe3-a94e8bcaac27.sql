-- Allow unauthenticated (anon) users to view public, active doctors
DROP POLICY IF EXISTS "Authenticated users can view public doctors" ON public.doctors;

CREATE POLICY "Anyone can view public doctors"
ON public.doctors
FOR SELECT
USING (
  is_public IS NOT FALSE
  AND availability_status IS DISTINCT FROM 'inactive'
);