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

// Updates a plan. Sending only { active: boolean } just shows/hides it.
// Plans are never hard-deleted so old payment records keep pointing at them.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const admin = createAdminClient()

  // Quick show/hide
  if (Object.keys(body).length === 1 && typeof body.active === 'boolean') {
    const { error } = await admin.from('plans').update({ active: body.active }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  // Full edit
  const name = String(body?.name || '').trim()
  if (!name) return NextResponse.json({ error: 'Plan name is required' }, { status: 400 })

  const toolIds: string[] = Array.isArray(body?.tool_ids) ? body.tool_ids.map(String) : []
  if (toolIds.length === 0) return NextResponse.json({ error: 'Select at least one tool for this plan' }, { status: 400 })

  const { data: found } = await admin.from('tools').select('id').in('id', toolIds)
  if (!found || found.length !== toolIds.length) {
    return NextResponse.json({ error: 'One or more selected tools do not exist' }, { status: 400 })
  }

  const monthly = Number(body?.monthly_price)
  if (!Number.isFinite(monthly) || monthly <= 0) {
    return NextResponse.json({ error: 'Monthly price must be greater than 0' }, { status: 400 })
  }

  let annual: number | null = null
  if (body?.annual_price !== null && body?.annual_price !== undefined && String(body.annual_price).trim() !== '') {
    annual = Number(body.annual_price)
    if (!Number.isFinite(annual) || annual <= 0) {
      return NextResponse.json({ error: 'Annual price must be greater than 0, or left empty' }, { status: 400 })
    }
  }

  const features = Array.isArray(body?.features)
    ? body.features.map((f: unknown) => String(f).trim()).filter(Boolean)
    : []
  const order = Number(body?.display_order)

  const { error } = await admin
    .from('plans')
    .update({
      name,
      description: body?.description ? String(body.description).trim() : null,
      tool_ids: toolIds,
      monthly_price: monthly,
      annual_price: annual,
      features: features.length > 0 ? features : null,
      badge: body?.badge ? String(body.badge).trim() : null,
      display_order: Number.isFinite(order) ? order : 0,
      active: body?.active !== false,
    })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
