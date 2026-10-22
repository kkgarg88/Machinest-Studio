import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser, getContext, hasMachineStatusAccess, makeJoinCode } from '@/lib/shop'
import { checkSlug, PIN_RE } from '@/lib/machineStatus'

// Create the shop (owner with an active Machine Status subscription)
export async function POST(req: Request) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  if (!(await hasMachineStatusAccess(user.id))) {
    return NextResponse.json({ error: 'An active Machine Status subscription is required' }, { status: 403 })
  }

  const ctx = await getContext(user.id)
  if (ctx.role) return NextResponse.json({ error: 'You already belong to a shop' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const slug = typeof body?.slug === 'string' ? body.slug.trim().toLowerCase() : ''
  const pin = typeof body?.pin === 'string' ? body.pin.trim() : ''

  if (name.length < 2 || name.length > 60) return NextResponse.json({ error: 'Shop name must be 2 to 60 characters' }, { status: 400 })
  const slugError = checkSlug(slug)
  if (slugError) return NextResponse.json({ error: slugError }, { status: 400 })
  if (!PIN_RE.test(pin)) return NextResponse.json({ error: 'PIN must be 4 to 6 digits' }, { status: 400 })

  const admin = createAdminClient()
  const { data: taken } = await admin.from('shops').select('id').eq('slug', slug).maybeSingle()
  if (taken) return NextResponse.json({ error: 'This link name is already taken. Please choose another' }, { status: 409 })

  // Retry in the very unlikely case of a duplicate join code
  for (let i = 0; i < 5; i++) {
    const { error } = await admin.from('shops').insert({
      owner_id: user.id, name, slug, public_pin: pin, join_code: makeJoinCode(),
    })
    if (!error) return NextResponse.json({ success: true })
    if (!String(error.message).includes('join_code')) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }
  return NextResponse.json({ error: 'Could not create the shop. Please try again' }, { status: 500 })
}

// Owner settings: name, link name, public link on/off, PIN, new join code
export async function PATCH(req: Request) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const ctx = await getContext(user.id)
  if (ctx.role !== 'owner') return NextResponse.json({ error: 'Only the shop owner can do this' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const admin = createAdminClient()
  const updates: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 2 || name.length > 60) return NextResponse.json({ error: 'Shop name must be 2 to 60 characters' }, { status: 400 })
    updates.name = name
  }

  if (body.slug !== undefined) {
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
    const slugError = checkSlug(slug)
    if (slugError) return NextResponse.json({ error: slugError }, { status: 400 })
    if (slug !== ctx.shop.slug) {
      const { data: taken } = await admin.from('shops').select('id').eq('slug', slug).maybeSingle()
      if (taken) return NextResponse.json({ error: 'This link name is already taken. Please choose another' }, { status: 409 })
      updates.slug = slug
    }
  }

  if (body.public_enabled !== undefined) updates.public_enabled = !!body.public_enabled

  if (body.pin !== undefined) {
    const pin = typeof body.pin === 'string' ? body.pin.trim() : ''
    if (!PIN_RE.test(pin)) return NextResponse.json({ error: 'PIN must be 4 to 6 digits' }, { status: 400 })
    updates.public_pin = pin
  }

  if (body.regenerate_join_code) updates.join_code = makeJoinCode()

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { error } = await admin.from('shops').update(updates).eq('id', ctx.shop.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
