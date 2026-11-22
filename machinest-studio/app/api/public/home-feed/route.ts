import { createClient } from '@/lib/supabase/server'

// Public, read-only feed for the www.machinest.in Home page:
// the latest free resources and the latest YouTube videos.
const CHANNEL_ID = 'UCQatarspJrTzS2kBN14hjlw' // youtube.com/@Machinest
const ALLOWED_ORIGINS = ['https://machinest.in', 'https://www.machinest.in']

type ResourceRow = {
  id: string
  title: string
  description: string | null
  resource_type: string
  url: string
  thumbnail_url: string | null
}

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null
    if (host.endsWith('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v) return v
      const m = u.pathname.match(/^\/(embed|shorts|live)\/([^/?]+)/)
      if (m) return m[2]
    }
  } catch {}
  return null
}

function driveId(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname !== 'drive.google.com' && u.hostname !== 'docs.google.com') return null
    const m = u.pathname.match(/\/d\/([^/?]+)/)
    if (m) return m[1]
    return u.searchParams.get('id')
  } catch {}
  return null
}

function thumbFor(r: ResourceRow): string | null {
  if (r.thumbnail_url && r.thumbnail_url.trim()) {
    const t = r.thumbnail_url.trim()
    const id = driveId(t)
    return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w800` : t
  }
  if (r.resource_type === 'video') {
    const id = youtubeId(r.url)
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
  }
  return null
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

async function latestVideos(): Promise<{ id: string; title: string; published: string }[]> {
  try {
    const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`, {
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return []
    const xml = await res.text()
    const out: { id: string; title: string; published: string }[] = []
    const entries = xml.split('<entry>').slice(1)
    for (const e of entries) {
      const id = e.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1]
      const title = e.match(/<title>([^<]*)<\/title>/)?.[1]
      const published = e.match(/<published>([^<]+)<\/published>/)?.[1] || ''
      if (id && title) out.push({ id, title: decodeXml(title), published })
      if (out.length >= 6) break
    }
    return out
  } catch {
    return []
  }
}

export async function GET(request: Request) {
  const origin = request.headers.get('origin') || ''
  const headers: Record<string, string> = {
    'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600',
    Vary: 'Origin',
  }
  if (ALLOWED_ORIGINS.includes(origin)) headers['Access-Control-Allow-Origin'] = origin

  let resources: { id: string; title: string; description: string | null; type: string; url: string; thumb: string | null }[] = []
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('resources')
      .select('id, title, description, resource_type, url, thumbnail_url')
      .eq('active', true)
      .order('display_order', { ascending: true })
      .limit(12)
    resources = ((data || []) as ResourceRow[]).map(r => ({
      id: r.id,
      title: r.title,
      description: r.description,
      type: r.resource_type,
      url: r.url,
      thumb: thumbFor(r),
    }))
  } catch {}

  const videos = await latestVideos()
  return Response.json({ resources, videos }, { headers })
}
