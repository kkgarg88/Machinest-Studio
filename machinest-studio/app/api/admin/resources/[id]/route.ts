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

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (typeof body.title === 'string') updates.title = body.title.trim()
  if (typeof body.description === 'string') updates.description = body.description.trim()
  if (typeof body.resource_type === 'string') {
    if (!VALID_TYPES.includes(body.resource_type)) {
      return NextResponse.json({ error: 'Invalid resource_type' }, { status: 400 })
    }
    updates.resource_type = body.resource_type
  }
  if (typeof body.url === 'string') updates.url = body.url.trim()
  if (typeof body.category === 'string') updates.category = body.category.trim()
  if (body.display_order !== undefined && Number.isFinite(Number(body.display_order))) {
    updates.display_order = Number(body.display_order)
  }
  if (typeof body.active === 'boolean') updates.active = body.active

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('resources')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ resource: data })
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params

  const admin = createAdminClient()
  const { error } = await admin.from('resources').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
