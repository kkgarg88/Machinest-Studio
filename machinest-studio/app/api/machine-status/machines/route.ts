import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser, getContext } from '@/lib/shop'
import { ICON_KEYS, MAX_MACHINES } from '@/lib/machineStatus'

// Owner adds a machine
export async function POST(req: Request) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const ctx = await getContext(user.id)
  if (ctx.role !== 'owner') return NextResponse.json({ error: 'Only the shop owner can add machines' }, { status: 403 })
  if (!ctx.active) return NextResponse.json({ error: 'Your subscription has expired. Renew to make changes' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const machineNo = typeof body?.machine_no === 'string' ? body.machine_no.trim().slice(0, 30) : ''
  const icon = ICON_KEYS.includes(body?.icon) ? body.icon : 'other'

  if (name.length < 1 || name.length > 40) return NextResponse.json({ error: 'Machine name must be 1 to 40 characters' }, { status: 400 })

  const admin = createAdminClient()
  const { count } = await admin.from('machines').select('id', { count: 'exact', head: true }).eq('shop_id', ctx.shop.id)
  if ((count ?? 0) >= MAX_MACHINES) {
    return NextResponse.json({ error: `You can add up to ${MAX_MACHINES} machines` }, { status: 400 })
  }

  const { data: last } = await admin
    .from('machines').select('position').eq('shop_id', ctx.shop.id).order('position', { ascending: false }).limit(1).maybeSingle()

  const { error } = await admin.from('machines').insert({
    shop_id: ctx.shop.id,
    name,
    machine_no: machineNo || null,
    icon,
    position: (last?.position ?? 0) + 1,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
