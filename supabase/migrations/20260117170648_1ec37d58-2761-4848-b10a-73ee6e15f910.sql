-- Create favorites table
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  provider_id UUID REFERENCES public.providers(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, channel_id)
);

-- Enable RLS
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own favorites"
ON public.favorites FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can add favorites"
ON public.favorites FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove favorites"
ON public.favorites FOR DELETE
USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_favorites_user_id ON public.favorites(user_id);
CREATE INDEX idx_favorites_channel_id ON public.favorites(channel_id);

-- Create recently_watched table
CREATE TABLE public.recently_watched (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel_id TEXT NOT NULL,
  provider_id UUID REFERENCES public.providers(id) ON DELETE CASCADE,
  last_watched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  watch_duration INTEGER DEFAULT 0,
  UNIQUE(user_id, channel_id)
);

-- Enable RLS
ALTER TABLE public.recently_watched ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own watch history"
ON public.recently_watched FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can add watch history"
ON public.recently_watched FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update watch history"
ON public.recently_watched FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete watch history"
ON public.recently_watched FOR DELETE
USING (auth.uid() = user_id);

-- Index for faster queries
CREATE INDEX idx_recently_watched_user_id ON public.recently_watched(user_id);
CREATE INDEX idx_recently_watched_last_watched ON public.recently_watched(last_watched_at DESC);