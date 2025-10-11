-- Create junction table for professional services with custom pricing
CREATE TABLE IF NOT EXISTS public.professional_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  custom_price DECIMAL(10,2), -- NULL means use default service price
  is_offered BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(professional_id, service_id)
);

-- Enable RLS
ALTER TABLE public.professional_services ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Professionals can manage their own services" ON public.professional_services
  FOR ALL USING (professional_id = auth.uid());

CREATE POLICY "Everyone can view offered professional services" ON public.professional_services
  FOR SELECT USING (is_offered = true);

CREATE POLICY "Admins can view all professional services" ON public.professional_services
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
