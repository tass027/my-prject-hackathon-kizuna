-- Quota quotidienne de l'assistant Aaddad. Les adresses IP ne sont jamais stockées,
-- seulement leur empreinte calculée côté serveur avec une clé secrète.
create table if not exists public.aaddad_ai_usage (
  client_hash text not null,
  used_on date not null,
  request_count integer not null default 0 check (request_count > 0),
  primary key (client_hash, used_on)
);

alter table public.aaddad_ai_usage enable row level security;
create index if not exists aaddad_ai_usage_used_on_idx on public.aaddad_ai_usage (used_on);
revoke all on public.aaddad_ai_usage from anon, authenticated;
grant all on public.aaddad_ai_usage to service_role;

create or replace function public.consume_aaddad_ai_quota(p_client_hash text, p_daily_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  quota_ok boolean := false;
  today_utc date := (now() at time zone 'utc')::date;
begin
  if p_client_hash !~ '^[a-f0-9]{64}$' or p_daily_limit < 1 or p_daily_limit > 100 then
    return false;
  end if;

  delete from public.aaddad_ai_usage where used_on < today_utc - 30;

  insert into public.aaddad_ai_usage (client_hash, used_on, request_count)
  values (p_client_hash, today_utc, 1)
  on conflict (client_hash, used_on) do update
    set request_count = public.aaddad_ai_usage.request_count + 1
    where public.aaddad_ai_usage.request_count < p_daily_limit
  returning true into quota_ok;

  return coalesce(quota_ok, false);
end;
$$;

revoke all on function public.consume_aaddad_ai_quota(text, integer) from public, anon, authenticated;
grant execute on function public.consume_aaddad_ai_quota(text, integer) to service_role;
