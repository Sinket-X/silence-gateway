
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
