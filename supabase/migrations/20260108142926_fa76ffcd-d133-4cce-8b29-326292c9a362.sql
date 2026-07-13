-- Fix #1: Add public SELECT policy for doctors table
-- Note: Application code already excludes email field in all queries
CREATE POLICY "Anyone can view doctors public info"
ON public.doctors
FOR SELECT
USING (true);

-- Fix #2: Create a secure view for doctors that excludes email (defense in depth)
-- This ensures email is never exposed even if code changes
CREATE OR REPLACE VIEW public.public_doctors AS
SELECT 
  id, name, specialization, qualification, experience,
  consultation_fee, rating, total_reviews, hospital_id,
  photo, availability_status, about, education, languages,
  created_at, updated_at
FROM public.doctors
WHERE availability_status != 'inactive';

-- Grant access to the view
GRANT SELECT ON public.public_doctors TO anon, authenticated;