-- Create providers table for IPTV providers (M3U/Xtream)
CREATE TABLE public.providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('m3u', 'xtream')),
  m3u_url TEXT,
  xtream_host TEXT,
  xtream_user TEXT,
  xtream_pass_encrypted TEXT,
  epg_url TEXT,
  last_sync TIMESTAMP WITH TIME ZONE,
  channel_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;

-- RLS Policies - users can only access their own providers
CREATE POLICY "Users can view their own providers"
ON public.providers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own providers"
ON public.providers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own providers"
ON public.providers FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own providers"
ON public.providers FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_providers_updated_at
BEFORE UPDATE ON public.providers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster user queries
CREATE INDEX idx_providers_user_id ON public.providers(user_id);