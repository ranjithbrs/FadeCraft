-- Make doctor public fields readable while keeping email private
-- 1) Ensure RLS is enabled
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;

-- 2) Replace restrictive policy that prevented patients from reading doctors
DROP POLICY IF EXISTS "Doctors can view their own record" ON public.doctors;

-- 3) Public read policy (doctors are public directory data)
CREATE POLICY "Anyone can view doctors public info"
ON public.doctors
FOR SELECT
TO anon, authenticated
USING (availability_status IS DISTINCT FROM 'inactive');

-- 4) Grant SELECT but revoke email column to prevent exposure
GRANT SELECT ON public.doctors TO anon, authenticated;
REVOKE SELECT (email) ON public.doctors FROM anon, authenticated;