'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'

type ResourceType = 'video' | 'pdf' | 'excel' | 'calculator' | 'link'
export type Resource = {
  id: string
  title: string
  description: string | null
  resource_type: ResourceType
  url: string
  category: string | null
  thumbnail_url: string | null
}

type TypeFilter = 'all' | 'video' | 'pdf' | 'excel' | 'tool'

const ICON: Record<ResourceType, string> = { video: '🎬', pdf: '📄', excel: '📊', calculator: '🧮', link: '🌐' }
const LABEL: Record<ResourceType, string> = { video: 'Video', pdf: 'PDF', excel: 'Excel Sheet', calculator: 'Web Tool', link: 'Web Tool' }
const BG: Record<ResourceType, string> = {
  video: 'linear-gradient(135deg,#3a2a1c,#171513)',
  pdf: 'linear-gradient(135deg,#3b2321,#171513)',
  excel: 'linear-gradient(135deg,#1c3326,#171513)',
  calculator: 'linear-gradient(135deg,#1f2c3d,#171513)',
  link: 'linear-gradient(135deg,#1f2c3d,#171513)',
}
const TYPE_CHIPS: { key: TypeFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'video', label: 'Videos' },
  { key: 'pdf', label: 'PDFs' },
  { key: 'excel', label: 'Excel sheets' },
  { key: 'tool', label: 'Web tools' },
]

const SITE = 'https://machinest.in'
const NAV: { label: string; href: string; external: boolean }[] = [
  { label: 'Home', href: `${SITE}/`, external: true },
  { label: 'Machinest Studio', href: `${SITE}/machinest-studio/`, external: true },
  { label: 'Pricing', href: '/membership', external: false },
  { label: 'Free Resources', href: '/resources', external: false },
  { label: 'About', href: `${SITE}/about/`, external: true },
  { label: 'Contact', href: `${SITE}/contact/`, external: true },
]

function typeKey(t: ResourceType): TypeFilter {
  return t === 'calculator' || t === 'link' ? 'tool' : t
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
    <a href={r.url} target="_blank" rel="noopener noreferrer" className="rs-card">
      <div className="rs-thumb">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={r.title} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
        ) : (
          <div className="rs-ph" style={{ background: BG[r.resource_type] }}>{ICON[r.resource_type]}</div>
        )}
        <span className="rs-badge">{LABEL[r.resource_type]}</span>
      </div>
      <div className="rs-body">
        <h3 className="rs-title">{r.title}</h3>
        {r.description && <p className="rs-desc">{r.description}</p>}
        <span className="rs-open">{r.resource_type === 'video' ? 'Watch' : 'Open'} &rarr;</span>
      </div>
    </a>
  )
}

export default function ResourcesView({ resources, loggedIn }: { resources: Resource[]; loggedIn: boolean }) {
  const [q, setQ] = useState('')
  const [type, setType] = useState<TypeFilter>('all')
  const [cat, setCat] = useState('All')

  const categories = useMemo(() => {
    const set = new Set<string>()
    resources.forEach(r => set.add(r.category?.trim() || 'General'))
    return Array.from(set)
  }, [resources])
  const showCats = categories.length > 1

  const typeCounts = useMemo(() => {
    const c: Record<TypeFilter, number> = { all: resources.length, video: 0, pdf: 0, excel: 0, tool: 0 }
    resources.forEach(r => { c[typeKey(r.resource_type)] += 1 })
    return c
  }, [resources])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return resources.filter(r => {
      if (type !== 'all' && typeKey(r.resource_type) !== type) return false
      if (cat !== 'All' && (r.category?.trim() || 'General') !== cat) return false
      if (!term) return true
      const hay = `${r.title} ${r.description || ''} ${r.category || ''}`.toLowerCase()
      return term.split(/\s+/).every(w => hay.includes(w))
    })
  }, [resources, q, type, cat])

  const filtering = q.trim() !== '' || type !== 'all' || cat !== 'All'
  const grouped = showCats && cat === 'All'
  const groups = useMemo(() => {
    const acc: Record<string, Resource[]> = {}
    filtered.forEach(r => {
      const key = r.category?.trim() || 'General'
      if (!acc[key]) acc[key] = []
      acc[key].push(r)
    })
    return Object.entries(acc)
  }, [filtered])

  function clearAll() { setQ(''); setType('all'); setCat('All') }

  return (
    <div className="rs-page">
      <style>{CSS}</style>

      <header className="rs-head">
        <a href={`${SITE}/`} className="rs-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Machinest" />
          <span>Machinest <b>Studio</b></span>
        </a>
        <nav className="rs-nav" aria-label="Main">
          {NAV.map(n => n.external ? (
            <a key={n.label} href={n.href}>{n.label}</a>
          ) : (
            <Link key={n.label} href={n.href} className={n.href === '/resources' ? 'on' : ''} aria-current={n.href === '/resources' ? 'page' : undefined}>{n.label}</Link>
          ))}
        </nav>
        <Link href={loggedIn ? '/dashboard' : '/'} className="rs-cta">{loggedIn ? '← Dashboard' : 'Login / Sign up'}</Link>
      </header>

      <main>
        <section className="rs-hero">
          <p className="rs-eyebrow">Free for everyone</p>
          <h1>Free CNC Resources</h1>
          <p className="rs-sub">Videos, Excel sheets, PDFs and calculators for everyone in manufacturing: programmers, setters, operators, quality and maintenance teams, and students. No login needed to browse.</p>

          <div className="rs-search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input
              type="search"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search resources, e.g. tolerance, thread, G71"
              aria-label="Search free CNC resources"
            />
            {q && <button type="button" onClick={() => setQ('')} aria-label="Clear search">&times;</button>}
          </div>

          <div className="rs-chips" role="group" aria-label="Filter by type">
            {TYPE_CHIPS.filter(c => c.key === 'all' || typeCounts[c.key] > 0).map(c => (
              <button key={c.key} type="button" className={type === c.key ? 'on' : ''} aria-pressed={type === c.key} onClick={() => setType(c.key)}>
                {c.label} <i>{typeCounts[c.key]}</i>
              </button>
            ))}
          </div>

          {showCats && (
            <div className="rs-chips rs-cats" role="group" aria-label="Filter by category">
              {['All', ...categories].map(c => (
                <button key={c} type="button" className={cat === c ? 'on' : ''} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>
          )}
        </section>

        <section className="rs-list" aria-live="polite">
          {resources.length === 0 ? (
            <p className="rs-empty">No resources yet. Check back soon.</p>
          ) : filtered.length === 0 ? (
            <div className="rs-empty">
              <p>No resources match your search.</p>
              <button type="button" onClick={clearAll}>Clear search and filters</button>
            </div>
          ) : (
            <>
              {filtering && <p className="rs-count">Showing {filtered.length} of {resources.length} resources</p>}
              {grouped ? (
                groups.map(([category, items]) => (
                  <div key={category} className="rs-group">
                    <h2>{category}</h2>
                    <div className="rs-grid">{items.map(r => <ResourceCard key={r.id} r={r} />)}</div>
                  </div>
                ))
              ) : (
                <div className="rs-grid">{filtered.map(r => <ResourceCard key={r.id} r={r} />)}</div>
              )}
            </>
          )}
        </section>

        {!loggedIn && (
          <section className="rs-band">
            <div>
              <h2>Want the full Turning and Milling tools?</h2>
              <p>Create a free account to generate tested CNC programs with simulation, and track every machine in your shop.</p>
            </div>
            <Link href="/" className="rs-cta">Create free account &rarr;</Link>
          </section>
        )}
      </main>

      <footer className="rs-foot">
        <span>&copy; 2026 Machinest. All rights reserved.</span>
        <span className="rs-links">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/refund">Refund policy</Link>
          <a href={`${SITE}/contact/`}>Contact</a>
        </span>
      </footer>
    </div>
  )
}

const CSS = `
.rs-page{min-height:100vh;background:linear-gradient(180deg,#262421 0%,#302d29 100%);font-family:'Segoe UI',sans-serif;color:#fff}
.rs-page *{box-sizing:border-box}
.rs-head{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:24px;padding:12px 32px;background:#211f1d;border-bottom:2px solid #F0801E}
.rs-brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:#fff;font-size:19px;font-weight:800;white-space:nowrap}
.rs-brand img{height:38px;width:auto}
.rs-brand b{color:#F0801E}
.rs-nav{display:flex;gap:6px;margin-left:12px;flex:1}
.rs-nav a{color:#c9c5bf;text-decoration:none;font-size:14px;font-weight:600;padding:8px 12px;border-radius:8px}
.rs-nav a:hover{color:#fff;background:#2b2a28}
.rs-nav a.on{color:#F0801E}
.rs-cta{background:#F0801E;color:#fff;border-radius:999px;padding:9px 20px;font-size:13px;font-weight:700;text-decoration:none;white-space:nowrap}
.rs-cta:hover{background:#ff9238}
.rs-hero{max-width:1100px;margin:0 auto;padding:44px 24px 8px}
.rs-eyebrow{margin:0 0 8px;color:#F0801E;font-size:13px;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
.rs-hero h1{margin:0 0 10px;font-size:clamp(28px,4vw,40px);font-weight:800;line-height:1.1}
.rs-sub{margin:0 0 22px;max-width:640px;color:#a8a39b;font-size:15px;line-height:1.55}
.rs-search{display:flex;align-items:center;gap:10px;max-width:620px;background:#1c1b19;border:1px solid #3a3733;border-radius:12px;padding:0 14px;color:#8d8880}
.rs-search:focus-within{border-color:#F0801E;color:#F0801E}
.rs-search input{flex:1;min-width:0;background:transparent;border:0;outline:0;color:#fff;font-size:15px;padding:14px 0}
.rs-search input::placeholder{color:#7d7870}
.rs-search button{background:transparent;border:0;color:#a8a39b;font-size:22px;line-height:1;cursor:pointer;padding:0 4px}
.rs-chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.rs-chips button{background:#2b2a28;border:1px solid #3a3733;color:#d6d2cb;border-radius:999px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer}
.rs-chips button i{font-style:normal;color:#8d8880;margin-left:4px;font-weight:500}
.rs-chips button:hover{border-color:#F0801E}
.rs-chips button.on{background:#F0801E;border-color:#F0801E;color:#fff}
.rs-chips button.on i{color:#ffe2c8}
.rs-cats button{background:transparent}
.rs-cats button.on{background:#3a3733;border-color:#F0801E;color:#F0801E}
.rs-list{max-width:1100px;margin:0 auto;padding:22px 24px 8px}
.rs-count{margin:0 0 14px;color:#8d8880;font-size:13px}
.rs-group{margin-bottom:32px}
.rs-group h2{margin:0 0 14px;color:#F0801E;font-size:15px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.rs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px;margin-bottom:24px}
.rs-card{display:block;background:#2b2a28;border:1px solid #3a3733;border-radius:12px;overflow:hidden;text-decoration:none;transition:transform .15s,border-color .15s}
.rs-card:hover{transform:translateY(-3px);border-color:#F0801E}
.rs-thumb{position:relative;aspect-ratio:16/10;background:#171513}
.rs-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.rs-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:44px}
.rs-badge{position:absolute;top:8px;left:8px;background:rgba(0,0,0,.65);color:#fff;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px}
.rs-body{padding:14px 16px 16px}
.rs-title{margin:0 0 4px;color:#fff;font-weight:700;font-size:15px}
.rs-desc{margin:0 0 10px;color:#999;font-size:13px}
.rs-open{color:#F0801E;font-size:12px;font-weight:700}
.rs-empty{color:#999;text-align:center;padding:40px 0}
.rs-empty button{margin-top:6px;background:transparent;border:1px solid #F0801E;color:#F0801E;border-radius:999px;padding:8px 18px;font-weight:700;cursor:pointer}
.rs-band{max-width:1052px;margin:16px auto 40px;padding:24px 28px;display:flex;align-items:center;justify-content:space-between;gap:20px;background:#211f1d;border:1px solid #3a3733;border-left:4px solid #F0801E;border-radius:14px}
.rs-band h2{margin:0 0 6px;font-size:19px;font-weight:800}
.rs-band p{margin:0;color:#a8a39b;font-size:14px;max-width:560px}
.rs-foot{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;max-width:1100px;margin:0 auto;padding:22px 24px 32px;border-top:1px solid #3a3733;color:#8d8880;font-size:13px}
.rs-links{display:flex;gap:18px}
.rs-links a{color:#a8a39b;text-decoration:none}
.rs-links a:hover{color:#F0801E}
@media (max-width:860px){
  .rs-head{flex-wrap:wrap;gap:10px 14px;padding:10px 16px}
  .rs-nav{order:3;width:100%;margin:0;overflow-x:auto;gap:2px;padding-bottom:2px;-webkit-overflow-scrolling:touch}
  .rs-nav a{white-space:nowrap;padding:7px 10px}
  .rs-cta{margin-left:auto}
  .rs-hero{padding:28px 16px 4px}
  .rs-list{padding:18px 16px 4px}
  .rs-band{flex-direction:column;align-items:flex-start;margin:12px 16px 32px}
  .rs-foot{padding:20px 16px 28px}
}
`
