'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type ResourceType = 'video' | 'pdf' | 'excel' | 'calculator' | 'link'
type Resource = {
  id: string
  title: string
  description: string | null
  resource_type: ResourceType
  url: string
  category: string | null
  thumbnail_url: string | null
}

const ICON: Record<ResourceType, string> = { video: '🎬', pdf: '📄', excel: '📊', calculator: '🧮', link: '🌐' }
const LABEL: Record<ResourceType, string> = { video: 'Video', pdf: 'PDF', excel: 'Excel Sheet', calculator: 'Web Tool', link: 'Web Tool' }
const BG: Record<ResourceType, string> = {
  video: 'linear-gradient(135deg,#3a2a1c,#171513)',
  pdf: 'linear-gradient(135deg,#3b2321,#171513)',
  excel: 'linear-gradient(135deg,#1c3326,#171513)',
  calculator: 'linear-gradient(135deg,#1f2c3d,#171513)',
  link: 'linear-gradient(135deg,#1f2c3d,#171513)',
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

// Google Drive share links open a Drive page, not an image. Turn them into a direct image link.
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

function cleanThumb(url: string): string {
  const id = driveId(url.trim())
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w800` : url.trim()
}

function getThumb(r: Resource): string | null {
  if (r.thumbnail_url && r.thumbnail_url.trim()) return cleanThumb(r.thumbnail_url)
  if (r.resource_type === 'video') {
    const id = youtubeId(r.url)
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
  }
  return null
}

function ResourceCard({ r }: { r: Resource }) {
  const [failed, setFailed] = useState(false)
  const thumb = failed ? null : getThumb(r)
  return (
    <a href={r.url} target="_blank" rel="noopener noreferrer"
      style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, overflow: 'hidden', textDecoration: 'none', display: 'block' }}>
      <div style={{ position: 'relative', aspectRatio: '16 / 10', background: '#171513' }}>
        {thumb ? (
          <img src={thumb} alt={r.title} referrerPolicy="no-referrer" onError={() => setFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44, background: BG[r.resource_type] }}>
            {ICON[r.resource_type]}
          </div>
        )}
        <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 999 }}>
          {LABEL[r.resource_type]}
        </span>
      </div>
      <div style={{ padding: '14px 16px 16px' }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{r.title}</div>
        {r.description && <div style={{ color: '#999', fontSize: 13, marginBottom: 10 }}>{r.description}</div>}
        <span style={{ color: '#F0801E', fontSize: 12, fontWeight: 700 }}>{r.resource_type === 'video' ? 'Watch' : 'Open'} &rarr;</span>
      </div>
    </a>
  )
}

export default function ResourcesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [loggedIn, setLoggedIn] = useState(false)

  useEffect(() => {
    async function load() {
      // Visitors can browse the free resources without logging in
      const { data: { user } } = await supabase.auth.getUser()
      setLoggedIn(!!user)

      const { data } = await supabase
        .from('resources')
        .select('id, title, description, resource_type, url, category, thumbnail_url')
        .eq('active', true)
        .order('display_order', { ascending: true })

      setResources((data || []) as Resource[])
      setLoading(false)
    }
    load()
  }, [])

  const groups = resources.reduce<Record<string, Resource[]>>((acc, r) => {
    const key = r.category || 'General'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #262421 0%, #302d29 100%)', fontFamily: 'Segoe UI, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 32px', background: '#211f1d', borderBottom: '2px solid #F0801E' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo-icon.png" alt="Machinest Studio" style={{ height: 40, width: 'auto' }} />
          <span style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>Machinest <span style={{ color: '#F0801E' }}>Studio</span></span>
        </div>
        <button onClick={() => router.push(loggedIn ? '/dashboard' : '/')} style={{ background: '#F0801E', color: '#fff', border: 'none', borderRadius: 999, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {loggedIn ? '\u2190 Dashboard' : 'Login / Sign up'}
        </button>
      </header>

      <div style={{ padding: '32px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ color: '#fff', fontSize: 24, margin: '0 0 6px', fontWeight: 800 }}>Free Resources</h2>
        <p style={{ color: '#999', fontSize: 14, margin: '0 0 28px' }}>Videos, Excel sheets, PDFs and calculators — free for everyone. Sign up to use the Machinest Studio tools.</p>

        {loading ? (
          <p style={{ color: '#999' }}>Loading...</p>
        ) : resources.length === 0 ? (
          <p style={{ color: '#999' }}>No resources yet — check back soon.</p>
        ) : (
          Object.entries(groups).map(([category, items]) => (
            <div key={category} style={{ marginBottom: 32 }}>
              <h3 style={{ color: '#F0801E', fontSize: 15, fontWeight: 700, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: 0.5 }}>{category}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                {items.map(r => <ResourceCard key={r.id} r={r} />)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
