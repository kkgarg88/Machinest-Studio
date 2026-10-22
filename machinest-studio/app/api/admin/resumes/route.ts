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

// Lists every uploaded resume together with the owner's profile details.
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const admin = createAdminClient()

  const { data: resumes, error } = await admin
    .from('resumes')
    .select('id, user_id, file_name, file_size, job_interest, preferred_location, consent, updated_at')
    .order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (resumes || []).map(r => r.user_id)
  let profiles: any[] = []
  if (ids.length > 0) {
    const { data: p, error: pErr } = await admin
      .from('profiles')
      .select('id, full_name, email, phone, company_name, machine_type, experience_years')
      .in('id', ids)
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
    profiles = p || []
  }

  const byId = new Map(profiles.map(p => [p.id, p]))
  const result = (resumes || []).map(r => ({ ...r, profile: byId.get(r.user_id) || null }))

  return NextResponse.json({ resumes: result })
}
