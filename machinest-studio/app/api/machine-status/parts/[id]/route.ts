import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser, getOwnerContext } from '@/lib/shop'
import { partKey } from '@/lib/machineStatus'

async function requireOwner() {
  const user = await getAuthedUser()
  if (!user) return { ok: false as const, status: 401, error: 'Not signed in' }
  const ctx = await getOwnerContext(user.id)
  if (!ctx) return { ok: false as const, status: 403, error: 'Only the shop owner can do this' }
  if (!ctx.active) return { ok: false as const, status: 403, error: 'Your subscription has expired. Renew to make changes' }
  return { ok: true as const, shop: ctx.shop }
}

// Rename, change customer, or switch a part on/off
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const admin = createAdminClient()
  const updates: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
    if (name.length < 1 || name.length > 60) return NextResponse.json({ error: 'Part name must be 1 to 60 characters' }, { status: 400 })
    const key = partKey(name)
    const { data: dup } = await admin.from('parts').select('id, name').eq('shop_id', auth.shop.id).eq('name_key', key).neq('id', id).maybeSingle()
    if (dup) return NextResponse.json({ error: `This part already exists as "${dup.name}"` }, { status: 409 })
    updates.name = name
    updates.name_key = key
  }
  if (body.customer !== undefined) {
    const c = typeof body.customer === 'string' ? body.customer.trim().slice(0, 60) : ''
    updates.customer = c || null
  }
  if (body.active !== undefined) updates.active = !!body.active
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { error } = await admin.from('parts').update(updates).eq('id', id).eq('shop_id', auth.shop.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // keep the name shown on machines in step with a rename
  if (updates.name) await admin.from('machines').update({ part_name: updates.name }).eq('part_id', id).eq('shop_id', auth.shop.id)
  return NextResponse.json({ success: true })
}

// A part that has history is switched off instead of deleted, so reports stay complete
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  const admin = createAdminClient()

  const { count: used } = await admin.from('machine_status_log').select('id', { count: 'exact', head: true }).eq('part_id', id).eq('shop_id', auth.shop.id)
  const { count: onMachine } = await admin.from('machines').select('id', { count: 'exact', head: true }).eq('part_id', id).eq('shop_id', auth.shop.id)
  if ((used ?? 0) > 0 || (onMachine ?? 0) > 0) {
    return NextResponse.json({ error: 'This part has history, so it cannot be deleted. Switch it off instead' }, { status: 409 })
  }
  const { error } = await admin.from('parts').delete().eq('id', id).eq('shop_id', auth.shop.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
