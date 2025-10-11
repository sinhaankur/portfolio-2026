-- Create services table
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- RLS Policies for services
CREATE POLICY "Everyone can view active services" ON public.services
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins and professionals can manage services" ON public.services
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'professional')
    )
  );

-- Insert default services
INSERT INTO public.services (name, description, duration_minutes, price) VALUES
('Swedish Massage', 'Relaxing full-body massage with gentle pressure', 60, 80.00),
('Deep Tissue Massage', 'Therapeutic massage targeting muscle tension', 60, 100.00),
('Hot Stone Massage', 'Massage using heated stones for deep relaxation', 90, 120.00),
('Aromatherapy Massage', 'Relaxing massage with essential oils', 60, 90.00);
