-- Enable RLS on the doctors_public view and allow public access
-- Note: Views inherit the RLS policies of underlying tables, so we need to 
-- create a policy that allows public SELECT on the doctors_public view

-- First, let's grant SELECT permission on the doctors_public view to authenticated and anon users
GRANT SELECT ON public.doctors_public TO anon, authenticated;

-- The doctors_public view already excludes the email column, so it's safe for public access