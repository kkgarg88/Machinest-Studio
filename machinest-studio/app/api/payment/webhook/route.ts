import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const rawBody = await req.text()
  const signature = req.headers.get('x-razorpay-signature')

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex')

  if (signature !== expected) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const payload = JSON.parse(rawBody)
  if (payload.event !== 'payment.captured') {
    return NextResponse.json({ ok: true }) // baaki events ignore
  }

  const orderId = payload.payload.payment.entity.order_id
  const admin = createAdminClient()

  const { data: order } = await admin
    .from('payment_orders')
    .select('*')
    .eq('razorpay_order_id', orderId)
    .single()

  if (!order) return NextResponse.json({ ok: true }) // order hi nahi mila, kuch nahi karna
  if (order.status === 'paid') return NextResponse.json({ ok: true }) // already ho chuka

  const days = order.billing_cycle === 'monthly' ? 30 : 365
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

  const rows = order.tool_ids.map((toolId: string) => ({
    user_id: order.user_id,
    tool_id: toolId,
    status: 'active',
    billing_cycle: order.billing_cycle,
    expires_at: expiresAt,
  }))

  await admin.from('subscriptions').upsert(rows, { onConflict: 'user_id,tool_id' })
  await admin.from('payment_orders').update({ status: 'paid' }).eq('id', order.id)

  return NextResponse.json({ ok: true })
}