import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please login again' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Not allowed' }, { status: 403 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body.userId !== 'string' || typeof body.toolId !== 'string' || typeof body.status !== 'string') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (!['active', 'cancelled'].includes(body.status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('subscriptions').upsert(
    { user_id: body.userId, tool_id: body.toolId, status: body.status },
    { onConflict: 'user_id,tool_id' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}