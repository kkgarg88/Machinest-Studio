import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { tutorialLimiter } from '@/lib/rate-limit'
import { hasCycleAccess } from '@/lib/access'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please login again' }, { status: 401 })

  const { success } = await tutorialLimiter.limit(user.id)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please wait a moment and try again.' }, { status: 429 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body.cycleId !== 'string') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data: cycle } = await supabase
    .from('cycles')
    .select('id, tool_id, tutorial_video_url')
    .eq('id', body.cycleId)
    .single()
  if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })

  const allowed = await hasCycleAccess(supabase, user.id, cycle.id, cycle.tool_id)
  if (!allowed) return NextResponse.json({ error: 'You do not have access to this tool' }, { status: 403 })

  if (!cycle.tutorial_video_url) {
    return NextResponse.json({ error: 'Tutorial video coming soon' }, { status: 404 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.storage.from('tutorials').createSignedUrl(cycle.tutorial_video_url, 3600)
  if (error || !data) return NextResponse.json({ error: 'Could not load video' }, { status: 500 })

  return NextResponse.json({ url: data.signedUrl })
}