-- Remove the overly permissive public access policies on doctors table
DROP POLICY IF EXISTS "Public can view non-sensitive doctor info via view" ON public.doctors;
DROP POLICY IF EXISTS "Authenticated users can view doctors" ON public.doctors;

-- Create a policy that only allows authenticated users to view doctors table directly
CREATE POLICY "Authenticated users can view doctors"
ON public.doctors
FOR SELECT
TO authenticated
USING (true);

-- Ensure the doctors_public view is accessible to anon users (view already excludes email)
-- Grant SELECT on the view to anon role
GRANT SELECT ON public.doctors_public TO anon;
GRANT SELECT ON public.doctors_public TO authenticated;