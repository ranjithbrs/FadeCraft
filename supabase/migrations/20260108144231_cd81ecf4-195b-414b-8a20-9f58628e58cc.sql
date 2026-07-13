-- Remove anon access to reviews_ratings base table (user_id exposure)
-- All public access should go through public_reviews view which excludes user_id
DROP POLICY IF EXISTS "Public reviews visible through view" ON public.reviews_ratings;

-- Ensure the public_reviews view is the ONLY way to access reviews publicly
-- The view already excludes user_id, so this is safe

-- For the view to work for anon users, we need to use SECURITY DEFINER
-- Recreate the view as SECURITY DEFINER so it can read from the base table
DROP VIEW IF EXISTS public.public_reviews;
CREATE VIEW public.public_reviews
WITH (security_invoker = false)
AS
SELECT 
  id,
  rating,
  review,
  doctor_id,
  hospital_id,
  created_at
FROM public.reviews_ratings
WHERE is_public = true;

-- Grant access to the view
GRANT SELECT ON public.public_reviews TO anon;
GRANT SELECT ON public.public_reviews TO authenticated;

-- Similarly for public_doctors - ensure it uses SECURITY DEFINER pattern
DROP VIEW IF EXISTS public.public_doctors;
CREATE VIEW public.public_doctors
WITH (security_invoker = false)
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
  about,
  education,
  languages,
  availability_status,
  created_at,
  updated_at
FROM public.doctors
WHERE is_public = true OR is_public IS NULL;

-- Grant access to the view
GRANT SELECT ON public.public_doctors TO anon;
GRANT SELECT ON public.public_doctors TO authenticated;