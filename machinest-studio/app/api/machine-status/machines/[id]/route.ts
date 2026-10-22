import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser, getOwnerContext } from '@/lib/shop'
import { TYPE_KEYS } from '@/lib/machineStatus'

async function requireOwner() {
  const user = await getAuthedUser()
  if (!user) return { ok: false as const, status: 401, error: 'Not signed in' }
  const ctx = await getOwnerContext(user.id)
  if (!ctx) return { ok: false as const, status: 403, error: 'Only the shop owner can do this' }
  if (!ctx.active) return { ok: false as const, status: 403, error: 'Your subscription has expired. Renew to make changes' }
  return { ok: true as const, shop: ctx.shop }
}

// Owner edits a machine's name, number, type or part name
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const updates: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 1 || name.length > 40) return NextResponse.json({ error: 'Machine name must be 1 to 40 characters' }, { status: 400 })
    updates.name = name
  }
  if (body.machine_no !== undefined) {
    const no = typeof body.machine_no === 'string' ? body.machine_no.trim() : ''
    if (no.length < 1 || no.length > 30) return NextResponse.json({ error: 'Machine number is required' }, { status: 400 })
    updates.machine_no = no
  }
  if (body.part_name !== undefined) {
    const part = typeof body.part_name === 'string' ? body.part_name.trim() : ''
    if (part.length < 1 || part.length > 60) return NextResponse.json({ error: 'Part name is required' }, { status: 400 })
    updates.part_name = part
  }
  if (body.machine_type !== undefined) {
    if (!TYPE_KEYS.includes(body.machine_type)) return NextResponse.json({ error: 'Invalid machine type' }, { status: 400 })
    const remark = typeof body.type_remark === 'string' ? body.type_remark.trim() : ''
    if (body.machine_type === 'other' && (remark.length < 1 || remark.length > 30)) {
      return NextResponse.json({ error: 'Write the machine type for "Other"' }, { status: 400 })
    }
    updates.machine_type = body.machine_type
    updates.type_remark = body.machine_type === 'other' ? remark : null
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('machines').update(updates).eq('id', id).eq('shop_id', auth.shop.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const admin = createAdminClient()
  const { error } = await admin.from('machines').delete().eq('id', id).eq('shop_id', auth.shop.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
