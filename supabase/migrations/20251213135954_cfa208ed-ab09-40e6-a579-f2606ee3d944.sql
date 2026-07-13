-- Add email column to doctors table for sending notifications
ALTER TABLE public.doctors ADD COLUMN IF NOT EXISTS email TEXT;

-- Fix notifications table - allow service role to insert
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;
CREATE POLICY "Service role can insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- Allow service role to update notifications
DROP POLICY IF EXISTS "Service role can update notifications" ON public.notifications;
CREATE POLICY "Service role can update notifications" 
ON public.notifications 
FOR UPDATE 
USING (true);