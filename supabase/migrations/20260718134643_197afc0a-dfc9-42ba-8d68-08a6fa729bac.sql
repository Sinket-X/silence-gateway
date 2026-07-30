ALTER TABLE public.providers ADD COLUMN IF NOT EXISTS hourly_limit integer NOT NULL DEFAULT 0;
ALTER TABLE public.provider_tokens ADD COLUMN IF NOT EXISTS hourly_limit integer NOT NULL DEFAULT 0;