import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActor } from '@/lib/shop'
import { STATUS_KEYS } from '@/lib/machineStatus'

// The owner, or any operator logged in on their phone, updates a machine's status
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Please log in again' }, { status: 401 })
  if (!actor.active) {
    return NextResponse.json({ error: 'This shop\'s subscription has expired. Status cannot be updated' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json().catch(() => null)
  const status = typeof body?.status === 'string' ? body.status : ''
  const remark = typeof body?.remark === 'string' ? body.remark.trim().slice(0, 200) : ''
  const partId = typeof body?.part_id === 'string' ? body.part_id : ''

  if (!STATUS_KEYS.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  if (status === 'other' && !remark) return NextResponse.json({ error: 'Please write a remark for "Other"' }, { status: 400 })
  if (!partId) return NextResponse.json({ error: 'Choose the part from the list' }, { status: 400 })

  const admin = createAdminClient()
  const { data: machine } = await admin.from('machines').select('id, status, part_id').eq('id', id).eq('shop_id', actor.shop.id).maybeSingle()
  if (!machine) return NextResponse.json({ error: 'Machine not found' }, { status: 404 })

  const { data: part } = await admin.from('parts').select('id, name, active').eq('id', partId).eq('shop_id', actor.shop.id).maybeSingle()
  if (!part || (!part.active && part.id !== machine.part_id)) {
    return NextResponse.json({ error: 'This part is not in the list. Ask the owner to add it' }, { status: 400 })
  }

  const now = new Date().toISOString()
  const updates: Record<string, unknown> = {
    status,
    remark: remark || null,
    part_name: part.name,
    part_id: part.id,
    updated_at: now,
    updated_by: actor.kind === 'owner' ? actor.userId : null,
    updated_by_name: actor.name,
  }
  // "From" time restarts only when the status itself changes
  if (machine.status !== status) updates.status_since = now

  const { error } = await admin.from('machines').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('machine_status_log').insert({
    machine_id: id,
    shop_id: actor.shop.id,
    status,
    remark: remark || null,
    part_name: part.name,
    part_id: part.id,
    changed_by: actor.kind === 'owner' ? actor.userId : null,
    changed_by_name: actor.name,
  })

  return NextResponse.json({ success: true })
}
