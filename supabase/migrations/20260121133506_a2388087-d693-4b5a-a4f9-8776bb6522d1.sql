-- Allow public read of doctors while keeping email protected via column privileges.
-- This fixes DoctorDetail showing "Doctor not found" for logged-out users.

-- Ensure RLS is enabled
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

-- Public read policy for doctors marked as public
DROP POLICY IF EXISTS "Anyone can view public doctors" ON public.doctors;
CREATE POLICY "Anyone can view public doctors"
ON public.doctors
FOR SELECT
TO anon, authenticated
USING (
  (is_public IS NOT FALSE)
  AND (availability_status IS DISTINCT FROM 'inactive')
);

-- Ensure anon/authenticated can read the safe views used by the app
GRANT SELECT ON public.public_doctors TO anon, authenticated;
GRANT SELECT ON public.public_reviews TO anon, authenticated;

-- Defense-in-depth: prevent anon/authenticated from selecting the sensitive email column
REVOKE SELECT (email) ON public.doctors FROM anon, authenticated;