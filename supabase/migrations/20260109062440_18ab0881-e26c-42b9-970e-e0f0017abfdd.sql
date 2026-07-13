-- Fix doctor email exposure: update RLS to use security-barrier view approach
-- Drop existing policies and create a more restrictive one

-- First, ensure the public_doctors view is used for all public access
-- The view already excludes email, so we just need to ensure anon/authenticated
-- cannot bypass it by querying doctors directly

-- Remove direct SELECT access to doctors table for anon/authenticated
-- They must use public_doctors view instead
DROP POLICY IF EXISTS "Anyone can view public doctors" ON public.doctors;

-- Create policy that only allows authenticated users to see doctors they have appointments with
-- or via the public_doctors view (which excludes email)
CREATE POLICY "Users can view doctors for their appointments"
  ON public.doctors
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT doctor_id FROM public.appointments WHERE user_id = auth.uid()
    )
  );

-- Allow service role full access (for edge functions and admin)
-- Service role bypasses RLS by default, so no policy needed

-- Grant SELECT on public_doctors view to anon and authenticated
-- The view already excludes sensitive columns
GRANT SELECT ON public.public_doctors TO anon, authenticated;