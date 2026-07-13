-- Remove redundant service role policies - service role bypasses RLS entirely
-- These policies are flagged by the linter and serve no purpose since service role ignores RLS

DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can update notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can insert payments" ON public.payments;
DROP POLICY IF EXISTS "Service role can update payments" ON public.payments;