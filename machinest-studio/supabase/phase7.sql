-- ============================================================
-- Machinest Studio — Phase 7: Machine Status
-- Safe to re-run.
-- ============================================================

-- 1) Register Machine Status as a tool (so it can be ticked into plans)
insert into tools (name, slug, description, monthly_price, annual_price, features)
select 'Machine Status',
       'machine-status',
       'Live status board for every machine on your shop floor',
       0, null,
       array[
         'Up to 100 machines on a live grid',
         'Up to 3 operator logins, each on their own phone',
         'Public link so anyone can watch your shop status'
       ]
where not exists (select 1 from tools where slug = 'machine-status');

-- 2) Shops: one per owner
create table if not exists shops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  public_enabled boolean not null default true,
  public_pin text not null,
  join_code text not null unique,
  created_at timestamptz not null default now()
);

-- Failed PIN tries on the public link (used to block guessing)
create table if not exists shop_pin_attempts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  ip_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists shop_pin_attempts_idx on shop_pin_attempts (shop_id, ip_hash, created_at desc);
alter table shop_pin_attempts enable row level security;

-- 3) Operators of a shop (a user can belong to only one shop)
create table if not exists shop_members (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role text not null default 'operator' check (role in ('operator')),
  created_at timestamptz not null default now()
);
create index if not exists shop_members_shop_idx on shop_members (shop_id);

-- 4) Machines
create table if not exists machines (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  machine_no text,
  icon text not null default 'other',
  position int not null default 0,
  status text not null default 'idle',
  remark text,
  status_since timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,
  updated_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists machines_shop_idx on machines (shop_id, position);

-- 5) History of every status change (kept for future utilization reports)
create table if not exists machine_status_log (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references machines(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  status text not null,
  remark text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists machine_log_machine_idx on machine_status_log (machine_id, created_at desc);

-- 6) Lock the tables. All access goes through the app's API (service role),
--    which checks owner / operator / subscription. With RLS on and no policies,
--    browsers cannot read or write these tables directly.
alter table shops enable row level security;
alter table shop_members enable row level security;
alter table machines enable row level security;
alter table machine_status_log enable row level security;
