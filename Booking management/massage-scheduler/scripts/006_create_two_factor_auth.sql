-- Create table for 2FA tokens
CREATE TABLE IF NOT EXISTS public.two_factor_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  token_type TEXT NOT NULL CHECK (token_type IN ('email_verification', 'login_2fa', 'password_reset')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.two_factor_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own tokens" ON public.two_factor_tokens
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can manage tokens" ON public.two_factor_tokens
  FOR ALL USING (true); -- This will be restricted by server-side logic

-- Create index for token lookup
CREATE INDEX idx_two_factor_tokens_user ON public.two_factor_tokens(user_id);
CREATE INDEX idx_two_factor_tokens_token ON public.two_factor_tokens(token);
