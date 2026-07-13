-- Drop existing restrictive policies and recreate as permissive
DROP POLICY IF EXISTS "Users can view their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can create their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can update their own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can delete their own appointments" ON public.appointments;

-- Create permissive policies (default behavior)
CREATE POLICY "Users can view their own appointments" 
ON public.appointments 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own appointments" 
ON public.appointments 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own appointments" 
ON public.appointments 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own appointments" 
ON public.appointments 
FOR DELETE 
USING (auth.uid() = user_id);