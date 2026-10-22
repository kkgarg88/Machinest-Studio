import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser, getContext, displayNameOf } from '@/lib/shop'
import { STATUS_KEYS } from '@/lib/machineStatus'

// Owner or any operator of the shop updates a machine's status
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const ctx = await getContext(user.id)
  if (!ctx.role) return NextResponse.json({ error: 'You are not in a shop' }, { status: 403 })
  if (!ctx.active) return NextResponse.json({ error: 'This shop\'s subscription has expired. Status cannot be updated' }, { status: 403 })

  const { id } = await params
  const body = await req.json().catch(() => null)
  const status = typeof body?.status === 'string' ? body.status : ''
  const remark = typeof body?.remark === 'string' ? body.remark.trim().slice(0, 200) : ''

  if (!STATUS_KEYS.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  if (status === 'other' && !remark) return NextResponse.json({ error: 'Please write a remark for "Other"' }, { status: 400 })

  const admin = createAdminClient()
  const { data: machine } = await admin.from('machines').select('id, status, remark').eq('id', id).eq('shop_id', ctx.shop.id).maybeSingle()
  if (!machine) return NextResponse.json({ error: 'Machine not found' }, { status: 404 })

  const now = new Date().toISOString()
  const name = await displayNameOf(user.id)
  const statusChanged = machine.status !== status

  const updates: Record<string, unknown> = {
    status,
    remark: remark || null,
    updated_at: now,
    updated_by: user.id,
    updated_by_name: name,
  }
  // The "time in this status" clock only restarts when the status itself changes
  if (statusChanged) updates.status_since = now

  const { error } = await admin.from('machines').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await admin.from('machine_status_log').insert({
    machine_id: id,
    shop_id: ctx.shop.id,
    status,
    remark: remark || null,
    changed_by: user.id,
    changed_by_name: name,
  })

  return NextResponse.json({ success: true })
}
