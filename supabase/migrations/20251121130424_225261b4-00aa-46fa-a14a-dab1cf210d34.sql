-- Add indexes for better search and query performance
CREATE INDEX IF NOT EXISTS idx_hospitals_city ON hospitals(city);
CREATE INDEX IF NOT EXISTS idx_hospitals_state ON hospitals(state);
CREATE INDEX IF NOT EXISTS idx_hospitals_specialties ON hospitals USING GIN(specialties);
CREATE INDEX IF NOT EXISTS idx_doctors_specialization ON doctors(specialization);
CREATE INDEX IF NOT EXISTS idx_doctors_hospital_id ON doctors(hospital_id);
CREATE INDEX IF NOT EXISTS idx_appointments_user_id ON appointments(user_id);
CREATE INDEX IF NOT EXISTS idx_appointments_doctor_id ON appointments(doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
CREATE INDEX IF NOT EXISTS idx_time_slots_doctor_id ON time_slots(doctor_id);
CREATE INDEX IF NOT EXISTS idx_time_slots_day_of_week ON time_slots(day_of_week);

-- Function to search hospitals with filters
CREATE OR REPLACE FUNCTION search_hospitals(
  search_text TEXT DEFAULT NULL,
  city_filter TEXT DEFAULT NULL,
  specialty_filter TEXT DEFAULT NULL,
  limit_count INT DEFAULT 20,
  offset_count INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  phone TEXT,
  rating NUMERIC,
  total_reviews INT,
  specialties TEXT[],
  facilities TEXT[],
  images TEXT[],
  latitude NUMERIC,
  longitude NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    h.id, h.name, h.address, h.city, h.state, h.phone,
    h.rating, h.total_reviews, h.specialties, h.facilities,
    h.images, h.latitude, h.longitude
  FROM hospitals h
  WHERE 
    (search_text IS NULL OR h.name ILIKE '%' || search_text || '%' OR h.description ILIKE '%' || search_text || '%')
    AND (city_filter IS NULL OR h.city = city_filter)
    AND (specialty_filter IS NULL OR specialty_filter = ANY(h.specialties))
    AND h.status = 'active'
  ORDER BY h.rating DESC NULLS LAST, h.total_reviews DESC NULLS LAST
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- Function to search doctors with filters
CREATE OR REPLACE FUNCTION search_doctors(
  search_text TEXT DEFAULT NULL,
  specialization_filter TEXT DEFAULT NULL,
  hospital_id_filter UUID DEFAULT NULL,
  limit_count INT DEFAULT 20,
  offset_count INT DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  specialization TEXT,
  qualification TEXT,
  experience INT,
  consultation_fee NUMERIC,
  rating NUMERIC,
  total_reviews INT,
  hospital_id UUID,
  photo TEXT,
  availability_status TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id, d.name, d.specialization, d.qualification, d.experience,
    d.consultation_fee, d.rating, d.total_reviews, d.hospital_id,
    d.photo, d.availability_status
  FROM doctors d
  WHERE 
    (search_text IS NULL OR d.name ILIKE '%' || search_text || '%' OR d.about ILIKE '%' || search_text || '%')
    AND (specialization_filter IS NULL OR d.specialization = specialization_filter)
    AND (hospital_id_filter IS NULL OR d.hospital_id = hospital_id_filter)
    AND d.availability_status != 'inactive'
  ORDER BY d.rating DESC NULLS LAST, d.total_reviews DESC NULLS LAST
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- Function to get available time slots for a doctor on a specific date
CREATE OR REPLACE FUNCTION get_available_slots(
  p_doctor_id UUID,
  p_date DATE
)
RETURNS TABLE (
  slot_time TIME,
  is_booked BOOLEAN
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  day_of_week_num INT;
BEGIN
  -- Get day of week (0 = Sunday, 6 = Saturday)
  day_of_week_num := EXTRACT(DOW FROM p_date);
  
  RETURN QUERY
  WITH time_slot_series AS (
    SELECT 
      ts.id,
      generate_series(
        ts.start_time,
        ts.end_time - (ts.slot_duration || ' minutes')::INTERVAL,
        (ts.slot_duration || ' minutes')::INTERVAL
      )::TIME AS slot_time
    FROM time_slots ts
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
$$;

-- Function to get next available token number for a doctor on a date
CREATE OR REPLACE FUNCTION get_next_token_number(
  p_doctor_id UUID,
  p_date DATE
)
RETURNS INT
LANGUAGE plpgsql
AS $$
DECLARE
  next_token INT;
BEGIN
  SELECT COALESCE(MAX(token_number), 0) + 1
  INTO next_token
  FROM appointments
  WHERE doctor_id = p_doctor_id
    AND appointment_date = p_date;
  
  RETURN next_token;
END;
$$;

-- Function to calculate queue position
CREATE OR REPLACE FUNCTION update_queue_positions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update queue positions for all appointments on the same date and doctor
  UPDATE appointments
  SET queue_position = subquery.row_num
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY doctor_id, appointment_date 
        ORDER BY appointment_time
      ) AS row_num
    FROM appointments
    WHERE doctor_id = NEW.doctor_id
      AND appointment_date = NEW.appointment_date
      AND status IN ('scheduled', 'confirmed')
  ) AS subquery
  WHERE appointments.id = subquery.id;
  
  RETURN NEW;
END;
$$;

-- Create trigger for queue position updates
DROP TRIGGER IF EXISTS trigger_update_queue_positions ON appointments;
CREATE TRIGGER trigger_update_queue_positions
  AFTER INSERT OR UPDATE OF appointment_time, status ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_queue_positions();

-- Function to get doctor statistics
CREATE OR REPLACE FUNCTION get_doctor_statistics(p_doctor_id UUID)
RETURNS TABLE (
  total_appointments BIGINT,
  completed_appointments BIGINT,
  cancelled_appointments BIGINT,
  average_rating NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::BIGINT AS total_appointments,
    COUNT(*) FILTER (WHERE status = 'completed')::BIGINT AS completed_appointments,
    COUNT(*) FILTER (WHERE status = 'cancelled')::BIGINT AS cancelled_appointments,
    (SELECT AVG(rating) FROM reviews_ratings WHERE doctor_id = p_doctor_id) AS average_rating
  FROM appointments
  WHERE doctor_id = p_doctor_id;
END;
$$;