import 'server-only'

// Minimal Resend sender (no extra npm package needed).
// Env vars:
//   RESEND_API_KEY       (required to send)
//   RESEND_FROM_EMAIL    (optional, e.g. "Machinest Studio <hello@machinest.in>")
export async function sendEmail(opts: {
  to: string
  subject: string
  html: string
  replyTo?: string
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) return false

  const from = process.env.RESEND_FROM_EMAIL || 'Machinest Studio <onboarding@resend.dev>'

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
