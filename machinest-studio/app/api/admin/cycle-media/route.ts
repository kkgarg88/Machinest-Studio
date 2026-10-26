import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'cycle-thumbs'
const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }
const DESC_MAX = 200

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, error: 'Not signed in' }
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (!profile?.is_admin) return { ok: false as const, status: 403, error: 'Admin access required' }
  return { ok: true as const }
}

function pathFromUrl(url: string | null): string | null {
  if (!url) return null
  const marker = `/${BUCKET}/`
  const i = url.indexOf(marker)
  return i === -1 ? null : url.slice(i + marker.length).split('?')[0]
}

// All cycles grouped by tool, with their current thumbnail and description
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const admin = createAdminClient()
  const [{ data: tools, error: e1 }, { data: cycles, error: e2 }] = await Promise.all([
    admin.from('tools').select('id, name, slug').order('name'),
    admin.from('cycles').select('id, tool_id, code, name, thumbnail_url, description').order('code'),
  ])
  if (e1 || e2) return NextResponse.json({ error: (e1 || e2)!.message }, { status: 500 })

  const groups = (tools || []).map(t => ({ tool: t, cycles: (cycles || []).filter(c => c.tool_id === t.id) })).filter(g => g.cycles.length > 0)
  return NextResponse.json({ groups })
}

// Upload or replace the thumbnail of one cycle (PNG, JPG or WebP, up to 2 MB)
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  const cycleId = String(form?.get('cycleId') ?? '')
  if (!cycleId) return NextResponse.json({ error: 'Cycle is missing' }, { status: 400 })
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file received' }, { status: 400 })
  const ext = TYPES[file.type]
  if (!ext) return NextResponse.json({ error: 'Thumbnail must be a PNG, JPG or WebP image' }, { status: 400 })
  if (file.size > 2 * 1024 * 1024) return NextResponse.json({ error: 'Thumbnail must be smaller than 2 MB' }, { status: 400 })

  const admin = createAdminClient()
  const { data: cycle } = await admin.from('cycles').select('id, thumbnail_url').eq('id', cycleId).maybeSingle()
  if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })

  const path = `${cycleId}/thumb-${Date.now()}.${ext}`
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path)
  const { error } = await admin.from('cycles').update({ thumbnail_url: data.publicUrl }).eq('id', cycleId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const old = pathFromUrl(cycle.thumbnail_url)
  if (old) await admin.storage.from(BUCKET).remove([old])
  return NextResponse.json({ success: true, url: data.publicUrl })
}

// Save the brief description
export async function PATCH(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => null)
  const cycleId = String(body?.cycleId ?? '')
  if (!cycleId) return NextResponse.json({ error: 'Cycle is missing' }, { status: 400 })
  const text = String(body?.description ?? '').trim()
  if (text.length > DESC_MAX) return NextResponse.json({ error: `Description can be up to ${DESC_MAX} characters` }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('cycles').update({ description: text || null }).eq('id', cycleId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// Remove the thumbnail (the tile goes back to the small icon)
export async function DELETE(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => null)
  const cycleId = String(body?.cycleId ?? '')
  if (!cycleId) return NextResponse.json({ error: 'Cycle is missing' }, { status: 400 })

  const admin = createAdminClient()
  const { data: cycle } = await admin.from('cycles').select('thumbnail_url').eq('id', cycleId).maybeSingle()
  const old = pathFromUrl(cycle?.thumbnail_url ?? null)
  if (old) await admin.storage.from(BUCKET).remove([old])
  const { error } = await admin.from('cycles').update({ thumbnail_url: null }).eq('id', cycleId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
