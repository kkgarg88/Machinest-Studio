import 'server-only'
import crypto from 'crypto'
import { cookies, headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type ShopRow = {
  id: string
  owner_id: string
  name: string
  slug: string
  logo_url: string | null
  public_enabled: boolean
  public_pin: string
  created_at: string
}

export type OperatorRow = {
  id: string
  shop_id: string
  name: string
  phone: string | null
  pin_hash: string
  created_at: string
}

export type Actor =
  | { kind: 'owner'; shop: ShopRow; active: boolean; userId: string; name: string }
  | { kind: 'operator'; shop: ShopRow; active: boolean; operatorId: string; name: string }

function secret(): string {
  return process.env.LEAD_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'machinest'
}

export async function getAuthedUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Does this user hold an active (unexpired) Machine Status subscription?
// Admins always pass, so you can test without buying.
export async function hasMachineStatusAccess(userId: string): Promise<boolean> {
  const admin = createAdminClient()

  const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', userId).maybeSingle()
  if (profile?.is_admin) return true

  const { data: tool } = await admin.from('tools').select('id').eq('slug', 'machine-status').maybeSingle()
  if (!tool) return false

  const nowIso = new Date().toISOString()
  const { data: subs } = await admin
    .from('subscriptions')
    .select('id')
    .eq('user_id', userId)
    .eq('tool_id', tool.id)
    .eq('status', 'active')
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
    .limit(1)

  return !!subs && subs.length > 0
}

// The shop owned by this user (if any), with the owner's subscription state
export async function getOwnerContext(userId: string): Promise<{ shop: ShopRow; active: boolean } | null> {
  const admin = createAdminClient()
  const { data: shop } = await admin.from('shops').select('*').eq('owner_id', userId).maybeSingle()
  if (!shop) return null
  const active = await hasMachineStatusAccess(userId)
  return { shop: shop as ShopRow, active }
}

export async function displayNameOf(userId: string): Promise<string> {
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('full_name, email').eq('id', userId).maybeSingle()
  return data?.full_name || (data?.email ? String(data.email).split('@')[0] : 'Owner')
}

// ---- Operators (link + personal PIN, no account) ----
export const OPERATOR_COOKIE = 'ms_op'

export function hashOperatorPin(operatorId: string, pin: string): string {
  return crypto.createHmac('sha256', secret()).update(`op:${operatorId}:${pin}`).digest('hex')
}

// Cookie value is tied to the operator's PIN hash, so resetting the PIN
// or removing the operator logs that phone out straight away.
export function operatorToken(op: Pick<OperatorRow, 'id' | 'pin_hash'>): string {
  const sig = crypto.createHmac('sha256', secret()).update(`session:${op.id}:${op.pin_hash}`).digest('hex')
  return `${op.id}.${sig}`
}

export async function getOperatorSession(): Promise<{ operator: OperatorRow; shop: ShopRow; active: boolean } | null> {
  const jar = await cookies()
  const value = jar.get(OPERATOR_COOKIE)?.value
  if (!value) return null
  const dot = value.indexOf('.')
  if (dot < 1) return null
  const id = value.slice(0, dot)
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null

  const admin = createAdminClient()
  const { data: op } = await admin.from('shop_operators').select('*').eq('id', id).maybeSingle()
  if (!op) return null

  const a = Buffer.from(value)
  const b = Buffer.from(operatorToken(op as OperatorRow))
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null

  const { data: shop } = await admin.from('shops').select('*').eq('id', op.shop_id).maybeSingle()
  if (!shop) return null
  const active = await hasMachineStatusAccess(shop.owner_id)
  return { operator: op as OperatorRow, shop: shop as ShopRow, active }
}

// Whoever is making this request: the signed-in owner, or an operator on their phone
export async function getActor(): Promise<Actor | null> {
  const user = await getAuthedUser()
  if (user) {
    const ctx = await getOwnerContext(user.id)
    if (ctx) return { kind: 'owner', shop: ctx.shop, active: ctx.active, userId: user.id, name: await displayNameOf(user.id) }
  }
  const session = await getOperatorSession()
  if (session) {
    return { kind: 'operator', shop: session.shop, active: session.active, operatorId: session.operator.id, name: session.operator.name }
  }
  return null
}

// ---- Public link PIN ----
// Token stored in the visitor's cookie after the right PIN. It is tied to the PIN,
// so changing the PIN instantly locks out everyone who had the old one.
export function pinToken(shop: Pick<ShopRow, 'id' | 'public_pin'>): string {
  return crypto.createHmac('sha256', secret()).update(`${shop.id}:${shop.public_pin}`).digest('hex')
}

export function pinCookieName(slug: string): string {
  return `ms_pin_${slug}`
}

export async function hasValidPinCookie(shop: Pick<ShopRow, 'id' | 'slug' | 'public_pin'>): Promise<boolean> {
  const jar = await cookies()
  const value = jar.get(pinCookieName(shop.slug))?.value
  if (!value) return false
  const a = Buffer.from(value)
  const b = Buffer.from(pinToken(shop))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export async function clientIpHash(): Promise<string> {
  const h = await headers()
  const ip = (h.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown'
  return crypto.createHash('sha256').update(`${secret()}:${ip}`).digest('hex').slice(0, 32)
}
