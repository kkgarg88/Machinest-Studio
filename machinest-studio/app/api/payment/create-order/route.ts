import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Please login again' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const cycle = body?.cycle
    const toolIds = body?.toolIds
    const couponCode = typeof body?.couponCode === 'string' ? body.couponCode.trim().toUpperCase() : ''

    if (!Array.isArray(toolIds) || toolIds.length === 0 || !['monthly', 'annual'].includes(cycle)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { data: tools } = await supabase.from('tools').select('id, monthly_price, annual_price').in('id', toolIds)
    if (!tools || tools.length !== toolIds.length) {
      return NextResponse.json({ error: 'One or more tools are invalid' }, { status: 400 })
    }

    const subtotal = tools.reduce(
      (sum, t) => sum + Number(cycle === 'monthly' ? t.monthly_price : t.annual_price),
      0
    )

    let discount = 0
    const admin = createAdminClient()

    if (couponCode) {
      const { data: coupon } = await admin.from('coupons').select('*').eq('code', couponCode).eq('active', true).maybeSingle()
      if (!coupon) {
        return NextResponse.json({ error: 'Invalid coupon code' }, { status: 400 })
      }
      if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
        return NextResponse.json({ error: 'This coupon has expired' }, { status: 400 })
      }
      if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
        return NextResponse.json({ error: 'This coupon has reached its usage limit' }, { status: 400 })
      }
      discount = coupon.discount_type === 'percent'
        ? Math.round((subtotal * Number(coupon.discount_value)) / 100)
        : Number(coupon.discount_value)
      discount = Math.min(discount, subtotal - 1) // kam se kam ₹1 to charge karna hi hai
      if (discount < 0) discount = 0
    }

    const amount = subtotal - discount

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100),
      currency: 'INR',
      notes: { user_id: user.id, cycle, coupon: couponCode || 'none' },
    })

    const { error } = await supabase.from('payment_orders').insert({
      user_id: user.id,
      razorpay_order_id: order.id,
      tool_ids: toolIds,
      billing_cycle: cycle,
      amount,
      coupon_code: couponCode || null,
      discount,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      subtotal,
      discount,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}