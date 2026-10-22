import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser, getContext, hasMachineStatusAccess, displayNameOf } from '@/lib/shop'
import { MAX_MACHINES, MAX_OPERATORS } from '@/lib/machineStatus'

export async function GET() {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const ctx = await getContext(user.id)
  if (!ctx.role) {
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

  let members: { id: string; name: string; created_at: string }[] = []
  if (ctx.role === 'owner') {
    const { data: rows } = await admin.from('shop_members').select('id, user_id, created_at').eq('shop_id', ctx.shop.id)
    members = await Promise.all(
      (rows || []).map(async r => ({ id: r.id as string, name: await displayNameOf(r.user_id), created_at: r.created_at as string }))
    )
  }

  // Operators never see the PIN or the join code
  const shop = ctx.role === 'owner'
    ? ctx.shop
    : { id: ctx.shop.id, name: ctx.shop.name, slug: ctx.shop.slug, public_enabled: ctx.shop.public_enabled }

  return NextResponse.json({
    role: ctx.role,
    active: ctx.active,
    shop,
    machines: machines || [],
    members,
    limits: { machines: MAX_MACHINES, operators: MAX_OPERATORS },
  })
}
