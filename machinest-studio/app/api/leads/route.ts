import 'server-only'
import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail, escapeHtml } from '@/lib/email'

const SERVICES = [
  'CNC Programming',
  'Technical Consulting',
  'Machine Shop Optimization',
  'Process & Product Optimization',
  'On-demand Manufacturing',
  'Custom Software / Tools',
  'Other',
]
const MAX_PER_IP_PER_DAY = 5
const MAX_PER_PHONE_PER_DAY = 3

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

  // Honeypot: real people never fill this hidden field. Pretend success to bots.
  if (typeof body.website === 'string' && body.website.trim() !== '') {
    return NextResponse.json({ success: true })
  }

  const name = String(body.name || '').trim()
  const phone = String(body.phone || '').trim()
  const email = String(body.email || '').trim()
  const service = String(body.service_type || '')
  const message = String(body.message || '').trim()

  if (name.length < 2 || name.length > 80) return NextResponse.json({ error: 'Please enter your name' }, { status: 400 })
  const digits = phone.replace(/\D/g, '')
  if (!/^[0-9+\-\s()]{7,20}$/.test(phone) || digits.length < 7 || digits.length > 15) {
    return NextResponse.json({ error: 'Please enter a valid phone number' }, { status: 400 })
  }
  if (email && (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return NextResponse.json({ error: 'Please enter a valid email or leave it empty' }, { status: 400 })
  }
  if (!SERVICES.includes(service)) return NextResponse.json({ error: 'Please choose a service' }, { status: 400 })
  if (message.length < 10 || message.length > 2000) {
    return NextResponse.json({ error: 'Please describe what you need (10 to 2000 characters)' }, { status: 400 })
  }

  // Logged-in users get linked to their account (optional)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = createAdminClient()

  // Spam guard. We store only a salted hash of the IP, never the IP itself.
  const fwd = req.headers.get('x-forwarded-for') || ''
  const ip = fwd.split(',')[0].trim() || req.headers.get('x-real-ip') || 'unknown'
  const ipHash = crypto.createHash('sha256').update(ip + (process.env.LEAD_SALT || 'machinest')).digest('hex')
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { count: ipCount } = await admin
    .from('leads').select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash).gte('created_at', since)
  if ((ipCount ?? 0) >= MAX_PER_IP_PER_DAY) {
    return NextResponse.json({ error: 'Too many requests today. Please try again tomorrow.' }, { status: 429 })
  }

  const { count: phoneCount } = await admin
    .from('leads').select('id', { count: 'exact', head: true })
    .eq('phone', phone).gte('created_at', since)
  if ((phoneCount ?? 0) >= MAX_PER_PHONE_PER_DAY) {
    return NextResponse.json({ error: 'We already have your requests. We will contact you soon.' }, { status: 429 })
  }

  const { data: row, error } = await admin
    .from('leads')
    .insert({
      user_id: user?.id ?? null,
      name,
      phone,
      email: email || user?.email || null,
      service_type: service,
      message,
      ip_hash: ipHash,
    })
    .select()
    .single()
  if (error || !row) return NextResponse.json({ error: 'Could not send your request. Please try again.' }, { status: 500 })

  // Email the admin (best effort; the lead is already saved)
  const notifyTo = process.env.ADMIN_NOTIFY_EMAIL
  if (notifyTo) {
    const replyTo = row.email || undefined
    const html = `
      <div style="font-family:Segoe UI,Arial,sans-serif;font-size:14px;color:#222">
        <h2 style="margin:0 0 12px">New custom services request</h2>
        <table style="margin-bottom:16px">
          <tr><td style="padding:4px 12px 4px 0;color:#666">Service</td><td><b>${escapeHtml(service)}</b></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Name</td><td><b>${escapeHtml(name)}</b></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#666">Phone</td><td><b>${escapeHtml(phone)}</b></td></tr>
          ${row.email ? `<tr><td style="padding:4px 12px 4px 0;color:#666">Email</td><td><b>${escapeHtml(row.email)}</b></td></tr>` : ''}
          <tr><td style="padding:4px 12px 4px 0;color:#666">Account</td><td>${user ? 'Registered user' : 'Visitor (not logged in)'}</td></tr>
        </table>
        <div style="white-space:pre-wrap;background:#f5f5f5;border-radius:8px;padding:14px">${escapeHtml(message)}</div>
      </div>`
    const sent = await sendEmail({
      to: notifyTo,
      subject: `[Machinest Lead] ${service} - ${name}`,
      html,
      replyTo,
    })
    if (sent) await admin.from('leads').update({ email_sent: true }).eq('id', row.id)
  }

  return NextResponse.json({ success: true })
}
