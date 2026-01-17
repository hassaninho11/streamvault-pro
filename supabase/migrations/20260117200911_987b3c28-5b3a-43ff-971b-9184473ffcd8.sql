-- Create profiles table for multi-profile support
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  avatar_url TEXT,
  is_child BOOLEAN NOT NULL DEFAULT false,
  pin_hash TEXT, -- For parental lock on adult profiles
  max_rating TEXT DEFAULT 'all', -- Content rating limit: 'all', 'pg', 'pg13', 'r'
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_default BOOLEAN NOT NULL DEFAULT false,
  settings JSONB DEFAULT '{}' -- Profile-specific settings
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profiles
CREATE POLICY "Users can view own profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can create profiles for themselves
CREATE POLICY "Users can create own profiles"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own profiles
CREATE POLICY "Users can update own profiles"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own profiles (except default)
CREATE POLICY "Users can delete own non-default profiles"
ON public.user_profiles
FOR DELETE
TO authenticated
USING (auth.uid() = user_id AND is_default = false);

-- Create trigger for updated_at
CREATE TRIGGER update_user_profiles_updated_at
BEFORE UPDATE ON public.user_profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for fast user lookup
CREATE INDEX idx_user_profiles_user_id ON public.user_profiles(user_id);

-- Function to get or create default profile for user
CREATE OR REPLACE FUNCTION public.ensure_default_profile()
RETURNS TRIGGER AS $$
BEGIN
  -- When a user signs up, create a default profile
  INSERT INTO public.user_profiles (user_id, name, is_default)
  VALUES (NEW.id, 'Huvudprofil', true)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-create default profile on user creation (if profiles table exists)
-- Note: This hooks into the existing profiles table insert if it exists