
-- 1. Doctors: allow public reads, hide email
GRANT SELECT ON public.doctors TO anon, authenticated;
REVOKE SELECT (email) ON public.doctors FROM anon, authenticated;

-- 2. Hospitals: allow public reads
GRANT SELECT ON public.hospitals TO anon, authenticated;

-- 3. Appointments: allow authenticated reads (RLS handles row filtering)
GRANT SELECT ON public.appointments TO authenticated;
