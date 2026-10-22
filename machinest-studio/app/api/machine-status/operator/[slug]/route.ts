import 'server-only'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getOperatorSession, hashOperatorPin, operatorToken, clientIpHash, OPERATOR_COOKIE, type OperatorRow,
} from '@/lib/shop'
import { PIN_RE } from '@/lib/machineStatus'

async function findShop(slug: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('shops')
    .select('id, owner_id, name, slug, logo_url')
    .eq('slug', slug.toLowerCase())
    .maybeSingle()
  return data
}

// Operator page data: login list, or the machines once logged in on this phone
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const shop = await findShop(slug)
  if (!shop) return NextResponse.json({ state: 'not_found' }, { status: 404 })

  const session = await getOperatorSession()
  const admin = createAdminClient()

  if (session && session.shop.id === shop.id) {
    const { data: machines } = await admin
      .from('machines')
      .select('id, name, machine_no, machine_type, type_remark, part_name, status, remark, status_since, updated_by_name')
      .eq('shop_id', shop.id)
      .order('position', { ascending: true })
      .order('created_at', { ascending: true })

    return NextResponse.json({
      state: 'ok',
      shopName: shop.name,
      logoUrl: shop.logo_url,
      operatorName: session.operator.name,
      active: session.active,
      machines: machines || [],
    })
  }

  const { data: operators } = await admin
    .from('shop_operators').select('id, name').eq('shop_id', shop.id).order('created_at', { ascending: true })

  return NextResponse.json({ state: 'login', shopName: shop.name, logoUrl: shop.logo_url, operators: operators || [] })
}

// Operator logs in with their name + personal PIN
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const shop = await findShop(slug)
  if (!shop) return NextResponse.json({ error: 'This link is not available' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const operatorId = typeof body?.operatorId === 'string' ? body.operatorId : ''
  const pin = typeof body?.pin === 'string' ? body.pin.trim() : ''
  if (!operatorId || !PIN_RE.test(pin)) return NextResponse.json({ error: 'Choose your name and enter your 4 to 6 digit PIN' }, { status: 400 })

  const admin = createAdminClient()
  const ipHash = 'op:' + (await clientIpHash())
  const since15 = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  const since60 = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const { count: fromThisIp } = await admin
    .from('shop_pin_attempts').select('id', { count: 'exact', head: true })
    .eq('shop_id', shop.id).eq('ip_hash', ipHash).gte('created_at', since15)
  const { count: overall } = await admin
    .from('shop_pin_attempts').select('id', { count: 'exact', head: true })
    .eq('shop_id', shop.id).like('ip_hash', 'op:%').gte('created_at', since60)

  if ((fromThisIp ?? 0) >= 8 || (overall ?? 0) >= 60) {
    return NextResponse.json({ error: 'Too many wrong attempts. Please try again later' }, { status: 429 })
  }

  const { data: op } = await admin.from('shop_operators').select('*').eq('id', operatorId).eq('shop_id', shop.id).maybeSingle()
  if (!op || op.pin_hash !== hashOperatorPin(op.id, pin)) {
    await admin.from('shop_pin_attempts').insert({ shop_id: shop.id, ip_hash: ipHash })
    return NextResponse.json({ error: 'Wrong PIN' }, { status: 401 })
  }

  const jar = await cookies()
  jar.set(OPERATOR_COOKIE, operatorToken(op as OperatorRow), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })

  return NextResponse.json({ success: true })
}

// Operator logs out of this phone
export async function DELETE() {
  const jar = await cookies()
  jar.delete(OPERATOR_COOKIE)
  return NextResponse.json({ success: true })
}
