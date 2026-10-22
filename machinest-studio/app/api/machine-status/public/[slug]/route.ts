import 'server-only'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { hasMachineStatusAccess, hasValidPinCookie, pinCookieName, pinToken, clientIpHash } from '@/lib/shop'
import { PIN_RE } from '@/lib/machineStatus'

async function findShop(slug: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('shops')
    .select('id, owner_id, name, slug, public_enabled, public_pin')
    .eq('slug', slug.toLowerCase())
    .maybeSingle()
  return data
}

// Public board data. Visitors never see operator names or phone numbers.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const shop = await findShop(slug)
  if (!shop || !shop.public_enabled) {
    return NextResponse.json({ state: 'not_found' }, { status: 404 })
  }

  const active = await hasMachineStatusAccess(shop.owner_id)
  if (!active) return NextResponse.json({ state: 'expired', shopName: shop.name })

  if (!(await hasValidPinCookie(shop))) {
    return NextResponse.json({ state: 'locked', shopName: shop.name })
  }

  const admin = createAdminClient()
  const { data: machines } = await admin
    .from('machines')
    .select('id, name, machine_no, icon, status, remark, status_since, updated_at')
    .eq('shop_id', shop.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  return NextResponse.json({ state: 'ok', shopName: shop.name, machines: machines || [] })
}

// Visitor enters the PIN
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const shop = await findShop(slug)
  if (!shop || !shop.public_enabled) return NextResponse.json({ error: 'This link is not available' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const pin = typeof body?.pin === 'string' ? body.pin.trim() : ''
  if (!PIN_RE.test(pin)) return NextResponse.json({ error: 'Enter the 4 to 6 digit PIN' }, { status: 400 })

  const admin = createAdminClient()
  const ipHash = await clientIpHash()
  const since15 = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const since60 = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { count: fromThisIp } = await admin
    .from('shop_pin_attempts').select('id', { count: 'exact', head: true })
    .eq('shop_id', shop.id).eq('ip_hash', ipHash).gte('created_at', since15)
  const { count: overall } = await admin
    .from('shop_pin_attempts').select('id', { count: 'exact', head: true })
    .eq('shop_id', shop.id).gte('created_at', since60)

  if ((fromThisIp ?? 0) >= 8 || (overall ?? 0) >= 80) {
    return NextResponse.json({ error: 'Too many wrong attempts. Please try again later' }, { status: 429 })
  }

  if (pin !== shop.public_pin) {
    await admin.from('shop_pin_attempts').insert({ shop_id: shop.id, ip_hash: ipHash })
    return NextResponse.json({ error: 'Wrong PIN' }, { status: 401 })
  }

  const jar = await cookies()
  jar.set(pinCookieName(shop.slug), pinToken(shop), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })

  return NextResponse.json({ success: true })
}
