
create or replace function public.gw_debit_api_key(_id uuid, _cost numeric, _tokens int)
returns void
language sql
security definer
set search_path = public
as $$
  update public.api_keys
     set balance = greatest(0, balance - _cost),
         total_cost = total_cost + _cost,
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
