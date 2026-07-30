
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
