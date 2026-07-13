-- Add RLS policy to allow public read access to pharmacy table
CREATE POLICY "Anyone can view pharmacies"
ON public.pharmacy
FOR SELECT
USING (true);