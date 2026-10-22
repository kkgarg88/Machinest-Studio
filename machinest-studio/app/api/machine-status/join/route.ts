import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser, getContext } from '@/lib/shop'
import { MAX_OPERATORS } from '@/lib/machineStatus'

// An operator joins a shop with the owner's join code
export async function POST(req: Request) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const ctx = await getContext(user.id)
  if (ctx.role) return NextResponse.json({ error: 'You already belong to a shop' }, { status: 400 })

  const body = await req.json().catch(() => null)
  const code = typeof body?.code === 'string' ? body.code.trim().toUpperCase() : ''
  if (code.length < 6 || code.length > 12) return NextResponse.json({ error: 'Enter the join code your owner gave you' }, { status: 400 })

  const admin = createAdminClient()
  const { data: shop } = await admin.from('shops').select('id, name').eq('join_code', code).maybeSingle()
  if (!shop) return NextResponse.json({ error: 'This join code is not valid' }, { status: 404 })

  const { count } = await admin.from('shop_members').select('id', { count: 'exact', head: true }).eq('shop_id', shop.id)
  if ((count ?? 0) >= MAX_OPERATORS) {
    return NextResponse.json({ error: `This shop already has ${MAX_OPERATORS} operators` }, { status: 400 })
  }

  const { error } = await admin.from('shop_members').insert({ shop_id: shop.id, user_id: user.id, role: 'operator' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, shopName: shop.name })
}
