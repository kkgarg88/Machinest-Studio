import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Please login again' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body || {}
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Invalid payment data' }, { status: 400 })
    }

    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex')

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: order } = await admin
      .from('payment_orders')
      .select('*')
      .eq('razorpay_order_id', razorpay_order_id)
      .eq('user_id', user.id)
      .single()

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
    if (order.status === 'paid') return NextResponse.json({ ok: true }) // dobara verify na ho

    const days = order.billing_cycle === 'monthly' ? 30 : 365
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

    const rows = order.tool_ids.map((toolId: string) => ({
      user_id: user.id,
      tool_id: toolId,
      status: 'active',
      billing_cycle: order.billing_cycle,
      expires_at: expiresAt,
    }))

    const { error: subError } = await admin.from('subscriptions').upsert(rows, { onConflict: 'user_id,tool_id' })
    if (subError) return NextResponse.json({ error: subError.message }, { status: 500 })

    await admin.from('payment_orders').update({ status: 'paid' }).eq('id', order.id)

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}