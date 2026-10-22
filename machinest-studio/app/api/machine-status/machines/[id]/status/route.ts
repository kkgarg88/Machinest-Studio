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
  const partName = typeof body?.part_name === 'string' ? body.part_name.trim() : ''

  if (!STATUS_KEYS.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  if (status === 'other' && !remark) return NextResponse.json({ error: 'Please write a remark for "Other"' }, { status: 400 })
  if (partName.length < 1 || partName.length > 60) return NextResponse.json({ error: 'Part name is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data: machine } = await admin.from('machines').select('id, status').eq('id', id).eq('shop_id', actor.shop.id).maybeSingle()
  if (!machine) return NextResponse.json({ error: 'Machine not found' }, { status: 404 })

  const now = new Date().toISOString()
  const updates: Record<string, unknown> = {
    status,
    remark: remark || null,
    part_name: partName,
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
    part_name: partName,
    changed_by: actor.kind === 'owner' ? actor.userId : null,
    changed_by_name: actor.name,
  })

  return NextResponse.json({ success: true })
}
