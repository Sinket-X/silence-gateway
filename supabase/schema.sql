-- Silence Gateway — complete database schema.
-- Paste this whole file into Supabase → SQL Editor → Run (one time, on a fresh project).

-- ===== 20260717125103_ef43609d-37e4-4319-bebe-8f02f55d20e8.sql =====
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "roles readable by self or admin" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Admin metadata mirror (email display etc.)
CREATE TABLE public.admins (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admins TO authenticated;
GRANT ALL ON public.admins TO service_role;
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins visible to admins" ON public.admins FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins mutable by admins" ON public.admins FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Providers (secret columns are ciphertext only)
CREATE TABLE public.providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  base_url_enc text NOT NULL,
  api_key_enc text,
  headers_enc text,
  priority int NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  rpm_limit int NOT NULL DEFAULT 0,
  rps_limit int NOT NULL DEFAULT 0,
  daily_limit int NOT NULL DEFAULT 0,
  monthly_limit int NOT NULL DEFAULT 0,
  max_input_tokens int NOT NULL DEFAULT 0,
  max_output_tokens int NOT NULL DEFAULT 0,
  balance numeric(20,6) NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'active',
  health text NOT NULL DEFAULT 'unknown',
  last_health_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.providers TO authenticated;
GRANT ALL ON public.providers TO service_role;
ALTER TABLE public.providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "providers admin only" ON public.providers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Models
CREATE TABLE public.models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  upstream_model text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  input_cost_per_1m numeric(20,6) NOT NULL DEFAULT 0,
  output_cost_per_1m numeric(20,6) NOT NULL DEFAULT 0,
  request_cost numeric(20,6) NOT NULL DEFAULT 0,
  internal_cost_per_1m numeric(20,6) NOT NULL DEFAULT 0,
  user_cost_per_1m numeric(20,6) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (display_name, provider_id)
);
CREATE INDEX ON public.models (display_name) WHERE enabled;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.models TO authenticated;
GRANT ALL ON public.models TO service_role;
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "models admin only" ON public.models FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Fallbacks
CREATE TABLE public.fallbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('model','provider','global')),
  source_model_id uuid REFERENCES public.models(id) ON DELETE CASCADE,
  source_provider_id uuid REFERENCES public.providers(id) ON DELETE CASCADE,
  target_provider_id uuid NOT NULL REFERENCES public.providers(id) ON DELETE CASCADE,
  target_upstream_model text,
  ordinal int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fallbacks TO authenticated;
GRANT ALL ON public.fallbacks TO service_role;
ALTER TABLE public.fallbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fallbacks admin only" ON public.fallbacks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- API keys (hashed, prefix visible)
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash text NOT NULL UNIQUE,
  key_prefix text NOT NULL,
  owner_label text NOT NULL,
  balance numeric(20,6) NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  total_requests bigint NOT NULL DEFAULT 0,
  total_cost numeric(20,6) NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api_keys admin only" ON public.api_keys FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Usage (no prompts/responses ever)
CREATE TABLE public.usage_events (
  id bigserial PRIMARY KEY,
  ts timestamptz NOT NULL DEFAULT now(),
  api_key_id uuid REFERENCES public.api_keys(id) ON DELETE SET NULL,
  model_id uuid REFERENCES public.models(id) ON DELETE SET NULL,
  provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  model_name text,
  provider_name text,
  input_tokens int NOT NULL DEFAULT 0,
  output_tokens int NOT NULL DEFAULT 0,
  total_tokens int NOT NULL DEFAULT 0,
  cost numeric(20,6) NOT NULL DEFAULT 0,
  internal_cost numeric(20,6) NOT NULL DEFAULT 0,
  latency_ms int NOT NULL DEFAULT 0,
  success boolean NOT NULL DEFAULT true
);
CREATE INDEX ON public.usage_events (ts DESC);
CREATE INDEX ON public.usage_events (model_id, ts DESC);
CREATE INDEX ON public.usage_events (provider_id, ts DESC);
GRANT SELECT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage admin only" ON public.usage_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Error events (admin visible)
CREATE TABLE public.error_events (
  id bigserial PRIMARY KEY,
  ts timestamptz NOT NULL DEFAULT now(),
  provider_id uuid REFERENCES public.providers(id) ON DELETE SET NULL,
  provider_name text,
  key_fingerprint text,
  model text,
  http_status int,
  message text,
  retries int NOT NULL DEFAULT 0,
  final_result text,
  latency_ms int,
  provider_response text
);
CREATE INDEX ON public.error_events (ts DESC);
GRANT SELECT ON public.error_events TO authenticated;
GRANT ALL ON public.error_events TO service_role;
ALTER TABLE public.error_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "errors admin only" ON public.error_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- IP bans
CREATE TABLE public.banned_ips (
  ip text PRIMARY KEY,
  reason text,
  strikes int NOT NULL DEFAULT 0,
  banned_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banned_ips TO authenticated;
GRANT ALL ON public.banned_ips TO service_role;
ALTER TABLE public.banned_ips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bans admin only" ON public.banned_ips FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Strike counter (pre-ban)
CREATE TABLE public.ip_strikes (
  ip text PRIMARY KEY,
  count int NOT NULL DEFAULT 0,
  last_at timestamptz NOT NULL DEFAULT now(),
  last_reason text
);
GRANT SELECT ON public.ip_strikes TO authenticated;
GRANT ALL ON public.ip_strikes TO service_role;
ALTER TABLE public.ip_strikes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "strikes admin only" ON public.ip_strikes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Login attempt limiter
CREATE TABLE public.login_attempts (
  ip text NOT NULL,
  email text NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  first_at timestamptz NOT NULL DEFAULT now(),
  last_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ip, email)
);
GRANT ALL ON public.login_attempts TO service_role;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
-- no policies -> only service_role reaches it via admin client

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER providers_touch BEFORE UPDATE ON public.providers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER models_touch BEFORE UPDATE ON public.models
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ===== 20260717125126_288e95b9-1730-446e-9500-42cf33319254.sql =====
-- Pin search_path on touch trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Restrict has_role EXECUTE (only authenticated, called via RLS)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- ===== 20260718131449_27a806c7-26ca-42b1-b372-1596064910d6.sql =====
CREATE TABLE IF NOT EXISTS public.provider_tokens (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  label text not null default 'token',
  api_key_enc text not null,
  enabled boolean not null default true,
  priority integer not null default 100,
  balance numeric not null default 0,
  daily_limit integer not null default 0,
  monthly_limit integer not null default 0,
  rpm_limit integer not null default 0,
  rps_limit integer not null default 0,
  max_input_tokens integer not null default 0,
  max_output_tokens integer not null default 0,
  health text not null default 'unknown',
  last_health_at timestamptz,
  last_used_at timestamptz,
  requests_today integer not null default 0,
  requests_this_month integer not null default 0,
  rpm_window_start timestamptz,
  rpm_window_count integer not null default 0,
  cooldown_until timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_tokens TO authenticated;
GRANT ALL ON public.provider_tokens TO service_role;

ALTER TABLE public.provider_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage provider_tokens"
  ON public.provider_tokens FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_provider_tokens_touch ON public.provider_tokens;
CREATE TRIGGER trg_provider_tokens_touch BEFORE UPDATE ON public.provider_tokens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS provider_tokens_provider_idx ON public.provider_tokens(provider_id);

-- Migrate legacy single api_key on providers into a token row
INSERT INTO public.provider_tokens (provider_id, label, api_key_enc, enabled, priority, balance, daily_limit, monthly_limit, rpm_limit, rps_limit, max_input_tokens, max_output_tokens)
SELECT p.id, 'default', p.api_key_enc, p.enabled, 100, p.balance, p.daily_limit, p.monthly_limit, p.rpm_limit, p.rps_limit, p.max_input_tokens, p.max_output_tokens
FROM public.providers p
WHERE p.api_key_enc IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.provider_tokens t WHERE t.provider_id = p.id);

-- ===== 20260718134643_197afc0a-dfc9-42ba-8d68-08a6fa729bac.sql =====
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS hourly_limit integer NOT NULL DEFAULT 0;
ALTER TABLE public.provider_tokens ADD COLUMN IF NOT EXISTS hourly_limit integer NOT NULL DEFAULT 0;

-- ===== 20260718160645_b93b311e-556b-4f8d-9bdf-8d8fe71cb768.sql =====
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['admins','api_keys','providers','provider_tokens','models','user_roles','usage_events','banned_ips','login_attempts','fallbacks','error_events','ip_strikes']
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;

-- ===== 20260719104031_ceb53e5b-480b-484d-bcc3-da85d6c077a9.sql =====
ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS requires_auth boolean NOT NULL DEFAULT true;

-- ===== 20260719133115_dc0fb528-0b79-4f0f-8bdf-7b76a577f6a7.sql =====
update provider_tokens set cooldown_until=null, health='healthy';

-- ===== 20260721121727_8a55d698-fd5b-456e-b0f7-e87e97727742.sql =====
create or replace function public.gw_debit_api_key(_id uuid, _cost numeric, _tokens int)
returns void
language sql
security definer
set search_path = public
as $$
  update public.api_keys
     set balance = greatest(0, balance - coalesce(_cost, 0)),
         total_cost = total_cost + coalesce(_cost, 0),
         total_requests = total_requests + 1,
         last_used_at = now()
   where id = _id;
$$;
revoke all on function public.gw_debit_api_key(uuid, numeric, int) from public, anon, authenticated;

create or replace function public.gw_debit_provider_token(_id uuid, _cost numeric)
returns void
language sql
security definer
set search_path = public
as $$
  update public.provider_tokens
     set balance = greatest(0, balance - _cost),
         requests_today = coalesce(requests_today,0) + 1,
         requests_this_month = coalesce(requests_this_month,0) + 1,
         last_used_at = now(),
         health = 'healthy'
   where id = _id;
$$;
revoke all on function public.gw_debit_provider_token(uuid, numeric) from public, anon, authenticated;

create or replace function public.gw_is_ip_banned(_ip text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.banned_ips
     where ip = _ip and (expires_at is null or expires_at > now())
  );
$$;
revoke all on function public.gw_is_ip_banned(text) from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'banned_ips_ip_key' and conrelid = 'public.banned_ips'::regclass
  ) then
    alter table public.banned_ips add constraint banned_ips_ip_key unique (ip);
  end if;
end $$;

create or replace function public.gw_record_ip_strike(_ip text, _reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  strike_count int;
begin
  insert into public.ip_strikes (ip, reason) values (_ip, _reason);
  select count(*) into strike_count
    from public.ip_strikes
   where ip = _ip and created_at > now() - interval '10 minutes';
  if strike_count >= 20 then
    insert into public.banned_ips (ip, reason, expires_at, strikes)
    values (_ip, 'auto: '||_reason||' ('||strike_count||' strikes/10min)', now() + interval '1 hour', strike_count)
    on conflict (ip) do update
      set expires_at = greatest(coalesce(banned_ips.expires_at, now()), excluded.expires_at),
          reason = excluded.reason,
          strikes = excluded.strikes;
  end if;
end;
$$;
revoke all on function public.gw_record_ip_strike(text, text) from public, anon, authenticated;

-- ===== 20260721122141_8636e52d-63eb-435d-8838-60b98d8b1261.sql =====
CREATE POLICY "Admins insert user_roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update user_roles" ON public.user_roles FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete user_roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ===== 20260721122614_974e3629-eec6-47a7-b953-ac336153ddd5.sql =====
DROP FUNCTION IF EXISTS public.gw_record_ip_strike(text, text);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ip_strikes_ip_key') THEN
    ALTER TABLE public.ip_strikes ADD CONSTRAINT ip_strikes_ip_key UNIQUE (ip);
  END IF;
END $$;

CREATE FUNCTION public.gw_record_ip_strike(_ip text, _reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_count int;
BEGIN
  IF _ip IS NULL OR _ip = '' THEN RETURN 0; END IF;

  INSERT INTO public.ip_strikes (ip, count, last_at, last_reason)
  VALUES (_ip, 1, now(), _reason)
  ON CONFLICT (ip) DO UPDATE
    SET count = CASE
                  WHEN public.ip_strikes.last_at < now() - interval '10 minutes' THEN 1
                  ELSE public.ip_strikes.count + 1
                END,
        last_at = now(),
        last_reason = EXCLUDED.last_reason
  RETURNING count INTO new_count;

  IF new_count >= 20 THEN
    INSERT INTO public.banned_ips (ip, reason, expires_at, strikes, banned_at)
    VALUES (_ip, 'auto: '||_reason||' ('||new_count||' strikes/10min)', now() + interval '1 hour', new_count, now())
    ON CONFLICT (ip) DO UPDATE
      SET expires_at = GREATEST(COALESCE(public.banned_ips.expires_at, now()), EXCLUDED.expires_at),
          reason = EXCLUDED.reason,
          strikes = EXCLUDED.strikes;
  END IF;

  RETURN new_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.gw_unban_ip(_ip text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  DELETE FROM public.banned_ips WHERE ip = _ip;
  DELETE FROM public.ip_strikes WHERE ip = _ip;
  RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.gw_manual_ban_ip(_ip text, _reason text, _hours int DEFAULT 24)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO public.banned_ips (ip, reason, expires_at, strikes, banned_at)
  VALUES (_ip, COALESCE(_reason, 'manual admin ban'), now() + make_interval(hours => GREATEST(1, _hours)), 0, now())
  ON CONFLICT (ip) DO UPDATE SET expires_at = EXCLUDED.expires_at, reason = EXCLUDED.reason;
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.gw_unban_ip(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gw_manual_ban_ip(text, text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gw_unban_ip(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gw_manual_ban_ip(text, text, int) TO authenticated;

-- ===== 20260723103545_00f9d544-0bd7-45ec-ad16-6e8259f03c5e.sql =====
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

-- ===== 20260723105304_ba5835b4-e07c-4fec-8754-86261a0c3715.sql =====
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.api_keys FROM anon;
REVOKE SELECT ON public.usage_events FROM anon;
REVOKE SELECT ON public.user_roles FROM anon;
REVOKE SELECT ON public.providers FROM anon;
REVOKE SELECT ON public.provider_tokens FROM anon;
REVOKE SELECT ON public.models FROM anon;
REVOKE SELECT ON public.banned_ips FROM anon;
REVOKE SELECT ON public.login_attempts FROM anon;

-- ===== 20260723105939_2d212fb4-2c93-4e62-a241-1e42f95a3bc4.sql =====
CREATE TABLE IF NOT EXISTS public.session_bindings (
  user_id uuid PRIMARY KEY,
  fingerprint text NOT NULL,
  ua text,
  ip text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_bindings TO authenticated;
GRANT ALL ON public.session_bindings TO service_role;
ALTER TABLE public.session_bindings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own binding read" ON public.session_bindings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own binding write" ON public.session_bindings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS login_attempts_email_lastat_idx
  ON public.login_attempts (email, last_at DESC);
CREATE INDEX IF NOT EXISTS login_attempts_ip_lastat_idx
  ON public.login_attempts (ip, last_at DESC);

-- ===== 20260727162839_6d2cfd4d-bbf6-43cb-afc8-48d714d8e92b.sql =====
CREATE OR REPLACE FUNCTION public.gw_reserve_token_slot(_id uuid, _rpm_limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws timestamptz;
  wc integer;
BEGIN
  SELECT rpm_window_start, rpm_window_count INTO ws, wc
    FROM public.provider_tokens WHERE id = _id FOR UPDATE;
  IF ws IS NULL OR ws < now() - interval '60 seconds' THEN
    ws := now();
    wc := 0;
  END IF;
  IF _rpm_limit IS NOT NULL AND _rpm_limit > 0 AND wc >= _rpm_limit THEN
    UPDATE public.provider_tokens
       SET rpm_window_start = ws, rpm_window_count = wc
     WHERE id = _id;
    RETURN false;
  END IF;
  UPDATE public.provider_tokens
     SET rpm_window_start = ws,
         rpm_window_count = wc + 1,
         last_used_at = now()
   WHERE id = _id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.gw_reserve_token_slot(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gw_reserve_token_slot(uuid, integer) TO service_role;

-- ===== 20260728140344_dd0cbb73-7bc3-470f-ae80-79eb197c1b00.sql =====
UPDATE public.provider_tokens SET cooldown_until = NULL, health = 'healthy' WHERE cooldown_until IS NOT NULL OR health <> 'healthy';

-- ===== 20260728141222_e00d4521-6cd4-4840-bf9f-dd26e096d0bd.sql =====
ALTER TABLE public.error_events ADD COLUMN IF NOT EXISTS token_label text;

GRANT SELECT, DELETE ON public.error_events TO authenticated;
GRANT ALL ON public.error_events TO service_role;

DROP POLICY IF EXISTS "errors admin delete" ON public.error_events;
CREATE POLICY "errors admin delete" ON public.error_events
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS error_events_ts_idx ON public.error_events (ts DESC);
