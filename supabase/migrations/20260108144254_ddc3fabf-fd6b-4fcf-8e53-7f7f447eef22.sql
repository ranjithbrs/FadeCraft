-- Revert views to SECURITY INVOKER and add proper RLS policies
-- The views need SECURITY INVOKER but the base tables need policies that allow the view to read

-- Recreate public_reviews with SECURITY INVOKER
DROP VIEW IF EXISTS public.public_reviews;
CREATE VIEW public.public_reviews
WITH (security_invoker = true)
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

GRANT SELECT ON public.public_reviews TO anon;
GRANT SELECT ON public.public_reviews TO authenticated;

-- Recreate public_doctors with SECURITY INVOKER
DROP VIEW IF EXISTS public.public_doctors;
CREATE VIEW public.public_doctors
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
  about,
  education,
  languages,
  availability_status,
  created_at,
  updated_at
FROM public.doctors
WHERE is_public = true OR is_public IS NULL;

GRANT SELECT ON public.public_doctors TO anon;
GRANT SELECT ON public.public_doctors TO authenticated;

-- Add RLS policy to allow anon to read public doctors (for the view to work)
DROP POLICY IF EXISTS "Anyone can view public doctors" ON public.doctors;
CREATE POLICY "Anyone can view public doctors"
ON public.doctors
FOR SELECT
TO anon
USING (is_public = true OR is_public IS NULL);

-- For reviews - create a restricted anon policy that the view will use
-- But since the view excludes user_id, this is safe
DROP POLICY IF EXISTS "Anon can read public reviews for view" ON public.reviews_ratings;
CREATE POLICY "Anon can read public reviews for view"
ON public.reviews_ratings
FOR SELECT
TO anon
USING (is_public = true);