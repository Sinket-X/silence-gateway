
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
