import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, escapeHtml } from '@/lib/email'

const CATEGORIES = [
  'Technical help (using a cycle)',
  'New cycle / feature request',
  'Payment / membership',
  'Job / career',
  'Other',
]
const MAX_PER_DAY = 5

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please log in first' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  const category = String(body.category || '')
  const subject = String(body.subject || '').trim()
  const message = String(body.message || '').trim()

  if (!CATEGORIES.includes(category)) return NextResponse.json({ error: 'Please choose a category' }, { status: 400 })
  if (subject.length < 3 || subject.length > 120) return NextResponse.json({ error: 'Subject must be 3 to 120 characters' }, { status: 400 })
  if (message.length < 10 || message.length > 2000) return NextResponse.json({ error: 'Message must be 10 to 2000 characters' }, { status: 400 })

  const admin = createAdminClient()

  // Simple abuse guard: max 5 questions per user per 24 hours
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('queries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since)
  if ((count ?? 0) >= MAX_PER_DAY) {
    return NextResponse.json({ error: `You can send up to ${MAX_PER_DAY} questions per day. Please try again tomorrow.` }, { status: 429 })
  }

  const { data: row, error } = await admin
    .from('queries')
    .insert({ user_id: user.id, category, subject, message })
    .select()
    .single()
  if (error || !row) return NextResponse.json({ error: error?.message || 'Could not save your question' }, { status: 500 })

  // Email the admin (best effort — the question is already saved either way)
  let emailSent = false
  const notifyTo = process.env.ADMIN_NOTIFY_EMAIL
  if (notifyTo) {
    const { data: profile } = await admin
      .from('profiles')
      .select('full_name, phone, company_name, machine_type')
      .eq('id', user.id)
      .maybeSingle()

    const line = (label: string, value?: string | null) =>
      value ? `<tr><td style="padding:4px 12px 4px 0;color:#666">${label}</td><td style="padding:4px 0"><b>${escapeHtml(value)}</b></td></tr>` : ''

    const html = `
      <div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#222">
        <h2 style="margin:0 0 12px">New question on Machinest Studio</h2>
        <table style="margin-bottom:16px">
          ${line('Category', category)}
          ${line('From', profile?.full_name)}
          ${line('Email', user.email)}
          ${line('Phone', profile?.phone)}
          ${line('Company', profile?.company_name)}
          ${line('Machine', profile?.machine_type)}
        </table>
        <div style="font-size:16px;font-weight:700;margin-bottom:8px">${escapeHtml(subject)}</div>
        <div style="white-space:pre-wrap;background:#f5f5f5;border-radius:8px;padding:14px">${escapeHtml(message)}</div>
        <p style="color:#888;font-size:12px;margin-top:16px">Just reply to this email to answer the user directly.</p>
      </div>`

    emailSent = await sendEmail({
      to: notifyTo,
      subject: `[Machinest] ${category}: ${subject}`,
      html,
      replyTo: user.email || undefined,
    })
    if (emailSent) await admin.from('queries').update({ email_sent: true }).eq('id', row.id)
  }

  return NextResponse.json({ success: true, id: row.id })
}
