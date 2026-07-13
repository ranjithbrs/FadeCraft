-- Fix SECURITY DEFINER view issue by using SECURITY INVOKER (the default)
-- Drop and recreate the view without security definer
DROP VIEW IF EXISTS public.public_reviews;

-- Recreate with explicit SECURITY INVOKER to be clear
CREATE VIEW public.public_reviews 
WITH (security_invoker = on)
AS
SELECT 
  id,
  doctor_id,
  hospital_id,
  rating,
  review,
  created_at
FROM public.reviews_ratings;

-- Grant access to the view
GRANT SELECT ON public.public_reviews TO anon, authenticated;