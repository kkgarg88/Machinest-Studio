import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser, getOwnerContext, hashOperatorPin } from '@/lib/shop'
import { PIN_RE, cleanPhone } from '@/lib/machineStatus'

async function requireOwner() {
  const user = await getAuthedUser()
  if (!user) return { ok: false as const, status: 401, error: 'Not signed in' }
  const ctx = await getOwnerContext(user.id)
  if (!ctx) return { ok: false as const, status: 403, error: 'Only the shop owner can do this' }
  return { ok: true as const, shop: ctx.shop }
}

// Owner edits an operator: name, phone, or sets a new PIN (which logs that phone out)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const admin = createAdminClient()
  const { data: op } = await admin.from('shop_operators').select('id').eq('id', id).eq('shop_id', auth.shop.id).maybeSingle()
  if (!op) return NextResponse.json({ error: 'Operator not found' }, { status: 404 })

  const updates: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 2 || name.length > 40) return NextResponse.json({ error: 'Operator name must be 2 to 40 characters' }, { status: 400 })
    updates.name = name
  }
  if (body.phone !== undefined) {
    const raw = typeof body.phone === 'string' ? body.phone.trim() : ''
    const phone = cleanPhone(raw)
    if (raw && !phone) return NextResponse.json({ error: 'Enter a valid phone number or leave it empty' }, { status: 400 })
    updates.phone = phone
  }
  if (body.pin !== undefined) {
    const pin = typeof body.pin === 'string' ? body.pin.trim() : ''
    if (!PIN_RE.test(pin)) return NextResponse.json({ error: 'PIN must be 4 to 6 digits' }, { status: 400 })
    updates.pin_hash = hashOperatorPin(id, pin)
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { error } = await admin.from('shop_operators').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOwner()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const admin = createAdminClient()
  const { error } = await admin.from('shop_operators').delete().eq('id', id).eq('shop_id', auth.shop.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
