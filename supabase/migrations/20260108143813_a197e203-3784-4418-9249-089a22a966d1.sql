-- Function to escape ILIKE special characters
CREATE OR REPLACE FUNCTION public.escape_like(text)
RETURNS text
LANGUAGE sql
IMMUTABLE STRICT
SET search_path TO 'public', 'pg_catalog'
AS $$
  SELECT regexp_replace($1, '([%_\\])', '\\\1', 'g');
$$;

-- Update search_doctors with proper escaping and timeout
CREATE OR REPLACE FUNCTION public.search_doctors(
  search_text text DEFAULT NULL::text,
  specialization_filter text DEFAULT NULL::text,
  hospital_id_filter uuid DEFAULT NULL::uuid,
  limit_count integer DEFAULT 20,
  offset_count integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  name text,
  specialization text,
  qualification text,
  experience integer,
  consultation_fee numeric,
  rating numeric,
  total_reviews integer,
  hospital_id uuid,
  photo text,
  availability_status text
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
SET statement_timeout TO '5s'
AS $function$
DECLARE
  escaped_search text;
BEGIN
  -- Input validation and length limits
  IF search_text IS NOT NULL AND length(search_text) > 100 THEN
    search_text := left(search_text, 100);
  END IF;
  
  IF specialization_filter IS NOT NULL AND length(specialization_filter) > 100 THEN
    specialization_filter := left(specialization_filter, 100);
  END IF;

  -- Escape ILIKE wildcards to prevent injection
  escaped_search := public.escape_like(search_text);

  RETURN QUERY
  SELECT 
    d.id, d.name, d.specialization, d.qualification, d.experience,
    d.consultation_fee, d.rating, d.total_reviews, d.hospital_id,
    d.photo, d.availability_status
  FROM doctors d
  WHERE 
    (escaped_search IS NULL OR d.name ILIKE '%' || escaped_search || '%' OR d.about ILIKE '%' || escaped_search || '%')
    AND (specialization_filter IS NULL OR d.specialization = specialization_filter)
    AND (hospital_id_filter IS NULL OR d.hospital_id = hospital_id_filter)
    AND d.availability_status != 'inactive'
  ORDER BY d.rating DESC NULLS LAST, d.total_reviews DESC NULLS LAST
  LIMIT limit_count
  OFFSET offset_count;
END;
$function$;

-- Update search_hospitals with proper escaping and timeout
CREATE OR REPLACE FUNCTION public.search_hospitals(
  search_text text DEFAULT NULL::text,
  city_filter text DEFAULT NULL::text,
  specialty_filter text DEFAULT NULL::text,
  limit_count integer DEFAULT 20,
  offset_count integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  name text,
  address text,
  city text,
  state text,
  phone text,
  rating numeric,
  total_reviews integer,
  specialties text[],
  facilities text[],
  images text[],
  latitude numeric,
  longitude numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
SET statement_timeout TO '5s'
AS $function$
DECLARE
  escaped_search text;
BEGIN
  -- Input validation and length limits
  IF search_text IS NOT NULL AND length(search_text) > 100 THEN
    search_text := left(search_text, 100);
  END IF;
  
  IF city_filter IS NOT NULL AND length(city_filter) > 100 THEN
    city_filter := left(city_filter, 100);
  END IF;
  
  IF specialty_filter IS NOT NULL AND length(specialty_filter) > 100 THEN
    specialty_filter := left(specialty_filter, 100);
  END IF;

  -- Escape ILIKE wildcards to prevent injection
  escaped_search := public.escape_like(search_text);

  RETURN QUERY
  SELECT 
    h.id, h.name, h.address, h.city, h.state, h.phone,
    h.rating, h.total_reviews, h.specialties, h.facilities,
    h.images, h.latitude, h.longitude
  FROM hospitals h
  WHERE 
    (escaped_search IS NULL OR h.name ILIKE '%' || escaped_search || '%' OR h.description ILIKE '%' || escaped_search || '%')
    AND (city_filter IS NULL OR h.city = city_filter)
    AND (specialty_filter IS NULL OR specialty_filter = ANY(h.specialties))
    AND h.status = 'active'
  ORDER BY h.rating DESC NULLS LAST, h.total_reviews DESC NULLS LAST
  LIMIT limit_count
  OFFSET offset_count;
END;
$function$;