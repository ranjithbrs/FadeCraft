-- Fix SQL injection vulnerability in search_doctors and search_hospitals functions
-- by escaping ILIKE wildcards and adding statement timeout

-- Drop existing functions first
DROP FUNCTION IF EXISTS public.search_doctors(TEXT, TEXT, UUID, INT, INT);
DROP FUNCTION IF EXISTS public.search_hospitals(TEXT, TEXT, TEXT, INT, INT);

-- Recreate search_doctors with wildcard escaping and timeout
CREATE OR REPLACE FUNCTION public.search_doctors(
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
  availability_status TEXT,
  photo TEXT,
  hospital_id UUID
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
SET statement_timeout = '5s'
AS $$
DECLARE
  sanitized_search TEXT;
BEGIN
  -- Sanitize search text by escaping ILIKE wildcards
  IF search_text IS NOT NULL THEN
    -- Escape special ILIKE characters: % and _
    sanitized_search := regexp_replace(search_text, '([%_\\])', '\\\1', 'g');
    -- Truncate to prevent excessive length
    IF length(sanitized_search) > 100 THEN
      sanitized_search := left(sanitized_search, 100);
    END IF;
  END IF;

  RETURN QUERY
  SELECT 
    d.id,
    d.name,
    d.specialization,
    d.qualification,
    d.experience,
    d.consultation_fee,
    d.rating,
    d.total_reviews,
    d.availability_status,
    d.photo,
    d.hospital_id
  FROM public.doctors d
  WHERE (is_public IS NOT FALSE)
    AND (sanitized_search IS NULL OR d.name ILIKE '%' || sanitized_search || '%' OR d.about ILIKE '%' || sanitized_search || '%')
    AND (specialization_filter IS NULL OR d.specialization ILIKE '%' || specialization_filter || '%')
    AND (hospital_id_filter IS NULL OR d.hospital_id = hospital_id_filter)
  ORDER BY d.rating DESC NULLS LAST, d.name
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;

-- Recreate search_hospitals with wildcard escaping and timeout
CREATE OR REPLACE FUNCTION public.search_hospitals(
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
STABLE SECURITY DEFINER
SET search_path = 'public'
SET statement_timeout = '5s'
AS $$
DECLARE
  sanitized_search TEXT;
BEGIN
  -- Sanitize search text by escaping ILIKE wildcards
  IF search_text IS NOT NULL THEN
    -- Escape special ILIKE characters: % and _
    sanitized_search := regexp_replace(search_text, '([%_\\])', '\\\1', 'g');
    -- Truncate to prevent excessive length
    IF length(sanitized_search) > 100 THEN
      sanitized_search := left(sanitized_search, 100);
    END IF;
  END IF;

  RETURN QUERY
  SELECT 
    h.id,
    h.name,
    h.address,
    h.city,
    h.state,
    h.phone,
    h.rating,
    h.total_reviews,
    h.specialties,
    h.facilities,
    h.images,
    h.latitude,
    h.longitude
  FROM public.hospitals h
  WHERE (sanitized_search IS NULL OR h.name ILIKE '%' || sanitized_search || '%' OR h.description ILIKE '%' || sanitized_search || '%')
    AND (city_filter IS NULL OR h.city ILIKE '%' || city_filter || '%')
    AND (specialty_filter IS NULL OR specialty_filter = ANY(h.specialties))
  ORDER BY h.rating DESC NULLS LAST, h.name
  LIMIT limit_count
  OFFSET offset_count;
END;
$$;