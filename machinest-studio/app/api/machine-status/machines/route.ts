import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser, getOwnerContext } from '@/lib/shop'
import { TYPE_KEYS, MAX_MACHINES } from '@/lib/machineStatus'

// Owner adds a machine. Name, number, type and part name are all required.
export async function POST(req: Request) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const ctx = await getOwnerContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'Only the shop owner can add machines' }, { status: 403 })
  if (!ctx.active) return NextResponse.json({ error: 'Your subscription has expired. Renew to make changes' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const machineNo = typeof body?.machine_no === 'string' ? body.machine_no.trim() : ''
  const partName = typeof body?.part_name === 'string' ? body.part_name.trim() : ''
  const type = TYPE_KEYS.includes(body?.machine_type) ? body.machine_type : ''
  const typeRemark = typeof body?.type_remark === 'string' ? body.type_remark.trim() : ''

  if (name.length < 1 || name.length > 40) return NextResponse.json({ error: 'Machine name must be 1 to 40 characters' }, { status: 400 })
  if (machineNo.length < 1 || machineNo.length > 30) return NextResponse.json({ error: 'Machine number is required' }, { status: 400 })
  if (!type) return NextResponse.json({ error: 'Choose the machine type' }, { status: 400 })
  if (type === 'other' && (typeRemark.length < 1 || typeRemark.length > 30)) {
    return NextResponse.json({ error: 'Write the machine type for "Other"' }, { status: 400 })
  }
  if (partName.length < 1 || partName.length > 60) return NextResponse.json({ error: 'Part name is required' }, { status: 400 })

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
    machine_no: machineNo,
    machine_type: type,
    type_remark: type === 'other' ? typeRemark : null,
    part_name: partName,
    status: 'no_plan',
    position: (last?.position ?? 0) + 1,
    updated_by_name: ctx.shop.name,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
