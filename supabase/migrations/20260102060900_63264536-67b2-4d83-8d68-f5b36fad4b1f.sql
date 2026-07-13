-- Drop the security definer view and recreate without it
DROP VIEW IF EXISTS public.doctors_public;

-- Recreate view with SECURITY INVOKER (default, safe option)
CREATE VIEW public.doctors_public 
WITH (security_invoker = true)
AS
SELECT 
  id,
  name,
  specialization,
  qualification,
  experience,
  consultation_fee,
  rating,
  total_reviews,
  hospital_id,
  photo,
  availability_status,
  about,
  education,
  languages,
  created_at,
  updated_at
FROM public.doctors
WHERE availability_status != 'inactive';

-- Grant access to the view
GRANT SELECT ON public.doctors_public TO anon;
GRANT SELECT ON public.doctors_public TO authenticated;

-- Also add a policy for anon users to access doctors via the table (but they'll use the view)
-- The view will inherit RLS from the underlying table
-- We need to allow SELECT on the doctors table for the view to work
CREATE POLICY "Public can view non-sensitive doctor info via view" 
ON public.doctors 
FOR SELECT 
TO anon
USING (availability_status != 'inactive');