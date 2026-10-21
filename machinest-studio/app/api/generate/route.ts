import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCycleLogic, getCycleIntro } from '@/lib/cycles/logic'
import { generateLimiter } from '@/lib/rate-limit'
import { hasCycleAccess } from '@/lib/access'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please login again' }, { status: 401 })

  const { success } = await generateLimiter.limit(user.id)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  const isIntro = body?.intro === true
  if (
    !body ||
    typeof body.cycleId !== 'string' ||
    (!isIntro && (typeof body.values !== 'object' || body.values === null))
  ) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data: cycle } = await supabase
    .from('cycles')
    .select('id, code, tool_id, tools(slug)')
    .eq('id', body.cycleId)
    .single()
  if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })

  const rel: any = cycle.tools
  const toolSlug: string | undefined = Array.isArray(rel) ? rel[0]?.slug : rel?.slug

  const allowed = await hasCycleAccess(supabase, user.id, cycle.id, cycle.tool_id)
  if (!allowed) return NextResponse.json({ error: 'You do not have access to this tool' }, { status: 403 })

  const key = `${toolSlug}:${cycle.code}`

  if (isIntro) {
    const intro = getCycleIntro(key)
    return NextResponse.json({ svg: intro ? intro() : '' })
  }

  const logic = getCycleLogic(key)
  if (!logic) return NextResponse.json({ error: 'This cycle is coming soon' }, { status: 404 })

  const result = logic(body.values)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 })

  return NextResponse.json({ gcode: result.gcode, svg: result.svg, programName: result.programName })
}