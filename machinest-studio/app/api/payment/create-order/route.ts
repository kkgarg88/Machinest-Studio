import { NextResponse } from 'next/server'
import Razorpay from 'razorpay'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Please login again' }, { status: 401 })

    const body = await req.json().catch(() => null)
    const cycle = body?.cycle
    const toolIds = body?.toolIds
    if (!Array.isArray(toolIds) || toolIds.length === 0 || !['monthly', 'annual'].includes(cycle)) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const { data: tools } = await supabase.from('tools').select('id, monthly_price, annual_price').in('id', toolIds)
    if (!tools || tools.length !== toolIds.length) {
      return NextResponse.json({ error: 'One or more tools are invalid' }, { status: 400 })
    }

    const amount = tools.reduce(
      (sum, t) => sum + Number(cycle === 'monthly' ? t.monthly_price : t.annual_price),
      0
    )

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    })

    const order = await razorpay.orders.create({
      amount: Math.round(amount * 100), // paise mein
      currency: 'INR',
      notes: { user_id: user.id, cycle },
    })

    const { error } = await supabase.from('payment_orders').insert({
      user_id: user.id,
      razorpay_order_id: order.id,
      tool_ids: toolIds,
      billing_cycle: cycle,
      amount,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Server error' }, { status: 500 })
  }
}