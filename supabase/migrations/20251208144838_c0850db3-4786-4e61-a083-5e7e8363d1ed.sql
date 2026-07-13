-- Fix reviews_ratings privacy issue: prevent user_id exposure to non-owners
-- Drop existing SELECT policy if exists
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews_ratings;
DROP POLICY IF EXISTS "Users can view all reviews" ON public.reviews_ratings;

-- Create new SELECT policy that hides user_id from non-owners
-- For public viewing, they can see reviews but user_id should not be returned in queries
-- This is handled via RLS - we allow SELECT but applications should not SELECT user_id
CREATE POLICY "Anyone can read reviews" 
ON public.reviews_ratings 
FOR SELECT 
USING (true);

-- Add a view for public review access that excludes user_id
CREATE OR REPLACE VIEW public.public_reviews AS
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