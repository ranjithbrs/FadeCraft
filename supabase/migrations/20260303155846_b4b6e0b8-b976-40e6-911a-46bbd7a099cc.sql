
-- Update get_doctor_queue to handle 4-tier priority: emergency > premium > priority > normal
CREATE OR REPLACE FUNCTION public.get_doctor_queue(p_doctor_id uuid, p_date date)
RETURNS TABLE(appointment_id uuid, patient_name text, token_number integer, token_type text, status text, appointment_time time without time zone, queue_position integer)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id AS appointment_id,
    p.full_name AS patient_name,
    a.token_number,
    a.token_type,
    a.status,
    a.appointment_time,
    ROW_NUMBER() OVER (
      ORDER BY 
        CASE 
          WHEN a.token_type = 'emergency' THEN 0
          WHEN a.token_type = 'premium' THEN 1
          WHEN a.token_type = 'priority' THEN 2
          ELSE 3
        END,
        a.token_number
    )::integer AS queue_position
  FROM appointments a
  LEFT JOIN profiles p ON p.id = a.user_id
  WHERE a.doctor_id = p_doctor_id
    AND a.appointment_date = p_date
    AND a.status IN ('scheduled', 'confirmed', 'in_consultation')
  ORDER BY 
    CASE 
      WHEN a.token_type = 'emergency' THEN 0
      WHEN a.token_type = 'premium' THEN 1
      WHEN a.token_type = 'priority' THEN 2
      ELSE 3
    END,
    a.token_number;
END;
$$;
