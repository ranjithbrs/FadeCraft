
-- 1. Create role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin', 'doctor', 'patient');

CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS: users can view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- RLS: admins can manage all roles
CREATE POLICY "Admins can manage roles"
ON public.user_roles
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Auto-assign 'patient' role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'patient');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_role
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_role();

-- 2. Add priority token fields to appointments
ALTER TABLE public.appointments 
ADD COLUMN token_type text NOT NULL DEFAULT 'normal',
ADD COLUMN consultation_fee numeric DEFAULT 0,
ADD COLUMN priority_fee numeric DEFAULT 0,
ADD COLUMN payment_status text NOT NULL DEFAULT 'unpaid',
ADD COLUMN follow_up_date date NULL,
ADD COLUMN consultation_notes text NULL;

-- 3. Create index for queue ordering (priority first)
CREATE INDEX idx_appointments_queue_order 
ON public.appointments (doctor_id, appointment_date, token_type DESC, token_number);

-- 4. Create a function to get queue ordered by priority
CREATE OR REPLACE FUNCTION public.get_doctor_queue(p_doctor_id uuid, p_date date)
RETURNS TABLE(
  appointment_id uuid,
  patient_name text,
  token_number integer,
  token_type text,
  status text,
  appointment_time time,
  queue_position integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id AS appointment_id,
    p.full_name AS patient_name,
    a.token_number,
    a.token_type,
    a.status,
    a.appointment_time,
    ROW_NUMBER() OVER (
      ORDER BY 
        CASE WHEN a.token_type = 'priority' THEN 0 ELSE 1 END,
        a.token_number
    )::integer AS queue_position
  FROM appointments a
  LEFT JOIN profiles p ON p.id = a.user_id
  WHERE a.doctor_id = p_doctor_id
    AND a.appointment_date = p_date
    AND a.status IN ('scheduled', 'confirmed', 'in_consultation')
  ORDER BY 
    CASE WHEN a.token_type = 'priority' THEN 0 ELSE 1 END,
    a.token_number;
END;
$$;

-- 5. Admin revenue summary function
CREATE OR REPLACE FUNCTION public.get_revenue_summary(p_date date DEFAULT CURRENT_DATE)
RETURNS TABLE(
  total_patients bigint,
  normal_tokens bigint,
  priority_tokens bigint,
  total_consultation_income numeric,
  total_priority_income numeric,
  overall_revenue numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::bigint AS total_patients,
    COUNT(*) FILTER (WHERE a.token_type = 'normal')::bigint AS normal_tokens,
    COUNT(*) FILTER (WHERE a.token_type = 'priority')::bigint AS priority_tokens,
    COALESCE(SUM(a.consultation_fee), 0) AS total_consultation_income,
    COALESCE(SUM(a.priority_fee), 0) AS total_priority_income,
    COALESCE(SUM(a.consultation_fee + a.priority_fee), 0) AS overall_revenue
  FROM appointments a
  WHERE a.appointment_date = p_date
    AND a.status NOT IN ('cancelled');
END;
$$;

-- 6. Follow-up reminders function
CREATE OR REPLACE FUNCTION public.get_upcoming_followups(p_days integer DEFAULT 7)
RETURNS TABLE(
  appointment_id uuid,
  patient_name text,
  doctor_name text,
  follow_up_date date,
  consultation_notes text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id AS appointment_id,
    p.full_name AS patient_name,
    d.name AS doctor_name,
    a.follow_up_date,
    a.consultation_notes
  FROM appointments a
  LEFT JOIN profiles p ON p.id = a.user_id
  LEFT JOIN doctors d ON d.id = a.doctor_id
  WHERE a.follow_up_date IS NOT NULL
    AND a.follow_up_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + (p_days || ' days')::interval)
  ORDER BY a.follow_up_date;
END;
$$;

-- 7. Doctor RLS: doctors can update appointment status
CREATE POLICY "Doctors can view their queue"
ON public.appointments
FOR SELECT
USING (public.has_role(auth.uid(), 'doctor') AND doctor_id IN (
  SELECT d.id FROM doctors d WHERE d.email = (SELECT email FROM auth.users WHERE id = auth.uid())
));
