'use client'
import { useEffect, useState } from 'react'
import { Barlow, Barlow_Condensed } from 'next/font/google'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ResourceSlider, { ResourceItem } from '@/components/ResourceSlider'
import ToolCard, { DashTool, ToolPrice } from '@/components/dashboard/ToolCard'
import '@/components/dashboard/dashboard.css'

const body = Barlow({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--dbx-body', display: 'swap' })
const head = Barlow_Condensed({ subsets: ['latin'], weight: ['600', '700', '800'], variable: '--dbx-head', display: 'swap' })

type PlanRow = { tool_ids: string[] | null; monthly_price: number | null; annual_price: number | null }

export default function Dashboard() {
  const [tools, setTools] = useState<DashTool[]>([])
  const [activeIds, setActiveIds] = useState<string[]>([])
  const [expiryMap, setExpiryMap] = useState<Record<string, string | null>>({})
  const [priceMap, setPriceMap] = useState<Record<string, ToolPrice>>({})
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [hasResume, setHasResume] = useState(false)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const nowIso = new Date().toISOString()
      const [toolsRes, subsRes, plansRes, resRes, resumeRes] = await Promise.all([
        supabase.from('tools').select('id, name, slug, description, features').order('created_at'),
        supabase.from('subscriptions').select('tool_id, expires_at').eq('user_id', user.id).eq('status', 'active')
          .or(`expires_at.is.null,expires_at.gt.${nowIso}`),
        supabase.from('plans').select('tool_ids, monthly_price, annual_price').eq('active', true),
        supabase.from('resources').select('id, title, description, resource_type, url, thumbnail_url')
          .eq('active', true).order('display_order', { ascending: true }),
        supabase.from('resumes').select('id').eq('user_id', user.id).maybeSingle(),
      ])

      // cheapest active plan that includes each tool
      const prices: Record<string, ToolPrice> = {}
      ;((plansRes.data || []) as PlanRow[]).forEach(p => {
        const m = Number(p.monthly_price) || 0
        if (m <= 0) return
        ;(p.tool_ids || []).forEach(tid => {
          const cur = prices[tid]
          if (!cur || m < cur.monthly) prices[tid] = { monthly: m, annual: p.annual_price ? Number(p.annual_price) : null }
        })
      })

      const subs = subsRes.data || []
      const map: Record<string, string | null> = {}
      subs.forEach(s => {
        const prev = map[s.tool_id]
        if (prev === undefined) map[s.tool_id] = s.expires_at
        else if (prev !== null && (s.expires_at === null || new Date(s.expires_at) > new Date(prev))) map[s.tool_id] = s.expires_at
      })

      setTools((toolsRes.data || []) as DashTool[])
      setActiveIds(Array.from(new Set(subs.map(s => s.tool_id))))
      setExpiryMap(map)
      setPriceMap(prices)
      setResources((resRes.data || []) as ResourceItem[])
      setHasResume(!!resumeRes.data)
      setLoading(false)
    }
    loadData()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#171513', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, sans-serif' }}>Loading...</div>
  }

  const mine = tools.filter(t => activeIds.includes(t.id))
  const rest = tools.filter(t => !activeIds.includes(t.id))
  const docs = resources.filter(r => r.resource_type === 'pdf' || r.resource_type === 'excel')
  const videos = resources.filter(r => r.resource_type === 'video')
  const web = resources.filter(r => r.resource_type === 'calculator' || r.resource_type === 'link')

  const menu = [
    { label: 'My Profile', action: () => router.push('/profile') },
    { label: 'My Membership', action: () => router.push('/membership') },
    { label: 'Free Resources', action: () => router.push('/resources') },
    { label: 'My Resume', action: () => router.push('/resume') },
    { label: 'Machine Status', action: () => router.push('/machine-status') },
    { label: 'Ask a Question', action: () => router.push('/ask') },
    { label: 'Logout', action: handleLogout },
  ]

  const renderCards = (list: DashTool[], subscribed: boolean) => (
    <div className="dbx-tools">
      {list.map(t => (
        <ToolCard key={t.id} tool={t} subscribed={subscribed} expiresAt={expiryMap[t.id]} price={priceMap[t.id] || null} />
      ))}
    </div>
  )

  return (
    <div className={`dbx-root ${body.variable} ${head.variable}`}>
      <header className="dbx-top">
        <div className="dbx-brand">
          <img src="/logo-icon.png" alt="Machinest Studio" />
          <span>Machinest <em>Studio</em></span>
        </div>
        <div className="dbx-topr">
          <button className="dbx-pill">Dashboard</button>
          <div style={{ position: 'relative' }}>
            <button className="dbx-burger" aria-label="Menu" onClick={() => setMenuOpen(!menuOpen)}>☰</button>
            {menuOpen && (
              <div className="dbx-menu">
                {menu.map(i => <div key={i.label} onClick={i.action}>{i.label}</div>)}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="dbx-wrap">
        <section className="dbx-hello">
          <h1>Your Dashboard</h1>
          <p>Manage your active tools or explore what&apos;s available</p>
        </section>

        {/* PREMIUM TOOLS */}
        {mine.length > 0 ? (
          <>
            <div className="dbx-plhead">
              <div className="dbx-mark">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#171513"><path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" /></svg>
              </div>
              <h2>Your <span>subscribed premium tools</span></h2>
              <span className="dbx-count">{mine.length} active</span>
              <i className="dbx-rule" />
            </div>
            {renderCards(mine, true)}
            {rest.length > 0 && (
              <>
                <div className="dbx-more"><h3>More premium tools</h3><i /></div>
                {renderCards(rest, false)}
              </>
            )}
          </>
        ) : (
          <>
            <div className="dbx-plhead">
              <div className="dbx-mark">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#171513"><path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" /></svg>
              </div>
              <h2>Premium tools <span>to try free</span></h2>
              <i className="dbx-rule" />
            </div>
            {renderCards(tools, false)}
          </>
        )}

        {/* FREE RESOURCES */}
        {resources.length > 0 && (
          <section className="dbx-free">
            <h2>Exclusive free resources for all users</h2>
            <p className="dbx-sub">PDFs, Excel sheets, videos and web tools. Free for every member.</p>
            <ResourceSlider title="PDF / Excel" items={docs} />
            <ResourceSlider title="Videos" items={videos} />
            <ResourceSlider title="Web Tools" items={web} />
          </section>
        )}

        {/* BANNERS */}
        <div className="dbx-banners">
          <div className="dbx-bn" onClick={() => router.push('/resume')}>
            <div className="dbx-ic" style={{ fontSize: 26 }}>📄</div>
            <div>
              <h4>{hasResume ? 'Your resume is uploaded' : 'Looking for a CNC job?'}</h4>
              <p>{hasResume ? 'Update it or change your job preferences anytime' : 'Upload your resume and let Machinest connect you with hiring companies'}</p>
            </div>
            <span className="dbx-go">{hasResume ? 'Manage →' : 'Upload →'}</span>
          </div>
          <div className="dbx-bn" onClick={() => router.push('/ask')}>
            <div className="dbx-ic" style={{ fontSize: 26 }}>💬</div>
            <div>
              <h4>Have a question?</h4>
              <p>Ask about a cycle, request a new one, or get help with membership</p>
            </div>
            <span className="dbx-go">Ask →</span>
          </div>
        </div>

        {/* CUSTOM SERVICES */}
        <section className="dbx-custom">
          <svg className="dbx-bg dbx-slow" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="34" fill="none" stroke="#F0801E" strokeWidth="14" strokeDasharray="10.7 7" />
            <circle cx="50" cy="50" r="20" fill="none" stroke="#F0801E" strokeWidth="3" />
          </svg>
          <div className="dbx-tx">
            <span className="dbx-badge">CUSTOM SERVICES</span>
            <h2>Need something built <span>just for your shop?</span></h2>
            <p>Custom CNC programs, process and cycle-time optimization, and tools made around your own machines and parts. Tell us the requirement and we will get back to you with a quote.</p>
            <div className="dbx-tags">
              {['CNC Programming', 'Optimization', 'Custom Software', 'On-demand Manufacturing'].map(c => <span key={c}>{c}</span>)}
            </div>
            <button className="dbx-btn dbx-main" onClick={() => router.push('/services')}>Request a Custom Solution →</button>
          </div>
          <div className="dbx-mini">
            {[['⚙️', 'Programs'], ['⏱️', 'Faster cycles'], ['💻', 'Custom tools'], ['🏭', 'Shop floor']].map(([i, l]) => (
              <div key={l}><span style={{ fontSize: 28, display: 'block', marginBottom: 6 }}>{i}</span>{l}</div>
            ))}
          </div>
        </section>

        <footer className="dbx-foot">© Machinest Studio</footer>
      </main>
    </div>
  )
}
