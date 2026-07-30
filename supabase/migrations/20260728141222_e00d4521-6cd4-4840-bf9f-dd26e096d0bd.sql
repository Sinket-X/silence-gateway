ALTER TABLE public.error_events ADD COLUMN IF NOT EXISTS token_label text;

GRANT SELECT, DELETE ON public.error_events TO authenticated;
GRANT ALL ON public.error_events TO service_role;

DROP POLICY IF EXISTS "errors admin delete" ON public.error_events;
CREATE POLICY "errors admin delete" ON public.error_events
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS error_events_ts_idx ON public.error_events (ts DESC);