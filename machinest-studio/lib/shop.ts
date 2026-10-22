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
  public_enabled: boolean
  public_pin: string
  join_code: string
  created_at: string
}

export type ShopContext =
  | { role: 'owner' | 'operator'; shop: ShopRow; active: boolean }
  | { role: null; shop: null; active: false }

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

// Works out whether the user owns a shop, works as an operator in one, or neither.
// "active" is the OWNER's subscription state, which governs the whole shop.
export async function getContext(userId: string): Promise<ShopContext> {
  const admin = createAdminClient()

  const { data: owned } = await admin.from('shops').select('*').eq('owner_id', userId).maybeSingle()
  if (owned) {
    const active = await hasMachineStatusAccess(userId)
    return { role: 'owner', shop: owned as ShopRow, active }
  }

  const { data: member } = await admin.from('shop_members').select('shop_id').eq('user_id', userId).maybeSingle()
  if (member) {
    const { data: shop } = await admin.from('shops').select('*').eq('id', member.shop_id).maybeSingle()
    if (shop) {
      const active = await hasMachineStatusAccess(shop.owner_id)
      return { role: 'operator', shop: shop as ShopRow, active }
    }
  }

  return { role: null, shop: null, active: false }
}

// 8 characters, no look-alike letters (no 0/O, 1/I)
export function makeJoinCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) code += alphabet[crypto.randomInt(alphabet.length)]
  return code
}

// ---- Public link PIN ----
function secret(): string {
  return process.env.LEAD_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'machinest'
}

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

export async function displayNameOf(userId: string): Promise<string> {
  const admin = createAdminClient()
  const { data } = await admin.from('profiles').select('full_name, email').eq('id', userId).maybeSingle()
  return data?.full_name || (data?.email ? String(data.email).split('@')[0] : 'Operator')
}
