import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActor, getAuthedUser, getOwnerContext } from '@/lib/shop'
import { partKey } from '@/lib/machineStatus'

// Owner sees every part; operators see only the active ones
export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Please log in again' }, { status: 401 })
  const admin = createAdminClient()
  let q = admin.from('parts').select('id, name, customer, active').eq('shop_id', actor.shop.id).order('name', { ascending: true })
  if (actor.kind !== 'owner') q = q.eq('active', true)
  const { data } = await q
  return NextResponse.json({ parts: data || [] })
}

// Only the owner adds parts
export async function POST(req: Request) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const ctx = await getOwnerContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'Only the shop owner can add parts' }, { status: 403 })
  if (!ctx.active) return NextResponse.json({ error: 'Your subscription has expired. Renew to make changes' }, { status: 403 })

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : ''
  const customer = typeof body?.customer === 'string' ? body.customer.trim().slice(0, 60) : ''
  if (name.length < 1 || name.length > 60) return NextResponse.json({ error: 'Part name must be 1 to 60 characters' }, { status: 400 })

  const admin = createAdminClient()
  const key = partKey(name)
  const { data: dup } = await admin.from('parts').select('name').eq('shop_id', ctx.shop.id).eq('name_key', key).maybeSingle()
  if (dup) return NextResponse.json({ error: `This part already exists as "${dup.name}"` }, { status: 409 })

  const { error } = await admin.from('parts').insert({ shop_id: ctx.shop.id, name, name_key: key, customer: customer || null })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
