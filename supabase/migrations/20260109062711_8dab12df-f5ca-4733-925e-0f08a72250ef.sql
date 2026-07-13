-- Remove anon direct access to reviews_ratings table (user_id is exposed)
-- Anon should use public_reviews view instead
DROP POLICY IF EXISTS "anon_read_public_reviews" ON public.reviews_ratings;

-- Grant SELECT on public_reviews view (which excludes user_id) to anon and authenticated
GRANT SELECT ON public.public_reviews TO anon, authenticated;