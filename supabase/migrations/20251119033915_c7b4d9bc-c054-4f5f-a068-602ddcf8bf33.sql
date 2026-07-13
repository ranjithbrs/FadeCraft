-- Create hospitals table
CREATE TABLE public.hospitals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  description TEXT,
  specialties TEXT[] DEFAULT '{}',
  facilities TEXT[] DEFAULT '{}',
  images TEXT[] DEFAULT '{}',
  rating DECIMAL(2,1) DEFAULT 0.0,
  total_reviews INTEGER DEFAULT 0,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create doctors table
CREATE TABLE public.doctors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  photo TEXT,
  specialization TEXT NOT NULL,
  qualification TEXT NOT NULL,
  experience INTEGER NOT NULL,
  consultation_fee DECIMAL(10,2) NOT NULL,
  about TEXT,
  education TEXT,
  languages TEXT[] DEFAULT '{}',
  rating DECIMAL(2,1) DEFAULT 0.0,
  total_reviews INTEGER DEFAULT 0,
  availability_status TEXT DEFAULT 'available',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reviews_ratings table
CREATE TABLE public.reviews_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  doctor_id UUID REFERENCES public.doctors(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT review_target_check CHECK (
    (doctor_id IS NOT NULL AND hospital_id IS NULL) OR 
    (doctor_id IS NULL AND hospital_id IS NOT NULL)
  )
);

-- Enable Row Level Security
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews_ratings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for hospitals (public read access)
CREATE POLICY "Anyone can view hospitals"
ON public.hospitals
FOR SELECT
USING (true);

-- RLS Policies for doctors (public read access)
CREATE POLICY "Anyone can view doctors"
ON public.doctors
FOR SELECT
USING (true);

-- RLS Policies for reviews (public read, authenticated write)
CREATE POLICY "Anyone can view reviews"
ON public.reviews_ratings
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can create reviews"
ON public.reviews_ratings
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
ON public.reviews_ratings
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
ON public.reviews_ratings
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX idx_hospitals_city ON public.hospitals(city);
CREATE INDEX idx_hospitals_specialties ON public.hospitals USING GIN(specialties);
CREATE INDEX idx_doctors_hospital_id ON public.doctors(hospital_id);
CREATE INDEX idx_doctors_specialization ON public.doctors(specialization);
CREATE INDEX idx_reviews_doctor_id ON public.reviews_ratings(doctor_id);
CREATE INDEX idx_reviews_hospital_id ON public.reviews_ratings(hospital_id);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_hospitals_updated_at
BEFORE UPDATE ON public.hospitals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_doctors_updated_at
BEFORE UPDATE ON public.doctors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_reviews_updated_at
BEFORE UPDATE ON public.reviews_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample data for hospitals
INSERT INTO public.hospitals (name, address, city, state, pincode, phone, email, description, specialties, facilities, images, rating, total_reviews) VALUES
('City General Hospital', '123 Main Street', 'Mumbai', 'Maharashtra', '400001', '+91-22-12345678', 'contact@citygeneralhospital.com', 'Leading multi-specialty hospital with state-of-the-art facilities', ARRAY['Cardiology', 'Neurology', 'Orthopedics', 'General Medicine'], ARRAY['ICU', 'Emergency', 'Pharmacy', 'Lab', 'Ambulance'], ARRAY['https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800'], 4.5, 328),
('Metro Medical Center', '456 Park Avenue', 'Delhi', 'Delhi', '110001', '+91-11-98765432', 'info@metromedical.com', 'Comprehensive healthcare services with experienced doctors', ARRAY['Pediatrics', 'Ophthalmology', 'Dermatology', 'General Medicine'], ARRAY['ICU', 'Emergency', 'Pharmacy', 'Lab', 'Cafeteria'], ARRAY['https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=800'], 4.3, 256),
('Sunrise Hospital', '789 Health Road', 'Bangalore', 'Karnataka', '560001', '+91-80-55443322', 'care@sunrisehospital.com', 'Patient-centered care with modern medical technology', ARRAY['Cardiology', 'Orthopedics', 'General Medicine', 'Pharmacy'], ARRAY['ICU', 'Emergency', 'Pharmacy', 'Lab', 'Parking'], ARRAY['https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=800'], 4.7, 412);

-- Insert sample data for doctors
INSERT INTO public.doctors (hospital_id, name, photo, specialization, qualification, experience, consultation_fee, about, education, languages, rating, total_reviews, availability_status) VALUES
((SELECT id FROM public.hospitals WHERE name = 'City General Hospital'), 'Dr. Rajesh Kumar', 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400', 'Cardiologist', 'MBBS, MD (Cardiology)', 15, 800.00, 'Specialist in cardiac care with extensive experience in interventional cardiology', 'MBBS from AIIMS Delhi, MD Cardiology from CMC Vellore', ARRAY['English', 'Hindi', 'Marathi'], 4.8, 145, 'available'),
((SELECT id FROM public.hospitals WHERE name = 'City General Hospital'), 'Dr. Priya Sharma', 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400', 'Neurologist', 'MBBS, MD (Neurology)', 12, 750.00, 'Expert in treating neurological disorders with patient-centric approach', 'MBBS from Grant Medical College, MD Neurology from NIMHANS', ARRAY['English', 'Hindi'], 4.6, 98, 'available'),
((SELECT id FROM public.hospitals WHERE name = 'Metro Medical Center'), 'Dr. Amit Patel', 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400', 'Pediatrician', 'MBBS, MD (Pediatrics)', 10, 600.00, 'Dedicated to providing comprehensive care for children', 'MBBS from BJ Medical College, MD Pediatrics from AIIMS', ARRAY['English', 'Hindi', 'Gujarati'], 4.7, 203, 'available'),
((SELECT id FROM public.hospitals WHERE name = 'Metro Medical Center'), 'Dr. Anjali Verma', 'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400', 'Ophthalmologist', 'MBBS, MS (Ophthalmology)', 8, 500.00, 'Specialized in eye care and vision correction procedures', 'MBBS from Maulana Azad Medical College, MS Ophthalmology from AIIMS', ARRAY['English', 'Hindi'], 4.5, 167, 'busy'),
((SELECT id FROM public.hospitals WHERE name = 'Sunrise Hospital'), 'Dr. Suresh Reddy', 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400', 'Orthopedic Surgeon', 'MBBS, MS (Orthopedics)', 18, 900.00, 'Expert in joint replacement and sports injury treatment', 'MBBS from St. Johns Medical College, MS Orthopedics from CMC Vellore', ARRAY['English', 'Hindi', 'Telugu'], 4.9, 287, 'available');

-- Insert sample reviews
INSERT INTO public.reviews_ratings (user_id, doctor_id, rating, review) VALUES
(gen_random_uuid(), (SELECT id FROM public.doctors WHERE name = 'Dr. Rajesh Kumar'), 5, 'Excellent doctor with great expertise. Very patient and thorough in examination.'),
(gen_random_uuid(), (SELECT id FROM public.doctors WHERE name = 'Dr. Rajesh Kumar'), 5, 'Highly recommended! Helped me understand my condition clearly.'),
(gen_random_uuid(), (SELECT id FROM public.doctors WHERE name = 'Dr. Priya Sharma'), 4, 'Good experience. Doctor was knowledgeable and caring.'),
(gen_random_uuid(), (SELECT id FROM public.doctors WHERE name = 'Dr. Amit Patel'), 5, 'Great with kids! My son felt comfortable throughout the consultation.');