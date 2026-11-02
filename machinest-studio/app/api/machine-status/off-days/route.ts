import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser, getOwnerContext } from '@/lib/shop'

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/

function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}`, last }
}

// Owner reads the off days of one month
export async function GET(req: Request) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const ctx = await getOwnerContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'Only the shop owner can do this' }, { status: 403 })

  const month = new URL(req.url).searchParams.get('month') || ''
  if (!MONTH_RE.test(month)) return NextResponse.json({ error: 'Invalid month' }, { status: 400 })
  const { from, to } = monthRange(month)

  const admin = createAdminClient()
  const { data } = await admin.from('shop_off_days').select('day').eq('shop_id', ctx.shop.id).gte('day', from).lte('day', to)
  return NextResponse.json({ days: (data || []).map(d => d.day as string) })
}

// Owner saves the off days of one month (replaces that month)
export async function PUT(req: Request) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const ctx = await getOwnerContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'Only the shop owner can do this' }, { status: 403 })
  if (!ctx.active) return NextResponse.json({ error: 'Your subscription has expired. Renew to make changes' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const month = typeof body?.month === 'string' ? body.month : ''
  if (!MONTH_RE.test(month) || !Array.isArray(body?.days)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const { from, to, last } = monthRange(month)

  const days: string[] = []
  for (const d of body.days) {
    if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return NextResponse.json({ error: 'Invalid day' }, { status: 400 })
    const n = Number(d.slice(8, 10))
    if (!d.startsWith(month + '-') || n < 1 || n > last) return NextResponse.json({ error: 'Day is outside the month' }, { status: 400 })
    if (!days.includes(d)) days.push(d)
  }

  const admin = createAdminClient()
  const { error: delErr } = await admin.from('shop_off_days').delete().eq('shop_id', ctx.shop.id).gte('day', from).lte('day', to)
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
  if (days.length > 0) {
    const { error } = await admin.from('shop_off_days').insert(days.map(day => ({ shop_id: ctx.shop.id, day })))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
