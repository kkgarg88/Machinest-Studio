import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildInvoicePdf, SELLER, money } from './invoice-pdf'

type Admin = ReturnType<typeof createAdminClient>

// Indian financial year runs April to March: Nov 2026 -> "2026-27"
function financialYear(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', year: 'numeric', month: 'numeric' }).formatToParts(d)
  const year = Number(parts.find(p => p.type === 'year')?.value)
  const month = Number(parts.find(p => p.type === 'month')?.value)
  const start = month >= 4 ? year : year - 1
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' })
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Sends the payment confirmation email with the invoice PDF attached.
// It never throws: a problem here must not undo a payment that already went through.
export async function sendPurchaseConfirmation(admin: Admin, order: any, expiresAtIso: string): Promise<void> {
  try {
    const key = process.env.RESEND_API_KEY
    if (!key) { console.error('Confirmation email skipped: RESEND_API_KEY is not set'); return }

    const now = new Date()
    const expires = new Date(expiresAtIso)

    // Invoice number: take the next one only if this order does not have one yet.
    let invoiceNo: string | null = order.invoice_no || null
    if (!invoiceNo) {
      const { data: no, error } = await admin.rpc('next_invoice_no', { p_fy: financialYear(now) })
      if (error || typeof no !== 'string') { console.error('Invoice number error:', error?.message); return }
      const { data: saved } = await admin
        .from('payment_orders').update({ invoice_no: no }).eq('id', order.id).is('invoice_no', null).select('invoice_no')
      invoiceNo = saved && saved.length > 0 ? no : order.invoice_no || no
    }

    const { data: authUser } = await admin.auth.admin.getUserById(order.user_id)
    const email = authUser?.user?.email
    if (!email) { console.error('Confirmation email skipped: user has no email'); return }

    const { data: profile } = await admin.from('profiles').select('full_name, phone').eq('id', order.user_id).maybeSingle()

    let planName = 'Machinest Studio'
    if (order.plan_id) {
      const { data: plan } = await admin.from('plans').select('name').eq('id', order.plan_id).maybeSingle()
      if (plan?.name) planName = plan.name
    }
    const toolIds: string[] = Array.isArray(order.tool_ids) ? order.tool_ids : []
    const { data: tools } = toolIds.length ? await admin.from('tools').select('id, name').in('id', toolIds) : { data: [] as any[] }
    const toolNames: string[] = (tools || []).map((t: any) => t.name).filter(Boolean)

    const total = Number(order.amount)
    const discount = Number(order.discount || 0)
    const billingLabel = order.billing_cycle === 'monthly' ? 'Monthly' : 'Yearly'

    const pdf = await buildInvoicePdf({
      invoiceNo: invoiceNo!,
      invoiceDate: fmtDate(now),
      customerName: profile?.full_name || '',
      customerEmail: email,
      customerPhone: profile?.phone || '',
      planName,
      billingLabel,
      toolNames,
      startDate: fmtDate(now),
      expiryDate: fmtDate(expires),
      subtotal: total + discount,
      discount,
      couponCode: order.coupon_code || '',
      total,
      orderId: order.razorpay_order_id,
    })

    const name = profile?.full_name ? esc(profile.full_name) : 'there'
    const html = `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#222">
  <div style="background:#F0801E;height:8px"></div>
  <h2 style="margin:20px 0 4px">Payment successful</h2>
  <p>Hi ${name}, thank you for your purchase. Your membership is now active.</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr><td style="padding:6px 0;color:#666">Plan</td><td style="text-align:right"><b>${esc(planName)} (${billingLabel})</b></td></tr>
    ${toolNames.length ? `<tr><td style="padding:6px 0;color:#666">Tools</td><td style="text-align:right">${esc(toolNames.join(', '))}</td></tr>` : ''}
    <tr><td style="padding:6px 0;color:#666">Amount paid</td><td style="text-align:right"><b>${money(total)}</b></td></tr>
    ${discount > 0 ? `<tr><td style="padding:6px 0;color:#666">Coupon ${esc(order.coupon_code || '')}</td><td style="text-align:right">- ${money(discount)}</td></tr>` : ''}
    <tr><td style="padding:6px 0;color:#666">Valid from</td><td style="text-align:right">${fmtDate(now)}</td></tr>
    <tr><td style="padding:6px 0;color:#666">Valid until</td><td style="text-align:right"><b>${fmtDate(expires)}</b></td></tr>
    <tr><td style="padding:6px 0;color:#666">Invoice no.</td><td style="text-align:right">${esc(invoiceNo!)}</td></tr>
  </table>
  <p style="margin-top:20px">Your invoice is attached to this email as a PDF.</p>
  <p><a href="https://app.machinest.in/dashboard" style="background:#F0801E;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Open dashboard</a></p>
  <p style="color:#888;font-size:12px;margin-top:28px">${SELLER.name}, ${SELLER.address} &middot; ${SELLER.phone} &middot; ${SELLER.email}</p>
</div>`

    const from = process.env.RESEND_FROM_EMAIL || 'Machinest Studio <onboarding@resend.dev>'
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [email],
        reply_to: SELLER.email,
        subject: `Payment successful - Invoice ${invoiceNo}`,
        html,
        attachments: [{ filename: `Invoice-${invoiceNo!.replace(/\//g, '-')}.pdf`, content: Buffer.from(pdf).toString('base64') }],
      }),
    })
    if (!res.ok) { console.error('Confirmation email failed:', res.status, await res.text().catch(() => '')); return }
    await admin.from('payment_orders').update({ confirmation_sent_at: new Date().toISOString() }).eq('id', order.id)
  } catch (e: unknown) {
    console.error('Confirmation email error:', e instanceof Error ? e.message : e)
  }
}
