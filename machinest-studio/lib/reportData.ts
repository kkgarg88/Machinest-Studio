import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser, getOwnerContext, hasMachineStatusAccess, hasValidPinCookie } from '@/lib/shop'
import { DEFAULT_SHIFTS, type Shift } from '@/lib/machineStatus'
import { computeReport, resolveRange, istMs, addDays, type LogRow, type Report } from '@/lib/machineReport'

export type ReportResult =
  | { ok: true; report: Report; shopName: string; machines: { id: string; name: string; machine_no: string | null }[]; shifts: Shift[]; today: string }
  | { ok: false; status: number; error: string; state?: 'locked' | 'expired' | 'not_found' }

// Works for the signed-in owner, and for a visitor who has already entered the shop PIN.
export async function loadReport(url: URL): Promise<ReportResult> {
  const admin = createAdminClient()

  let shop: { id: string; name: string; shifts?: Shift[]; shift_count?: number } | null = null

  const user = await getAuthedUser()
  if (user) {
    const ctx = await getOwnerContext(user.id)
    if (ctx) shop = ctx.shop
  }

  if (!shop) {
    const slug = (url.searchParams.get('slug') || '').toLowerCase()
    if (!slug) return { ok: false, status: 401, error: 'Please log in again' }
    const { data } = await admin
      .from('shops')
      .select('id, owner_id, name, slug, public_enabled, public_pin, shift_count, shifts')
      .eq('slug', slug)
      .maybeSingle()
    if (!data || !data.public_enabled) return { ok: false, status: 404, error: 'This link is not available', state: 'not_found' }
    if (!(await hasMachineStatusAccess(data.owner_id))) return { ok: false, status: 403, error: 'Subscription expired', state: 'expired' }
    if (!(await hasValidPinCookie(data))) return { ok: false, status: 401, error: 'Enter the PIN on the status board first', state: 'locked' }
    shop = data
  }

  const count = shop.shift_count || 2
  const shifts: Shift[] = (Array.isArray(shop.shifts) && shop.shifts.length >= count ? shop.shifts : DEFAULT_SHIFTS).slice(0, count)

  const now = Date.now()
  const p = url.searchParams
  const range = resolveRange(p.get('preset'), p.get('from'), p.get('to'), now, shifts)
  if ('error' in range) return { ok: false, status: 400, error: range.error }

  const shiftParam = p.get('shift')
  const shiftIndex = shiftParam && shiftParam !== 'all' && /^\d$/.test(shiftParam) && Number(shiftParam) < shifts.length ? Number(shiftParam) : null
  const machineParam = p.get('machine')
  const machineId = machineParam && machineParam !== 'all' && /^[0-9a-f-]{36}$/i.test(machineParam) ? machineParam : null

  const windowStart = istMs(range.fromDay, shifts[0].start)
  const windowEnd = Math.min(now, istMs(addDays(range.toDay, 1), shifts[0].start))

  const [{ data: machines }, { data: parts }, { data: off }, { data: carry }] = await Promise.all([
    admin.from('machines').select('id, name, machine_no, machine_type, type_remark, created_at').eq('shop_id', shop.id).order('position', { ascending: true }).order('created_at', { ascending: true }),
    admin.from('parts').select('id, name').eq('shop_id', shop.id),
    admin.from('shop_off_days').select('day').eq('shop_id', shop.id).gte('day', range.fromDay).lte('day', range.toDay),
    admin.rpc('status_carry_in', { p_shop: shop.id, p_before: new Date(windowStart).toISOString() }),
  ])

  const logs: LogRow[] = [...((carry || []) as LogRow[])]
  for (let page = 0; page < 200; page++) {
    const { data, error } = await admin
      .from('machine_status_log')
      .select('machine_id, status, remark, part_id, part_name, created_at')
      .eq('shop_id', shop.id)
      .gte('created_at', new Date(windowStart).toISOString())
      .lt('created_at', new Date(windowEnd).toISOString())
      .order('created_at', { ascending: true })
      .range(page * 1000, page * 1000 + 999)
    if (error) return { ok: false, status: 500, error: 'Could not read the status history' }
    logs.push(...((data || []) as LogRow[]))
    if (!data || data.length < 1000) break
  }

  const report = computeReport({
    machines: machines || [],
    logs,
    parts: parts || [],
    shifts,
    offDays: (off || []).map(o => o.day as string),
    fromDay: range.fromDay,
    toDay: range.toDay,
    shiftIndex,
    machineId,
    now,
  })

  return {
    ok: true,
    report,
    shopName: shop.name,
    machines: (machines || []).map(m => ({ id: m.id, name: m.name, machine_no: m.machine_no })),
    shifts,
    today: addDays(range.toDay, 0),
  }
}
