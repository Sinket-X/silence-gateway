
-- Add 'user' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'user';

-- Profiles table: one row per app user (created by admin)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  suspended boolean NOT NULL DEFAULT false,
  suspended_reason text,
  suspended_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile; admins can read/write all
CREATE POLICY "own profile select" ON public.profiles FOR SELECT
  TO authenticated USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin write profiles" ON public.profiles FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update profiles" ON public.profiles FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete profiles" ON public.profiles FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER profiles_touch_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Link api_keys to owning user (nullable for legacy/loose keys)
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON public.api_keys(user_id);

-- Allow users to read their own api_keys (metadata; key_hash is never sent anyway)
DROP POLICY IF EXISTS "own api keys select" ON public.api_keys;
CREATE POLICY "own api keys select" ON public.api_keys FOR SELECT
  TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Allow users to read their own usage events
DROP POLICY IF EXISTS "own usage select" ON public.usage_events;
CREATE POLICY "own usage select" ON public.usage_events FOR SELECT
  TO authenticated USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (SELECT 1 FROM public.api_keys k WHERE k.id = usage_events.api_key_id AND k.user_id = auth.uid())
  );

-- Helper: is a given user's account suspended?
CREATE OR REPLACE FUNCTION public.is_user_suspended(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT suspended FROM public.profiles WHERE id = _user_id), false)
$$;
