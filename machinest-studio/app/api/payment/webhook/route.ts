import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { fulfilOrder, safeEqualHex } from '@/lib/payments/fulfil'

export async function POST(req: Request) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    console.error('RAZORPAY_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }

  const rawBody = await req.text()
  const signature = req.headers.get('x-razorpay-signature')

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')

  if (!safeEqualHex(expected, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  let payload: any
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if (payload?.event !== 'payment.captured') {
    return NextResponse.json({ ok: true })
  }

  const orderId = payload?.payload?.payment?.entity?.order_id
  if (typeof orderId !== 'string' || !orderId) return NextResponse.json({ ok: true })

  const admin = createAdminClient()
  const result = await fulfilOrder(admin, orderId)

  // On a real failure answer with an error so Razorpay sends the webhook again later.
  if (result === 'error') return NextResponse.json({ error: 'Could not process' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
