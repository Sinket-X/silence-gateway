DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['admins','api_keys','providers','provider_tokens','models','user_roles','usage_events','banned_ips','login_attempts','fallbacks','error_events','ip_strikes']
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;