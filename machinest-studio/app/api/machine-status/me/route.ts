import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser, getOwnerContext, hasMachineStatusAccess } from '@/lib/shop'
import { MAX_MACHINES, MAX_OPERATORS, DEFAULT_SHIFTS } from '@/lib/machineStatus'

// Owner's view of their own shop
export async function GET() {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const ctx = await getOwnerContext(user.id)
  if (!ctx) {
    const canCreate = await hasMachineStatusAccess(user.id)
    return NextResponse.json({ role: null, canCreate })
  }

  const admin = createAdminClient()
  const { data: machines } = await admin
    .from('machines')
    .select('*')
    .eq('shop_id', ctx.shop.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  const { data: operators } = await admin
    .from('shop_operators')
    .select('id, name, phone, created_at')
    .eq('shop_id', ctx.shop.id)
    .order('created_at', { ascending: true })

  const { data: parts } = await admin
    .from('parts')
    .select('id, name, customer, active')
    .eq('shop_id', ctx.shop.id)
    .order('name', { ascending: true })

  const s = ctx.shop
  return NextResponse.json({
    role: 'owner',
    active: ctx.active,
    shop: { id: s.id, name: s.name, slug: s.slug, logo_url: s.logo_url, public_enabled: s.public_enabled, public_pin: s.public_pin, shift_count: s.shift_count ?? 2, shifts: s.shifts ?? DEFAULT_SHIFTS },
    machines: machines || [],
    parts: parts || [],
    operators: operators || [],
    limits: { machines: MAX_MACHINES, operators: MAX_OPERATORS },
  })
}
