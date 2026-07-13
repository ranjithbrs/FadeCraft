-- Fix remaining EXPOSED_SENSITIVE_DATA error: Doctor emails still exposed
-- The issue is that RLS SELECT policy allows all columns - we need to deny direct access

-- 1. Drop existing permissive policy on doctors table for anon
DROP POLICY IF EXISTS "Anyone can view public doctors" ON public.doctors;

-- 2. Create a restrictive policy that denies direct SELECT for anon users
-- They must use the public_doctors view instead
CREATE POLICY "Authenticated users can view public doctors"
ON public.doctors
FOR SELECT
TO authenticated
USING (
  (is_public IS NOT FALSE) 
  AND (availability_status IS DISTINCT FROM 'inactive')
);

-- 3. For hospitals, also restrict direct table access for anon
-- Drop the existing public policy
DROP POLICY IF EXISTS "Anyone can view hospitals" ON public.hospitals;

-- 4. Create authenticated-only policy for hospitals direct access
CREATE POLICY "Authenticated users can view hospitals"
ON public.hospitals
FOR SELECT
TO authenticated
USING (status IS DISTINCT FROM 'inactive');

-- 5. Update public_doctors view to be accessible by anon
-- Already done, but ensure grants are correct
GRANT SELECT ON public.public_doctors TO anon, authenticated;

-- 6. Ensure public_hospitals view is accessible
GRANT SELECT ON public.public_hospitals TO anon, authenticated;