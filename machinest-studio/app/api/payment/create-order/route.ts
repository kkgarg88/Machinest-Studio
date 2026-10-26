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
    const planId = body?.planId
    const couponCode = typeof body?.couponCode === 'string' ? body.couponCode.trim().toUpperCase() : ''

    if (typeof planId !== 'string' || !['monthly', 'annual'].includes(cycle)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // The plan and its price always come from the database, never from the browser
    const { data: plan } = await supabase
      .from('plans')
      .select('id, name, tool_ids, monthly_price, annual_price, active')
      .eq('id', planId)
      .eq('active', true)
      .maybeSingle()
    if (!plan) {
      return NextResponse.json({ error: 'This plan is not available' }, { status: 400 })
    }

    const price = cycle === 'monthly' ? plan.monthly_price : plan.annual_price
    if (price === null || price === undefined || Number(price) <= 0) {
      return NextResponse.json({ error: `This plan is not available for ${cycle} billing` }, { status: 400 })
    }

    const toolIds: string[] = plan.tool_ids || []
    if (toolIds.length === 0) {
      return NextResponse.json({ error: 'This plan has no tools' }, { status: 400 })
    }

    // Do not let someone pay twice for a tool they already have
    const nowIso = new Date().toISOString()
    const { data: activeSubs } = await supabase
      .from('subscriptions')
      .select('tool_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .in('tool_id', toolIds)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    if (activeSubs && activeSubs.length > 0) {
      return NextResponse.json(
        { error: 'You already have an active membership for one or more tools in this plan. You can buy it again once it expires.' },
        { status: 400 }
      )
    }

    const subtotal = Number(price)

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
      discount = Math.min(discount, subtotal - 1) // always charge at least ₹1
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
      notes: { user_id: user.id, cycle, plan: plan.name, coupon: couponCode || 'none' },
    })

    // The order row is written by the server (not by the browser user), so nobody can
    // create or edit their own order rows. verify and the webhook read tool_ids from here.
    const { error } = await admin.from('payment_orders').insert({
      user_id: user.id,
      razorpay_order_id: order.id,
      tool_ids: toolIds,
      billing_cycle: cycle,
      amount,
      coupon_code: couponCode || null,
      discount,
      plan_id: plan.id,
    })
    if (error) {
      console.error('Order insert error:', error.message)
      return NextResponse.json({ error: 'Could not start the payment. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      subtotal,
      discount,
    })
  } catch (e: unknown) {
    console.error('Create order error:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Could not start the payment. Please try again.' }, { status: 500 })
  }
}
