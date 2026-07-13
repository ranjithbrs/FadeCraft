-- Fix the get_available_slots function to work with time types
CREATE OR REPLACE FUNCTION public.get_available_slots(p_doctor_id uuid, p_date date)
 RETURNS TABLE(slot_time time without time zone, is_booked boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  day_of_week_num INT;
BEGIN
  day_of_week_num := EXTRACT(DOW FROM p_date);
  
  RETURN QUERY
  WITH time_slot_series AS (
    SELECT 
      ts.id,
      (ts.start_time + (n || ' minutes')::INTERVAL)::TIME AS slot_time
    FROM time_slots ts
    CROSS JOIN generate_series(0, 
      EXTRACT(EPOCH FROM (ts.end_time - ts.start_time))::INT / 60 - ts.slot_duration, 
      ts.slot_duration
    ) AS n
    WHERE ts.doctor_id = p_doctor_id
      AND ts.day_of_week = day_of_week_num
      AND ts.is_available = true
  ),
  booked_slots AS (
    SELECT appointment_time
    FROM appointments
    WHERE doctor_id = p_doctor_id
      AND appointment_date = p_date
      AND status IN ('scheduled', 'confirmed')
  )
  SELECT 
    tss.slot_time,
    EXISTS(
      SELECT 1 FROM booked_slots bs 
      WHERE bs.appointment_time = tss.slot_time
    ) AS is_booked
  FROM time_slot_series tss
  ORDER BY tss.slot_time;
END;
$function$;