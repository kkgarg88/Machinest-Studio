'use client'
import { useRef, useState } from 'react'

export type ResourceType = 'video' | 'pdf' | 'excel' | 'calculator' | 'link'

export type ResourceItem = {
  id: string
  title: string
  description: string | null
  resource_type: ResourceType
  url: string
  thumbnail_url: string | null
}

const ICON: Record<ResourceType, string> = {
  video: '▶', pdf: '📄', excel: '📊', calculator: '🧮', link: '🌐',
}
const LABEL: Record<ResourceType, string> = {
  video: 'Video', pdf: 'PDF', excel: 'Excel', calculator: 'Web Tool', link: 'Web Tool',
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
// Works for files shared as "Anyone with the link".
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

function getThumb(r: ResourceItem): string | null {
  if (r.thumbnail_url && r.thumbnail_url.trim()) return cleanThumb(r.thumbnail_url)
  if (r.resource_type === 'video') {
    const id = youtubeId(r.url)
    if (id) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
  }
  return null
}

function Card({ r }: { r: ResourceItem }) {
  const [failed, setFailed] = useState(false)
  const thumb = failed ? null : getThumb(r)

  return (
    <a
      href={r.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        flex: '0 0 230px', scrollSnapAlign: 'start', textDecoration: 'none',
        background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, overflow: 'hidden', display: 'block',
      }}
    >
      <div style={{ position: 'relative', width: '100%', aspectRatio: '16 / 9', background: 'linear-gradient(135deg, #3a3733 0%, #262421 100%)' }}>
        {thumb ? (
          <img
            src={thumb}
            alt={r.title}
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38 }}>
            {ICON[r.resource_type]}
          </div>
        )}
        {r.resource_type === 'video' && thumb && (
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              width: 44, height: 44, borderRadius: '50%', background: 'rgba(240,128,30,0.92)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, paddingLeft: 3,
            }}>
              {'▶'}
            </span>
          </div>
        )}
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{
          color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1.35, marginBottom: 6,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 38,
        }}>
          {r.title}
        </div>
        <span style={{ color: '#F0801E', fontSize: 11, fontWeight: 700 }}>{LABEL[r.resource_type]} &rarr;</span>
      </div>
    </a>
  )
}

export default function ResourceSlider({ title, items }: { title: string; items: ResourceItem[] }) {
  const ref = useRef<HTMLDivElement>(null)
  if (items.length === 0) return null

  function scroll(dir: 1 | -1) {
    ref.current?.scrollBy({ left: dir * 480, behavior: 'smooth' })
  }

  const arrow = {
    width: 34, height: 34, borderRadius: '50%', border: '1px solid #3a3733', background: '#2b2a28',
    color: '#fff', fontSize: 16, cursor: 'pointer',
  } as const

  return (
    <div style={{ marginBottom: 30 }}>
      <style>{'.rs-track::-webkit-scrollbar{display:none}'}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h4 style={{ color: '#F0801E', fontSize: 14, fontWeight: 700, margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>{title}</h4>
        <div style={{ display: 'flex', gap: 8 }}>
          <button aria-label="Scroll left" onClick={() => scroll(-1)} style={arrow}>&#8249;</button>
          <button aria-label="Scroll right" onClick={() => scroll(1)} style={arrow}>&#8250;</button>
        </div>
      </div>
      <div
        ref={ref}
        className="rs-track"
        style={{
          display: 'flex', gap: 16, overflowX: 'auto', scrollSnapType: 'x mandatory',
          scrollbarWidth: 'none', paddingBottom: 4,
        }}
      >
        {items.map(r => <Card key={r.id} r={r} />)}
      </div>
    </div>
  )
}
