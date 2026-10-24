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

const ICON: Record<ResourceType, string> = { video: '🎬', pdf: '📄', excel: '📊', calculator: '🧮', link: '🌐' }
const LABEL: Record<ResourceType, string> = { video: 'Video', pdf: 'PDF', excel: 'Excel', calculator: 'Web Tool', link: 'Web Tool' }
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
    <a className="dbx-rc" href={r.url} target="_blank" rel="noopener noreferrer">
      <div className="dbx-th">
        {thumb ? (
          <img src={thumb} alt={r.title} referrerPolicy="no-referrer" onError={() => setFailed(true)} />
        ) : (
          <div className="dbx-fallback" style={{ background: BG[r.resource_type] }}>{ICON[r.resource_type]}</div>
        )}
        <span className="dbx-kind">{LABEL[r.resource_type]}</span>
        {r.resource_type === 'video' && <div className="dbx-play"><i /></div>}
      </div>
      <div className="dbx-rb">
        <strong>{r.title}</strong>
        <small>{r.resource_type === 'video' ? 'Watch' : 'Open'} &rarr;</small>
      </div>
    </a>
  )
}

export default function ResourceSlider({ title, items }: { title: string; items: ResourceItem[] }) {
  const ref = useRef<HTMLDivElement>(null)
  if (items.length === 0) return null
  const scroll = (dir: 1 | -1) => ref.current?.scrollBy({ left: dir * 520, behavior: 'smooth' })

  return (
    <div className="dbx-rowblock">
      <div className="dbx-rowhead">
        <h3>{title}</h3>
        <span className="dbx-n">{items.length}</span>
        <i className="dbx-sp2" />
        <div className="dbx-arrows">
          <button aria-label="Scroll left" onClick={() => scroll(-1)}>&#8249;</button>
          <button aria-label="Scroll right" onClick={() => scroll(1)}>&#8250;</button>
        </div>
      </div>
      <div className="dbx-track" ref={ref}>
        {items.map(r => <Card key={r.id} r={r} />)}
      </div>
    </div>
  )
}
