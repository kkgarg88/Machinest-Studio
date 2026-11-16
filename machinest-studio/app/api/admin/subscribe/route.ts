import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const DEFAULT_GRANT_DAYS = 30

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

  // Granting access always sets a fresh expiry date (default 30 days, or body.days up to 3650).
  // Cancelling leaves the existing date alone.
  const row: { user_id: string; tool_id: string; status: string; expires_at?: string } = {
    user_id: body.userId,
    tool_id: body.toolId,
    status: body.status,
  }
  if (body.status === 'active') {
    const days = Number.isInteger(body.days) && body.days >= 1 && body.days <= 3650 ? body.days : DEFAULT_GRANT_DAYS
    row.expires_at = new Date(Date.now() + days * 86400000).toISOString()
  }

  const admin = createAdminClient()
  const { error } = await admin.from('subscriptions').upsert(row, { onConflict: 'user_id,tool_id' })
  if (error) return NextResponse.json({ error: 'Could not update subscription' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
