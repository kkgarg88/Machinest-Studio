import 'server-only'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

// Compare two hex signatures in constant time.
export function safeEqualHex(a: unknown, b: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length === 0 || a.length !== b.length) return false
  if (!/^[0-9a-fA-F]+$/.test(a) || !/^[0-9a-fA-F]+$/.test(b)) return false
  const ba = Buffer.from(a, 'hex')
  const bb = Buffer.from(b, 'hex')
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

export type FulfilResult = 'done' | 'already' | 'not_found' | 'error'

// Add 1 to a coupon's used_count without losing a count when two requests overlap.
// It only writes if used_count is still what we just read, otherwise it reads again.
async function bumpCoupon(admin: Admin, rawCode: string) {
  const code = rawCode.trim().toUpperCase()
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: coupon, error } = await admin
      .from('coupons')
      .select('id, used_count')
      .eq('code', code)
      .maybeSingle()
    if (error) { console.error('Coupon fetch error:', error.message); return }
    if (!coupon) { console.error('Coupon not found for code:', code); return }

    const current: number | null = coupon.used_count ?? null
    let q = admin.from('coupons').update({ used_count: (current ?? 0) + 1 }).eq('id', coupon.id)
    q = current === null ? q.is('used_count', null) : q.eq('used_count', current)
    const { data: updated, error: upErr } = await q.select('id')
    if (upErr) { console.error('Coupon update error:', upErr.message); return }
    if (updated && updated.length > 0) return
  }
  console.error('Coupon count could not be updated for code:', code)
}

// Gives the user access for a paid order. Safe to call from verify and the webhook
// at the same moment: only one of them wins the "mark as paid" step and grants access.
export async function fulfilOrder(
  admin: Admin,
  razorpayOrderId: string,
  userId?: string,
): Promise<FulfilResult> {
  let find = admin.from('payment_orders').select('*').eq('razorpay_order_id', razorpayOrderId)
  if (userId) find = find.eq('user_id', userId)
  const { data: order, error: findErr } = await find.maybeSingle()
  if (findErr) { console.error('Order lookup error:', findErr.message); return 'error' }
  if (!order) return 'not_found'
  if (order.status === 'paid') return 'already'
  const previousStatus: string = order.status ?? 'created'

  // Claim the order. Only one caller can change it to "paid".
  const { data: claimed, error: claimErr } = await admin
    .from('payment_orders')
    .update({ status: 'paid' })
    .eq('id', order.id)
    .or('status.is.null,status.neq.paid')
    .select('id')
  if (claimErr) { console.error('Order claim error:', claimErr.message); return 'error' }
  if (!claimed || claimed.length === 0) return 'already'

  const toolIds: string[] = Array.isArray(order.tool_ids) ? order.tool_ids : []
  const days = order.billing_cycle === 'monthly' ? 30 : 365
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

  const rows = toolIds.map(toolId => ({
    user_id: order.user_id,
    tool_id: toolId,
    status: 'active',
    billing_cycle: order.billing_cycle,
    expires_at: expiresAt,
  }))

  if (rows.length > 0) {
    const { error: subError } = await admin.from('subscriptions').upsert(rows, { onConflict: 'user_id,tool_id' })
    if (subError) {
      console.error('Subscription grant error:', subError.message)
      // Put the order back so a retry (verify again, or Razorpay's webhook retry) can finish the job.
      await admin.from('payment_orders').update({ status: previousStatus }).eq('id', order.id)
      return 'error'
    }
  }

  if (order.coupon_code) await bumpCoupon(admin, order.coupon_code)

  return 'done'
}
