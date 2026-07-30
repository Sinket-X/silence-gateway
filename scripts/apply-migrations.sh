#!/usr/bin/env bash
# Silence Gateway — idempotent database migration runner.
#
# Applies every file in supabase/migrations (sorted by name) exactly once.
# Already-applied files are skipped, so re-running this on every deploy is safe
# and future code updates ship their new .sql files automatically.
#
# Requires: psql, and env var SUPABASE_DB_URL (Supabase -> Project Settings ->
# Database -> Connection string -> URI, with your database password inside).
set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "::error::SUPABASE_DB_URL is not set. Add it as a GitHub Actions secret."
  exit 1
fi

PSQL="psql --no-psqlrc -v ON_ERROR_STOP=1 -q $SUPABASE_DB_URL"

echo "==> Ensuring migration ledger table exists"
$PSQL -c "CREATE TABLE IF NOT EXISTS public._silence_migrations (
            filename text PRIMARY KEY,
            applied_at timestamptz NOT NULL DEFAULT now()
          );" >/dev/null

shopt -s nullglob
applied=0
skipped=0

for file in $(ls supabase/migrations/*.sql | sort); do
  name="$(basename "$file")"
  exists="$($PSQL -tA -c "SELECT 1 FROM public._silence_migrations WHERE filename = '$name'")"
  if [ "$exists" = "1" ]; then
    skipped=$((skipped + 1))
    continue
  fi
  echo "==> Applying $name"
  $PSQL --single-transaction -f "$file"
  $PSQL -c "INSERT INTO public._silence_migrations (filename) VALUES ('$name')
            ON CONFLICT (filename) DO NOTHING;" >/dev/null
  applied=$((applied + 1))
done

echo "==> Migrations done. applied=$applied skipped=$skipped"