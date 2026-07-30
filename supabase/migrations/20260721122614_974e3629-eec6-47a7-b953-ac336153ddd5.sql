
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
