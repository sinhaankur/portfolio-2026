-- Create professional schedules table
CREATE TABLE IF NOT EXISTS public.professional_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(professional_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.professional_schedules ENABLE ROW LEVEL SECURITY;

-- RLS Policies for schedules
CREATE POLICY "Professionals can manage their own schedules" ON public.professional_schedules
  FOR ALL USING (professional_id = auth.uid());

CREATE POLICY "Everyone can view professional schedules" ON public.professional_schedules
  FOR SELECT USING (is_available = true);

CREATE POLICY "Admins can view all schedules" ON public.professional_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
