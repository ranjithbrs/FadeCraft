-- Drop the overly permissive SELECT policy on doctors table
DROP POLICY IF EXISTS "Anyone can view doctors public info" ON public.doctors;

-- Create a new policy that only allows doctors to see their own record (with email)
CREATE POLICY "Doctors can view their own record"
ON public.doctors
FOR SELECT
TO authenticated
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- Add a policy to allow the search_doctors function to work (it's SECURITY DEFINER so it bypasses RLS)
-- The existing search_doctors function already excludes email from results

-- Grant SELECT on the doctors_public view to anon and authenticated users
-- This view already excludes the email column
GRANT SELECT ON public.doctors_public TO anon, authenticated;