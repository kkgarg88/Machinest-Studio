import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please login again' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || !Array.isArray(body.toolIds) || body.toolIds.some((id: unknown) => typeof id !== 'string')) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  if (body.toolIds.length === 0) {
    return NextResponse.json({ ok: true }) // "skip" ke liye, kuch karne ki zaroorat nahi
  }

  // confirm karo ye tool IDs asli hain
  const { data: validTools } = await supabase.from('tools').select('id').in('id', body.toolIds)
  const validIds = (validTools || []).map(t => t.id)
  if (validIds.length !== body.toolIds.length) {
    return NextResponse.json({ error: 'One or more tools are invalid' }, { status: 400 })
  }

  // TODO: Razorpay live hone ke baad, yahan payment verify karke
  // tabhi neeche wala insert chalega

  const admin = createAdminClient()
  const rows = validIds.map(toolId => ({ user_id: user.id, tool_id: toolId, status: 'active' }))
  const { error } = await admin.from('subscriptions').upsert(rows, { onConflict: 'user_id,tool_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}