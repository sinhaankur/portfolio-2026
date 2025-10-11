-- Create appointments table
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  professional_id UUID NOT NULL REFERENCES public.profiles(id),
  service_id UUID NOT NULL REFERENCES public.services(id),
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled')),
  notes TEXT,
  total_price DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for appointments
CREATE POLICY "Customers can view their own appointments" ON public.appointments
  FOR SELECT USING (customer_id = auth.uid());

CREATE POLICY "Professionals can view their appointments" ON public.appointments
  FOR SELECT USING (professional_id = auth.uid());

CREATE POLICY "Customers can create appointments" ON public.appointments
  FOR INSERT WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Customers can update their own appointments" ON public.appointments
  FOR UPDATE USING (customer_id = auth.uid());

CREATE POLICY "Professionals can update their appointments" ON public.appointments
  FOR UPDATE USING (professional_id = auth.uid());

CREATE POLICY "Admins can view all appointments" ON public.appointments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create index for better performance
CREATE INDEX idx_appointments_date ON public.appointments(appointment_date);
CREATE INDEX idx_appointments_professional ON public.appointments(professional_id);
CREATE INDEX idx_appointments_customer ON public.appointments(customer_id);
