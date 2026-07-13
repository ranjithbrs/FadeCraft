-- Fix 1: Drop the doctors_public view that creates an RLS backdoor
-- The application should use search_doctors() RPC or direct table queries with proper field selection
DROP VIEW IF EXISTS public.doctors_public CASCADE;