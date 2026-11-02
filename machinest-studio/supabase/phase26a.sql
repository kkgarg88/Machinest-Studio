-- ============================================================
-- Machinest Studio — Phase 26a: Machine Status
-- Part master, shifts, off days. Run once; safe to re-run.
-- ============================================================

-- 1) Part master (owner adds parts, operators pick from the list)
create table if not exists parts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  name_key text not null,            -- lower case, no spaces: blocks "Bush 22" vs "BUSH22"
  customer text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (shop_id, name_key)
);
create index if not exists parts_shop_idx on parts (shop_id);
alter table parts enable row level security;

alter table machines add column if not exists part_id uuid references parts(id) on delete set null;
alter table machine_status_log add column if not exists part_id uuid references parts(id) on delete set null;
create index if not exists machine_log_shop_time_idx on machine_status_log (shop_id, created_at);
create index if not exists machine_log_part_idx on machine_status_log (part_id);

-- 2) Fill the part master from the part names already used, one entry per spelling-group
with src as (
  select shop_id, btrim(part_name) as name from machines where part_name is not null and btrim(part_name) <> ''
  union all
  select shop_id, btrim(part_name) from machine_status_log where part_name is not null and btrim(part_name) <> ''
), keyed as (
  select shop_id, name, lower(regexp_replace(name, '\s+', '', 'g')) as k, count(*) as c
  from src group by 1, 2, 3
), pick as (
  select distinct on (shop_id, k) shop_id, k, name from keyed order by shop_id, k, c desc, name
)
insert into parts (shop_id, name, name_key)
select shop_id, left(name, 60), k from pick
on conflict (shop_id, name_key) do nothing;

update machines m set part_id = p.id
from parts p
where m.part_id is null and m.part_name is not null
  and p.shop_id = m.shop_id
  and p.name_key = lower(regexp_replace(btrim(m.part_name), '\s+', '', 'g'));

update machine_status_log l set part_id = p.id
from parts p
where l.part_id is null and l.part_name is not null
  and p.shop_id = l.shop_id
  and p.name_key = lower(regexp_replace(btrim(l.part_name), '\s+', '', 'g'));

-- 3) Shifts (1 to 3 per shop, each with a start and end time)
alter table shops add column if not exists shift_count int not null default 2;
alter table shops drop constraint if exists shops_shift_count_check;
alter table shops add constraint shops_shift_count_check check (shift_count between 1 and 3);
alter table shops add column if not exists shifts jsonb not null
  default '[{"name":"Day","start":"08:00","end":"20:00"},{"name":"Night","start":"20:00","end":"08:00"}]'::jsonb;

-- 4) Planned off days (the shop marks them per month)
create table if not exists shop_off_days (
  shop_id uuid not null references shops(id) on delete cascade,
  day date not null,
  primary key (shop_id, day)
);
alter table shop_off_days enable row level security;
