import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const VALID_TYPES = ['video', 'pdf', 'excel', 'calculator', 'link']

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
  const { data, error } = await admin
    .from('resources')
    .select('*')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resources: data })
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const { title, description, resource_type, url, category, thumbnail_url, display_order, active } = body

  if (!title || !String(title).trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }
  if (!url || !String(url).trim()) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 })
  }
  if (!VALID_TYPES.includes(resource_type)) {
    return NextResponse.json({ error: 'Invalid resource_type' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('resources')
    .insert({
      title: String(title).trim(),
      description: description ? String(description).trim() : null,
      resource_type,
      url: String(url).trim(),
      category: category ? String(category).trim() : null,
      thumbnail_url: thumbnail_url ? String(thumbnail_url).trim() : null,
      display_order: Number.isFinite(Number(display_order)) ? Number(display_order) : 0,
      active: active !== false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resource: data })
}
