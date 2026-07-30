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