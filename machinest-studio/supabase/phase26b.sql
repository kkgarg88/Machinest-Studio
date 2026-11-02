-- ============================================================
-- Machinest Studio — Phase 26b: Machine Status reports
-- Run once; safe to re-run. Run phase26a.sql first.
-- ============================================================

-- Latest status of every machine before a given time (so a report that starts
-- in the middle of a long status still knows what each machine was doing).
create or replace function status_carry_in(p_shop uuid, p_before timestamptz)
returns table (machine_id uuid, status text, remark text, part_id uuid, part_name text, created_at timestamptz)
language sql stable as $$
  select distinct on (l.machine_id) l.machine_id, l.status, l.remark, l.part_id, l.part_name, l.created_at
  from machine_status_log l
  where l.shop_id = p_shop and l.created_at < p_before
  order by l.machine_id, l.created_at desc
$$;

revoke all on function status_carry_in(uuid, timestamptz) from public, anon, authenticated;
grant execute on function status_carry_in(uuid, timestamptz) to service_role;
