-- Create a secure view for public doctor information (excludes email)
CREATE OR REPLACE VIEW public.doctors_public AS
SELECT 
  id,
  name,
  specialization,
  qualification,
  experience,
  consultation_fee,
  rating,
  total_reviews,
  hospital_id,
  photo,
  availability_status,
  about,
  education,
  languages,
  created_at,
  updated_at
FROM public.doctors
WHERE availability_status != 'inactive';

-- Update the search_doctors function to exclude email from public results
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
SET search_path TO 'public'
AS $function$
BEGIN
  -- Input validation to prevent injection
  IF search_text IS NOT NULL AND length(search_text) > 100 THEN
    search_text := left(search_text, 100);
  END IF;
  
  IF specialization_filter IS NOT NULL AND length(specialization_filter) > 100 THEN
    specialization_filter := left(specialization_filter, 100);
  END IF;

  RETURN QUERY
  SELECT 
    d.id, d.name, d.specialization, d.qualification, d.experience,
    d.consultation_fee, d.rating, d.total_reviews, d.hospital_id,
    d.photo, d.availability_status
    -- NOTE: email is intentionally excluded from public search results
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
$function$;

-- Drop the existing permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view doctors" ON public.doctors;

-- Create a new policy that restricts email access to authenticated users only
-- For public access, create a policy that excludes the email column isn't possible in RLS
-- So we'll use a different approach: only authenticated users can see full doctor details
CREATE POLICY "Authenticated users can view doctors" 
ON public.doctors 
FOR SELECT 
TO authenticated
USING (true);

-- For anonymous access, we need to use the public view or search function
-- Grant access to the public view for anonymous users
GRANT SELECT ON public.doctors_public TO anon;
GRANT SELECT ON public.doctors_public TO authenticated;