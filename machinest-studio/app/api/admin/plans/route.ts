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

// Validates and cleans the fields shared by create and update.
async function cleanPlan(admin: ReturnType<typeof createAdminClient>, body: any) {
  const name = String(body?.name || '').trim()
  if (!name) return { error: 'Plan name is required' }

  const toolIds: string[] = Array.isArray(body?.tool_ids) ? body.tool_ids.map(String) : []
  if (toolIds.length === 0) return { error: 'Select at least one tool for this plan' }

  const { data: found } = await admin.from('tools').select('id').in('id', toolIds)
  if (!found || found.length !== toolIds.length) return { error: 'One or more selected tools do not exist' }

  const monthly = Number(body?.monthly_price)
  if (!Number.isFinite(monthly) || monthly <= 0) return { error: 'Monthly price must be greater than 0' }

  let annual: number | null = null
  if (body?.annual_price !== null && body?.annual_price !== undefined && String(body.annual_price).trim() !== '') {
    annual = Number(body.annual_price)
    if (!Number.isFinite(annual) || annual <= 0) return { error: 'Annual price must be greater than 0, or left empty' }
  }

  const features = Array.isArray(body?.features)
    ? body.features.map((f: unknown) => String(f).trim()).filter(Boolean)
    : []

  const order = Number(body?.display_order)

  return {
    value: {
      name,
      description: body?.description ? String(body.description).trim() : null,
      tool_ids: toolIds,
      monthly_price: monthly,
      annual_price: annual,
      features: features.length > 0 ? features : null,
      badge: body?.badge ? String(body.badge).trim() : null,
      display_order: Number.isFinite(order) ? order : 0,
      active: body?.active !== false,
    },
  }
}

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const admin = createAdminClient()
  const { data: plans, error } = await admin.from('plans').select('*').order('display_order', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: tools } = await admin.from('tools').select('id, name').order('name', { ascending: true })

  return NextResponse.json({ plans: plans || [], tools: tools || [] })
}

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => null)
  const admin = createAdminClient()

  const cleaned = await cleanPlan(admin, body)
  if ('error' in cleaned) return NextResponse.json({ error: cleaned.error }, { status: 400 })

  const { data, error } = await admin.from('plans').insert(cleaned.value).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ plan: data })
}
