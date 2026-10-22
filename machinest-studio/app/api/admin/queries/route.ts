import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, error: 'Not signed in' }

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (!profile?.is_admin) return { ok: false as const, status: 403, error: 'Admin access required' }

  return { ok: true as const, user }
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const admin = createAdminClient()

  const { data: queries, error } = await admin
    .from('queries')
    .select('id, user_id, category, subject, message, status, email_sent, created_at')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = Array.from(new Set((queries || []).map(q => q.user_id)))
  let profiles: any[] = []
  if (ids.length > 0) {
    const { data: p, error: pErr } = await admin
      .from('profiles')
      .select('id, full_name, email, phone, company_name')
      .in('id', ids)
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
    profiles = p || []
  }

  const byId = new Map(profiles.map(p => [p.id, p]))
  const result = (queries || []).map(q => ({ ...q, profile: byId.get(q.user_id) || null }))

  return NextResponse.json({ queries: result })
}
