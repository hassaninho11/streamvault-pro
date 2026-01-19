
-- ============================================
-- ADMIN PANEL DATABASE SCHEMA
-- ============================================

-- 1) Create role enum (owner, admin, user)
CREATE TYPE public.app_role AS ENUM ('owner', 'admin', 'user');

-- 2) Create user_roles table (RBAC)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3) Create security definer function for role checking (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
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

-- Check if user is owner or admin
CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('owner', 'admin')
  )
$$;

-- 4) RLS policies for user_roles
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_admin_or_owner(auth.uid()));

CREATE POLICY "Owner can manage roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- 5) Create admin_users view for extended user info
CREATE TABLE public.admin_user_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  device_count INTEGER DEFAULT 0,
  provider_count INTEGER DEFAULT 0,
  last_seen_at TIMESTAMPTZ,
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_user_metadata ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view user metadata"
ON public.admin_user_metadata
FOR SELECT
TO authenticated
USING (public.is_admin_or_owner(auth.uid()));

CREATE POLICY "Admins can update user metadata"
ON public.admin_user_metadata
FOR UPDATE
TO authenticated
USING (public.is_admin_or_owner(auth.uid()));

CREATE POLICY "Admins can insert user metadata"
ON public.admin_user_metadata
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- 6) Create entitlements table
CREATE TABLE public.entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  premium_source TEXT NOT NULL DEFAULT 'none' CHECK (premium_source IN ('billing', 'manual', 'trial', 'none')),
  premium_status TEXT NOT NULL DEFAULT 'none' CHECK (premium_status IN ('active', 'trialing', 'expired', 'revoked', 'none')),
  premium_until TIMESTAMPTZ,
  trial_start_at TIMESTAMPTZ,
  trial_end_at TIMESTAMPTZ,
  granted_by UUID REFERENCES auth.users(id),
  grant_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

-- Users can read their own entitlements
CREATE POLICY "Users can view own entitlements"
ON public.entitlements
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin_or_owner(auth.uid()));

-- Admins can manage entitlements
CREATE POLICY "Admins can manage entitlements"
ON public.entitlements
FOR ALL
TO authenticated
USING (public.is_admin_or_owner(auth.uid()))
WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- 7) Create purchases table (for future billing integration)
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('google', 'apple', 'web')),
  product_id TEXT NOT NULL,
  price NUMERIC(10, 2),
  currency TEXT DEFAULT 'SEK',
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('success', 'refunded', 'chargeback', 'pending')),
  transaction_id TEXT,
  receipt_data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own purchases"
ON public.purchases
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin_or_owner(auth.uid()));

CREATE POLICY "Admins can view all purchases"
ON public.purchases
FOR ALL
TO authenticated
USING (public.is_admin_or_owner(auth.uid()))
WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- 8) Create bug_reports table
CREATE TABLE public.bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  platform TEXT CHECK (platform IN ('android', 'ios', 'web')),
  app_version TEXT,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'triaged', 'in_progress', 'done', 'wont_fix')),
  attachments JSONB DEFAULT '[]'::jsonb,
  diagnostics_masked JSONB,
  assigned_to UUID REFERENCES auth.users(id),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Users can create bug reports
CREATE POLICY "Anyone can create bug reports"
ON public.bug_reports
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Users can view their own, admins can view all
CREATE POLICY "Users can view own bug reports"
ON public.bug_reports
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin_or_owner(auth.uid()));

-- Admins can manage bug reports
CREATE POLICY "Admins can manage bug reports"
ON public.bug_reports
FOR UPDATE
TO authenticated
USING (public.is_admin_or_owner(auth.uid()));

-- 9) Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'grant_premium', 'revoke_premium', 'disable_user', 'enable_user',
    'change_role', 'note_update', 'bug_status_change', 'settings_change'
  )),
  target_user_id UUID REFERENCES auth.users(id),
  before_json JSONB,
  after_json JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.is_admin_or_owner(auth.uid()));

-- Only admins can create audit logs
CREATE POLICY "Admins can create audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin_or_owner(auth.uid()));

-- 10) Create app_events table for analytics
CREATE TABLE public.app_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  platform TEXT,
  app_version TEXT,
  meta_masked JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_events ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert events
CREATE POLICY "Users can insert events"
ON public.app_events
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Only admins can view events
CREATE POLICY "Admins can view events"
ON public.app_events
FOR SELECT
TO authenticated
USING (public.is_admin_or_owner(auth.uid()));

-- 11) Create feature_flags table
CREATE TABLE public.feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL UNIQUE,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Anyone can read feature flags
CREATE POLICY "Anyone can read feature flags"
ON public.feature_flags
FOR SELECT
TO authenticated
USING (true);

-- Only owner can manage feature flags
CREATE POLICY "Owner can manage feature flags"
ON public.feature_flags
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'owner'))
WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- 12) Triggers for updated_at
CREATE TRIGGER update_user_roles_updated_at
BEFORE UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_admin_user_metadata_updated_at
BEFORE UPDATE ON public.admin_user_metadata
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_entitlements_updated_at
BEFORE UPDATE ON public.entitlements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bug_reports_updated_at
BEFORE UPDATE ON public.bug_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feature_flags_updated_at
BEFORE UPDATE ON public.feature_flags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 13) Function to initialize owner role for specific email
CREATE OR REPLACE FUNCTION public.ensure_owner_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Automatically assign 'owner' role to the designated owner email
  IF NEW.email = 'hassaninho@hotmail.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'owner')
    ON CONFLICT (user_id, role) DO NOTHING;
  ELSE
    -- Assign default 'user' role to all other users
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  
  -- Create admin metadata entry
  INSERT INTO public.admin_user_metadata (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create entitlements entry
  INSERT INTO public.entitlements (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-assign roles on user creation
CREATE TRIGGER on_auth_user_created_assign_role
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.ensure_owner_role();

-- 14) Insert default feature flags
INSERT INTO public.feature_flags (flag_key, enabled, description) VALUES
  ('ai_subtitles', false, 'Enable AI-generated subtitles feature'),
  ('casting_beta', false, 'Enable Chromecast beta feature'),
  ('pip_mode', true, 'Enable picture-in-picture mode'),
  ('multi_screen', false, 'Enable multi-screen viewing'),
  ('offline_epg', false, 'Enable offline EPG caching')
ON CONFLICT (flag_key) DO NOTHING;
