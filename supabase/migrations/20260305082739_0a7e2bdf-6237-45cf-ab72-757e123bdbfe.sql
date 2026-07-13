
-- Emergency alerts table
CREATE TABLE public.emergency_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE CASCADE NOT NULL,
  latitude numeric NOT NULL,
  longitude numeric NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

ALTER TABLE public.emergency_alerts ENABLE ROW LEVEL SECURITY;

-- Users can create their own emergency alerts
CREATE POLICY "Users can create emergency alerts"
ON public.emergency_alerts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can view their own emergency alerts
CREATE POLICY "Users can view their own emergency alerts"
ON public.emergency_alerts FOR SELECT TO authenticated
USING (auth.uid() = user_id);

-- Enable realtime for emergency alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_alerts;
