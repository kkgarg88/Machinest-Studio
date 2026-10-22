import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser, getContext } from '@/lib/shop'

// Owner removes an operator (?memberId=...) or an operator leaves the shop (?leave=1)
export async function DELETE(req: Request) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })

  const ctx = await getContext(user.id)
  if (!ctx.role) return NextResponse.json({ error: 'You are not in a shop' }, { status: 400 })

  const url = new URL(req.url)
  const admin = createAdminClient()

  if (url.searchParams.get('leave')) {
    if (ctx.role !== 'operator') return NextResponse.json({ error: 'Owners cannot leave their own shop' }, { status: 400 })
    await admin.from('shop_members').delete().eq('user_id', user.id)
    return NextResponse.json({ success: true })
  }

  const memberId = url.searchParams.get('memberId')
  if (!memberId) return NextResponse.json({ error: 'Missing operator' }, { status: 400 })
  if (ctx.role !== 'owner') return NextResponse.json({ error: 'Only the shop owner can do this' }, { status: 403 })

  const { error } = await admin.from('shop_members').delete().eq('id', memberId).eq('shop_id', ctx.shop.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
