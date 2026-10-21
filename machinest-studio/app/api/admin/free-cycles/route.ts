import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false as const, status: 401, error: 'Not signed in' }

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
  if (!profile?.is_admin) return { ok: false as const, status: 403, error: 'Admin access required' }

  return { ok: true as const, user }
}

// Returns every tool, each with its cycles and whether that cycle is
// currently the free one (so the admin UI can render radio buttons).
export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const admin = createAdminClient()

  const { data: tools, error: toolsError } = await admin
    .from('tools')
    .select('id, name, slug')
    .order('name', { ascending: true })
  if (toolsError) return NextResponse.json({ error: toolsError.message }, { status: 500 })

  const { data: cycles, error: cyclesError } = await admin
    .from('cycles')
    .select('id, code, name, tool_id')
    .order('code', { ascending: true })
  if (cyclesError) return NextResponse.json({ error: cyclesError.message }, { status: 500 })

  const { data: freeCycles, error: freeError } = await admin
    .from('free_cycles')
    .select('cycle_id')
  if (freeError) return NextResponse.json({ error: freeError.message }, { status: 500 })

  const freeIds = new Set((freeCycles || []).map(f => f.cycle_id))

  const result = (tools || []).map(tool => ({
    tool,
    cycles: (cycles || [])
      .filter(c => c.tool_id === tool.id)
      .map(c => ({ ...c, isFree: freeIds.has(c.id) })),
  }))

  return NextResponse.json({ tools: result })
}

// Sets (or clears) the single free cycle for a given tool.
// Body: { toolId: string, cycleId: string | null }
// Any existing free cycle belonging to that tool is cleared first,
// so a tool only ever has one free cycle at a time.
export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => null)
  if (!body || !body.toolId) {
    return NextResponse.json({ error: 'toolId is required' }, { status: 400 })
  }
  const { toolId, cycleId } = body as { toolId: string; cycleId: string | null }

  const admin = createAdminClient()

  const { data: toolCycles, error: toolCyclesError } = await admin
    .from('cycles')
    .select('id')
    .eq('tool_id', toolId)
  if (toolCyclesError) return NextResponse.json({ error: toolCyclesError.message }, { status: 500 })

  const cycleIds = (toolCycles || []).map(c => c.id)
  if (cycleIds.length > 0) {
    const { error: clearError } = await admin.from('free_cycles').delete().in('cycle_id', cycleIds)
    if (clearError) return NextResponse.json({ error: clearError.message }, { status: 500 })
  }

  if (cycleId) {
    const { error: insertError } = await admin.from('free_cycles').insert({ cycle_id: cycleId })
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
