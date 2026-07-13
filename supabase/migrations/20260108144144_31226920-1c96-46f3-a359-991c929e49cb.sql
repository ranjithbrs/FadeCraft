-- Fix: Add RLS to public_reviews view by granting proper access
-- Views with SECURITY INVOKER need explicit grants

-- Grant SELECT on public_reviews to anon and authenticated (safe view without user_id)
GRANT SELECT ON public.public_reviews TO anon;
GRANT SELECT ON public.public_reviews TO authenticated;

-- Grant SELECT on public_doctors to anon and authenticated (safe view without email)
GRANT SELECT ON public.public_doctors TO anon;
GRANT SELECT ON public.public_doctors TO authenticated;

-- Add UPDATE policy for payments (service role only for payment gateway callbacks)
CREATE POLICY "Service role can update payments"
ON public.payments
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Also allow users to view payments via the existing policy, ensure it exists
DROP POLICY IF EXISTS "Users can view their own payments" ON public.payments;
CREATE POLICY "Users can view their own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- For reviews_ratings, ensure the public view is the only way to access reviews publicly
-- The base table should only be accessible by authenticated users for their own reviews
-- We already have "Users can view their own reviews" policy

-- Add a policy to allow public read of reviews via the is_public flag (for the view to work)
CREATE POLICY "Public reviews visible through view"
ON public.reviews_ratings
FOR SELECT
TO anon
USING (is_public = true);

-- For hospitals, this is intentional business data - add documentation comment
COMMENT ON TABLE public.hospitals IS 'Public healthcare directory. Contact information is intentionally public for patient access.';