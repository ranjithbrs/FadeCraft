-- Drop the recursive policy that causes infinite loop
DROP POLICY IF EXISTS "Authenticated: view doctors via appointment" ON public.doctors;

-- The existing "Anyone can view public doctors" policy already handles public read access