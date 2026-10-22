-- ============================================================
-- Machinest Studio — Phase 7b: Machine Status update
-- Run AFTER phase7.sql. Safe to re-run.
-- ============================================================

-- 1) Shop logo + operators no longer use a join code
alter table shops add column if not exists logo_url text;
alter table shops alter column join_code drop not null;

-- 2) Machine type, "Other" type remark and part name
alter table machines add column if not exists machine_type text not null default 'other';
alter table machines add column if not exists type_remark text;
alter table machines add column if not exists part_name text;

-- carry over the old icon choice for any test machines
update machines set machine_type = case icon
  when 'lathe' then 'cnc'
  when 'vmc' then 'vmc3'
  when 'swiss' then 'sliding'
  when 'drilling' then 'drilling'
  else 'other' end
where machine_type = 'other';

-- 3) New status list
alter table machines alter column status set default 'no_plan';
update machines set status = case status
  when 'idle' then 'no_plan'
  when 'setup' then 'setup_change'
  when 'waiting_material' then 'no_material'
  else status end;

alter table machine_status_log add column if not exists part_name text;
update machine_status_log set status = case status
  when 'idle' then 'no_plan'
  when 'setup' then 'setup_change'
  when 'waiting_material' then 'no_material'
  else status end;

-- 4) Operators: created by the owner, log in with a link + personal PIN
--    (no app.machinest.in account needed)
create table if not exists shop_operators (
  id uuid primary key,
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  phone text,
  pin_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists shop_operators_shop_idx on shop_operators (shop_id);
alter table shop_operators enable row level security;

-- 5) Public bucket for shop logos (uploads go through the app's API)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shop-logos', 'shop-logos', true, 1048576, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = true;
