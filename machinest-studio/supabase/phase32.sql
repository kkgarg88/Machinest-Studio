-- Phase 32: simple funnel tracking (first cycle generated, first machine added) and an admin summary.
-- Safe to run more than once.

create table if not exists user_events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  event text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);

-- one row per user per event, so the same user is never counted twice
create unique index if not exists user_events_user_event_uidx on user_events (user_id, event);

-- only the server (service role) can read or write this table
alter table user_events enable row level security;

create or replace function admin_funnel() returns jsonb
language sql
security definer
set search_path = public, auth
as $$
  select jsonb_build_object(
    'signups',       (select count(*) from auth.users),
    'signups_7d',    (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'generated',     (select count(*) from user_events where event = 'first_cycle_generated'),
    'machine_added', (select count(*) from user_events where event = 'first_machine_added'),
    'paid',          (select count(distinct user_id) from payment_orders where status = 'paid'),
    'sources',       coalesce((
      select jsonb_agg(jsonb_build_object('source', coalesce(s, 'not answered'), 'count', c) order by c desc)
      from (select raw_user_meta_data->>'heard_from' as s, count(*) as c from auth.users group by 1) q
    ), '[]'::jsonb)
  );
$$;

revoke all on function admin_funnel() from public, anon, authenticated;
grant execute on function admin_funnel() to service_role;
