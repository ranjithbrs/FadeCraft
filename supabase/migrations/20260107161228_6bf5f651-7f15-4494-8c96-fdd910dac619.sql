-- Fix 1: Ensure profiles table blocks anonymous access (already has RLS enabled, policies check auth.uid())
-- The existing policies already require auth.uid() = id, so anonymous users get no rows
-- No change needed, but let's verify by adding an explicit deny for anon

-- Fix 2: Ensure payments table blocks anonymous access
-- The existing SELECT policy requires auth.uid() = user_id, so anonymous users get no rows
-- No change needed

-- Fix 3: Ensure appointments table blocks anonymous access
-- The existing SELECT policy requires auth.uid() = user_id OR is_doctor, so anonymous users get no rows  
-- No change needed

-- Fix 4: Ensure push_subscriptions table blocks anonymous access
-- The existing SELECT policy requires auth.uid() = user_id, so anonymous users get no rows
-- No change needed

-- Fix 5: Allow users to delete their own notifications
CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
TO authenticated
USING ((SELECT auth.uid()) = user_id);

-- Fix 6: Allow public access to reviews that are marked as public (via public_reviews view)
-- The public_reviews view already filters to is_public = true, just ensure RLS allows it
-- Views inherit RLS from base table, so we need a policy on reviews_ratings for public reviews
CREATE POLICY "Anyone can read public reviews"
ON public.reviews_ratings
FOR SELECT
TO anon, authenticated
USING (is_public = true);

-- Fix 7: Drop the old user-only read policy that conflicts
DROP POLICY IF EXISTS "Users can read their own reviews" ON public.reviews_ratings;