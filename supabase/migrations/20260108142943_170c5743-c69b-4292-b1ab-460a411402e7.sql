-- Drop the SECURITY DEFINER view and recreate with SECURITY INVOKER
DROP VIEW IF EXISTS public.public_doctors;

CREATE VIEW public.public_doctors 
WITH (security_invoker = true)
AS
SELECT 
  id, name, specialization, qualification, experience,
  consultation_fee, rating, total_reviews, hospital_id,
  photo, availability_status, about, education, languages,
  created_at, updated_at
FROM public.doctors
WHERE availability_status != 'inactive';

-- Grant access to the view
GRANT SELECT ON public.public_doctors TO anon, authenticated;