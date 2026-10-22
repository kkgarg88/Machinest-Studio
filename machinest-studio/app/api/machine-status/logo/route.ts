import 'server-only'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAuthedUser, getOwnerContext } from '@/lib/shop'

const BUCKET = 'shop-logos'
const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }

function pathFromUrl(url: string | null): string | null {
  if (!url) return null
  const marker = `/${BUCKET}/`
  const i = url.indexOf(marker)
  return i === -1 ? null : url.slice(i + marker.length).split('?')[0]
}

// Owner uploads or replaces the shop logo (PNG, JPG or WebP, up to 1 MB)
export async function POST(req: Request) {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const ctx = await getOwnerContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'Only the shop owner can do this' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'No file received' }, { status: 400 })

  const ext = TYPES[file.type]
  if (!ext) return NextResponse.json({ error: 'Logo must be a PNG, JPG or WebP image' }, { status: 400 })
  if (file.size > 1024 * 1024) return NextResponse.json({ error: 'Logo must be smaller than 1 MB' }, { status: 400 })

  const admin = createAdminClient()
  const path = `${ctx.shop.id}/logo-${Date.now()}.${ext}`
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, Buffer.from(await file.arrayBuffer()), {
    contentType: file.type, upsert: true,
  })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path)
  const { error } = await admin.from('shops').update({ logo_url: data.publicUrl }).eq('id', ctx.shop.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const old = pathFromUrl(ctx.shop.logo_url)
  if (old) await admin.storage.from(BUCKET).remove([old])

  return NextResponse.json({ success: true, url: data.publicUrl })
}

export async function DELETE() {
  const user = await getAuthedUser()
  if (!user) return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  const ctx = await getOwnerContext(user.id)
  if (!ctx) return NextResponse.json({ error: 'Only the shop owner can do this' }, { status: 403 })

  const admin = createAdminClient()
  const old = pathFromUrl(ctx.shop.logo_url)
  if (old) await admin.storage.from(BUCKET).remove([old])
  await admin.from('shops').update({ logo_url: null }).eq('id', ctx.shop.id)

  return NextResponse.json({ success: true })
}
