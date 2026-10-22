import 'server-only'
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser, getOwnerContext, hashOperatorPin } from '@/lib/shop'
import { MAX_OPERATORS, PIN_RE, cleanPhone } from '@/lib/machineStatus'

// Owner adds an operator: name, optional phone, personal PIN
export async function POST(req: Request) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const ctx = await getOwnerContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'Only the shop owner can do this' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const pin = typeof body?.pin === 'string' ? body.pin.trim() : ''
  const phoneRaw = typeof body?.phone === 'string' ? body.phone.trim() : ''
  const phone = cleanPhone(phoneRaw)

  if (name.length < 2 || name.length > 40) return NextResponse.json({ error: 'Operator name must be 2 to 40 characters' }, { status: 400 })
  if (!PIN_RE.test(pin)) return NextResponse.json({ error: 'PIN must be 4 to 6 digits' }, { status: 400 })
  if (phoneRaw && !phone) return NextResponse.json({ error: 'Enter a valid phone number or leave it empty' }, { status: 400 })

  const admin = createAdminClient()
  const { data: existing } = await admin.from('shop_operators').select('id, name').eq('shop_id', ctx.shop.id)
  if ((existing?.length ?? 0) >= MAX_OPERATORS) {
    return NextResponse.json({ error: `You can add up to ${MAX_OPERATORS} operators` }, { status: 400 })
  }
  if ((existing || []).some(o => String(o.name).toLowerCase() === name.toLowerCase())) {
    return NextResponse.json({ error: 'An operator with this name already exists' }, { status: 409 })
  }

  const id = crypto.randomUUID()
  const { error } = await admin.from('shop_operators').insert({
    id, shop_id: ctx.shop.id, name, phone, pin_hash: hashOperatorPin(id, pin),
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
