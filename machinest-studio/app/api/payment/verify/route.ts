import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { fulfilOrder, safeEqualHex } from '@/lib/payments/fulfil'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Please login again' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body || {}
    if (
      typeof razorpay_order_id !== 'string' || typeof razorpay_payment_id !== 'string' ||
      typeof razorpay_signature !== 'string' || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature
    ) {
      return NextResponse.json({ error: 'Invalid payment data' }, { status: 400 })
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (!safeEqualHex(expectedSignature, razorpay_signature)) {
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
    }

    const admin = createAdminClient()
    const result = await fulfilOrder(admin, razorpay_order_id, user.id)

    if (result === 'not_found') return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (result === 'error') {
      return NextResponse.json(
        { error: 'Your payment was received but we could not activate it yet. Please try again in a minute or contact support.' },
        { status: 500 }
      )
    }
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    console.error('Payment verify error:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
