-- Saved programs (G71 first, other cycles can reuse it later)
create table if not exists public.saved_programs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cycle_code  text not null check (char_length(cycle_code) between 1 and 40),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  data        jsonb not null check (octet_length(data::text) < 40000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint saved_programs_unique_name unique (user_id, cycle_code, name)
);

create index if not exists saved_programs_user_cycle_idx
  on public.saved_programs (user_id, cycle_code, updated_at desc);

alter table public.saved_programs enable row level security;

drop policy if exists "Users read own saved programs"   on public.saved_programs;
drop policy if exists "Users insert own saved programs" on public.saved_programs;
drop policy if exists "Users update own saved programs" on public.saved_programs;
drop policy if exists "Users delete own saved programs" on public.saved_programs;

create policy "Users read own saved programs"   on public.saved_programs for select using (auth.uid() = user_id);
create policy "Users insert own saved programs" on public.saved_programs for insert with check (auth.uid() = user_id);
create policy "Users update own saved programs" on public.saved_programs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users delete own saved programs" on public.saved_programs for delete using (auth.uid() = user_id);

-- At most 30 saved programs per user and cycle
create or replace function public.saved_programs_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.saved_programs
        where user_id = new.user_id and cycle_code = new.cycle_code) >= 30 then
    raise exception 'You can save up to 30 programs. Delete one to save a new program.';
  end if;
  return new;
end;
$$;

drop trigger if exists saved_programs_limit_trg on public.saved_programs;
create trigger saved_programs_limit_trg
before insert on public.saved_programs
for each row execute function public.saved_programs_limit();

-- Keep updated_at current and never let user_id / cycle_code be changed
create or replace function public.saved_programs_touch()
returns trigger
language plpgsql
as $$
begin
  new.user_id := old.user_id;
  new.cycle_code := old.cycle_code;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists saved_programs_touch_trg on public.saved_programs;
create trigger saved_programs_touch_trg
before update on public.saved_programs
for each row execute function public.saved_programs_touch();
