-- Fix EXPOSED_SENSITIVE_DATA: Hide email from hospitals table for public access
-- The search_hospitals function already excludes email, but direct table access still exposes it

-- 1. Revoke email column access from anon role on hospitals
REVOKE SELECT (email) ON public.hospitals FROM anon;

-- 2. Create a public hospitals view without email for anonymous access
CREATE OR REPLACE VIEW public.public_hospitals
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  address,
  city,
  state,
  phone,  -- Keep phone as it's needed for appointment confirmation
  pincode,
  description,
  specialties,
  facilities,
  images,
  latitude,
  longitude,
  rating,
  total_reviews,
  status,
  created_at,
  updated_at
FROM public.hospitals
WHERE status IS DISTINCT FROM 'inactive';

-- 3. Grant access to the public view
GRANT SELECT ON public.public_hospitals TO anon, authenticated;

-- 4. For doctors, ensure email is truly hidden by updating the RLS policy
-- Drop existing policy and create one that excludes email access for anon
DROP POLICY IF EXISTS "Anyone can view public doctors" ON public.doctors;

-- Create RLS policy that allows viewing doctors but we'll use column-level security
CREATE POLICY "Anyone can view public doctors"
ON public.doctors
FOR SELECT
TO anon, authenticated
USING (
  (is_public IS NOT FALSE) 
  AND (availability_status IS DISTINCT FROM 'inactive')
);

-- 5. Ensure email column is revoked from both roles on doctors
REVOKE SELECT (email) ON public.doctors FROM anon;
REVOKE SELECT (email) ON public.doctors FROM authenticated;

-- 6. Update public_doctors view to explicitly exclude email
DROP VIEW IF EXISTS public.public_doctors;
CREATE VIEW public.public_doctors
WITH (security_invoker = on) AS
SELECT 
  id,
  name,
  specialization,
  qualification,
  experience,
  consultation_fee,
  rating,
  total_reviews,
  availability_status,
  photo,
  about,
  education,
  languages,
  hospital_id,
  created_at,
  updated_at
FROM public.doctors
WHERE (is_public IS NOT FALSE) 
  AND (availability_status IS DISTINCT FROM 'inactive');

-- 7. Grant access to updated public_doctors view
GRANT SELECT ON public.public_doctors TO anon, authenticated;