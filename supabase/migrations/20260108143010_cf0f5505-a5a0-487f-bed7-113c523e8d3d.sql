-- The public_reviews view already exists and is a VIEW (not a table)
-- Views inherit RLS from their underlying tables when using SECURITY INVOKER
-- Let's recreate it with SECURITY INVOKER to ensure RLS is enforced from reviews_ratings

-- First drop the existing view
DROP VIEW IF EXISTS public.public_reviews;

-- Recreate with SECURITY INVOKER
CREATE VIEW public.public_reviews 
WITH (security_invoker = true)
AS
SELECT 
  id, 
  doctor_id, 
  hospital_id, 
  rating, 
  review, 
  created_at
  -- Note: user_id is intentionally excluded to protect patient identity
FROM public.reviews_ratings
WHERE is_public = true;

-- Grant select access 
GRANT SELECT ON public.public_reviews TO anon, authenticated;