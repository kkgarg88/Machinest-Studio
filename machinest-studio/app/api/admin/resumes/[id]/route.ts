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

// Returns a short-lived download link for one resume.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const admin = createAdminClient()

  const { data: row, error } = await admin.from('resumes').select('file_path, file_name').eq('id', id).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!row) return NextResponse.json({ error: 'Resume not found' }, { status: 404 })

  const { data, error: urlErr } = await admin.storage
    .from('resumes')
    .createSignedUrl(row.file_path, 300, { download: row.file_name })
  if (urlErr || !data) return NextResponse.json({ error: urlErr?.message || 'Could not create link' }, { status: 500 })

  return NextResponse.json({ url: data.signedUrl })
}

// Removes the file and its record (e.g. if a user asks for deletion).
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const admin = createAdminClient()

  const { data: row } = await admin.from('resumes').select('file_path').eq('id', id).maybeSingle()
  if (row?.file_path) await admin.storage.from('resumes').remove([row.file_path])

  const { error } = await admin.from('resumes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
