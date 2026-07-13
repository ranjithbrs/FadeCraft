-- Add RLS policy for doctors to view appointments assigned to them
-- This requires matching the doctor's email with the authenticated user's email

-- First, create a function to check if the current user is the doctor for an appointment
CREATE OR REPLACE FUNCTION public.is_doctor_for_appointment(doctor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.doctors d
    WHERE d.id = doctor_id
      AND d.email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
$$;

-- Add policy for doctors to view their assigned appointments
CREATE POLICY "Doctors can view appointments assigned to them"
ON public.appointments
FOR SELECT
USING (
  public.is_doctor_for_appointment(doctor_id)
);

-- Add policy for doctors to update their assigned appointments (e.g., mark as completed)
CREATE POLICY "Doctors can update appointments assigned to them"
ON public.appointments
FOR UPDATE
USING (
  public.is_doctor_for_appointment(doctor_id)
);