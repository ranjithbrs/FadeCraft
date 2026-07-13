-- Remove public read access to reviews_ratings table (which exposes user_id)
DROP POLICY IF EXISTS "Public read reviews" ON public.reviews_ratings;

-- Only authenticated users can read their own reviews from the full table
CREATE POLICY "Users can read their own reviews"
ON public.reviews_ratings
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Grant anon and authenticated access to the public_reviews view (which excludes user_id)
GRANT SELECT ON public.public_reviews TO anon;
GRANT SELECT ON public.public_reviews TO authenticated;