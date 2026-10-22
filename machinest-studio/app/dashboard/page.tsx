'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ResourceSlider, { ResourceItem } from '@/components/ResourceSlider'

type Tool = {
  id: string
  name: string
  slug: string
  description: string
  features: string[] | null
}

const iconMap: Record<string, string> = {
  'turning-studio': '🔩',
  'milling-studio': '⚙️',
}

export default function Dashboard() {
  const [tools, setTools] = useState<Tool[]>([])
  const [activeIds, setActiveIds] = useState<string[]>([])
  const [expiryMap, setExpiryMap] = useState<Record<string, string | null>>({})
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [resources, setResources] = useState<ResourceItem[]>([])
  const [hasResume, setHasResume] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/')
        return
      }

      const { data: toolsData } = await supabase.from('tools').select('*').order('created_at')
      const nowIso = new Date().toISOString()
      const { data: subsData } = await supabase
        .from('subscriptions')
        .select('tool_id, expires_at')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)

      const { data: resData } = await supabase
        .from('resources')
        .select('id, title, description, resource_type, url, thumbnail_url')
        .eq('active', true)
        .order('display_order', { ascending: true })
      setResources((resData || []) as ResourceItem[])

      const { data: resumeRow } = await supabase.from('resumes').select('id').eq('user_id', user.id).maybeSingle()
      setHasResume(!!resumeRow)

      setTools(toolsData || [])
      setActiveIds((subsData || []).map(s => s.tool_id))
      const map: Record<string, string | null> = {}
      ;(subsData || []).forEach(s => { map[s.tool_id] = s.expires_at })
      setExpiryMap(map)
      setLoading(false)
    }
    loadData()
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#1a1917', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, sans-serif' }}>Loading...</div>
  }

  const activeTools = tools.filter(t => activeIds.includes(t.id))
  const availableTools = tools.filter(t => !activeIds.includes(t.id))
  const docResources = resources.filter(r => r.resource_type === 'pdf' || r.resource_type === 'excel')
  const videoResources = resources.filter(r => r.resource_type === 'video')
  const webResources = resources.filter(r => r.resource_type === 'calculator' || r.resource_type === 'link')

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #262421 0%, #302d29 100%)', fontFamily: 'Segoe UI, sans-serif' }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 32px', background: '#211f1d', borderBottom: '2px solid #F0801E', position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo-icon.png" alt="Machinest Studio" style={{ height: 44, width: 'auto' }} />
          <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>
            Machinest <span style={{ color: '#F0801E' }}>Studio</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button style={{
            background: '#F0801E', color: '#fff', border: 'none', borderRadius: 999,
            padding: '10px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer'
          }}>
            Dashboard
          </button>

          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 8,
                width: 40, height: 40, color: '#fff', fontSize: 18, cursor: 'pointer'
              }}
            >
              ☰
            </button>

            {menuOpen && (
              <div style={{
                position: 'absolute', top: 48, right: 0, background: '#2b2a28',
                border: '1px solid #3a3733', borderRadius: 8, width: 200, overflow: 'hidden',
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)', zIndex: 20
              }}>
                {[
                  { label: 'My Profile', action: () => router.push('/profile') },
                  { label: 'My Membership', action: () => router.push('/membership') },
                  { label: 'Free Resources', action: () => router.push('/resources') },
                  { label: 'My Resume', action: () => router.push('/resume') },
                  { label: 'Ask a Question', action: () => router.push('/ask') },
                  { label: 'Logout', action: handleLogout },
                ].map(item => (
                  <div
                    key={item.label}
                    onClick={item.action}
                    style={{ padding: '12px 16px', fontSize: 13.5, color: '#ddd', cursor: 'pointer', borderBottom: '1px solid #3a3733' }}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      <div style={{ padding: '48px 40px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ color: '#fff', fontSize: 28, margin: '0 0 6px', fontWeight: 800 }}>Your Dashboard</h2>
        <p style={{ color: '#999', fontSize: 14, marginBottom: 36 }}>Manage your active tools or explore what's available</p>

        {/* FREE RESOURCES */}
        {resources.length > 0 && (
          <div style={{ marginBottom: 44 }}>
            <h3 style={{ color: '#fff', fontSize: 20, fontWeight: 800, margin: '0 0 4px' }}>Free Resources</h3>
            <p style={{ color: '#999', fontSize: 13, margin: '0 0 22px' }}>Free for every member</p>
            <ResourceSlider title="PDF / Excel Tools" items={docResources} />
            <ResourceSlider title="Videos" items={videoResources} />
            <ResourceSlider title="Web Tools" items={webResources} />
          </div>
        )}

        {/* RESUME BANNER */}
        <div
          onClick={() => router.push('/resume')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap',
            background: 'linear-gradient(135deg, #2f2d2a 0%, #262421 100%)',
            border: '1px solid rgba(240,128,30,0.4)', borderRadius: 12,
            padding: '16px 22px', marginBottom: 16, cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 19, background: 'rgba(240,128,30,0.15)'
            }}>
              📄
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
                {hasResume ? 'Your resume is uploaded' : 'Looking for a CNC job?'}
              </div>
              <div style={{ color: '#999', fontSize: 12.5 }}>
                {hasResume ? 'Update it or change your job preferences anytime' : 'Upload your resume and let Machinest connect you with hiring companies'}
              </div>
            </div>
          </div>
          <span style={{ color: '#F0801E', fontSize: 13, fontWeight: 700 }}>{hasResume ? 'Manage →' : 'Upload →'}</span>
        </div>

        {/* ASK A QUESTION BANNER */}
        <div
          onClick={() => router.push('/ask')}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap',
            background: 'linear-gradient(135deg, #2f2d2a 0%, #262421 100%)',
            border: '1px solid rgba(240,128,30,0.4)', borderRadius: 12,
            padding: '16px 22px', marginBottom: 40, cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 19, background: 'rgba(240,128,30,0.15)'
            }}>
              💬
            </div>
            <div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Have a question?</div>
              <div style={{ color: '#999', fontSize: 12.5 }}>Ask about a cycle, request a new one, or get help with membership</div>
            </div>
          </div>
          <span style={{ color: '#F0801E', fontSize: 13, fontWeight: 700 }}>Ask →</span>
        </div>

        {/* ACTIVE TOOLS */}
        <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 700, marginBottom: 16 }}>Your Active Tools</h3>
        {activeTools.length === 0 ? (
          <div style={{ background: '#2b2a28', border: '1px dashed #3a3733', borderRadius: 12, padding: 24, marginBottom: 40, textAlign: 'center' }}>
            <p style={{ color: '#999', fontSize: 14, margin: '0 0 14px' }}>You don't have any active tools yet.</p>
            <button onClick={() => router.push('/membership')} style={{ background: '#F0801E', color: '#fff', border: 'none', borderRadius: 999, padding: '10px 22px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              Browse Tools
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 20, marginBottom: 40 }}>
            {activeTools.map(tool => {
              const expiry = expiryMap[tool.id]
              const daysLeft = expiry ? Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null
              return (
                <div
                  key={tool.id}
                  onClick={() => router.push(`/studio/${tool.slug}`)}
                  style={{
                    background: 'linear-gradient(150deg, #2f2d2a 0%, #262421 100%)',
                    border: '1px solid rgba(240,128,30,0.5)', borderRadius: 12, padding: 24, cursor: 'pointer',
                    boxShadow: '0 6px 20px rgba(240,128,30,0.12)',
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, marginBottom: 14, background: 'rgba(240,128,30,0.15)'
                  }}>
                    {iconMap[tool.slug] || '🛠️'}
                  </div>
                  <h4 style={{ color: '#fff', margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>{tool.name}</h4>
                  <p style={{ color: '#999', margin: '0 0 12px', fontSize: 12.5, lineHeight: 1.5 }}>{tool.description}</p>
                  <span style={{
                    display: 'inline-block', fontSize: 10, fontWeight: 700,
                    padding: '3px 11px', borderRadius: 10, color: '#fff', background: '#F0801E',
                  }}>
                    Active{daysLeft !== null ? ` · ${daysLeft}d left` : ''}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* AVAILABLE TOOLS */}
        {availableTools.length > 0 && (
          <>
            <h3 style={{ color: '#fff', fontSize: 17, fontWeight: 700, marginBottom: 16 }}>All Available Tools</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
              {availableTools.map(tool => (
               <div
  key={tool.id}
  onClick={() => router.push(`/studio/${tool.slug}`)}
  style={{
                    background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 24, cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, marginBottom: 14, background: 'rgba(255,255,255,0.05)'
                  }}>
                    {iconMap[tool.slug] || '🛠️'}
                  </div>
                  <h4 style={{ color: '#fff', margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>{tool.name}</h4>
                  <p style={{ color: '#999', margin: '0 0 14px', fontSize: 12.5, lineHeight: 1.5 }}>{tool.description}</p>

                  {tool.features && tool.features.length > 0 && (
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {tool.features.slice(0, 3).map((f, i) => (
                        <li key={i} style={{ fontSize: 11.5, color: '#aaa', display: 'flex', gap: 6 }}>
                          <span style={{ color: '#2fbf71' }}>✓</span>{f}
                        </li>
                      ))}
                    </ul>
                  )}

                  <span style={{
                    display: 'inline-block', fontSize: 10, fontWeight: 700,
                    padding: '3px 11px', borderRadius: 10, color: '#fff', background: '#4a4744',
                  }}>
                    Add tool
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* CUSTOM SERVICES — highlighted block at the very bottom */}
        <div
          style={{
            position: 'relative', overflow: 'hidden', marginTop: 56, borderRadius: 18, padding: '34px 34px',
            background: 'radial-gradient(ellipse at 0% 0%, rgba(240,128,30,0.28) 0%, transparent 55%), linear-gradient(135deg, #2f2b26 0%, #1f1d1b 100%)',
            border: '1.5px solid rgba(240,128,30,0.75)',
            boxShadow: '0 0 0 4px rgba(240,128,30,0.08), 0 16px 48px rgba(240,128,30,0.18)',
            display: 'flex', flexWrap: 'wrap', gap: 30, alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <div style={{ flex: '1 1 380px', minWidth: 0 }}>
            <span style={{
              display: 'inline-block', background: '#F0801E', color: '#fff', fontSize: 10.5, fontWeight: 800,
              letterSpacing: 1.2, padding: '5px 13px', borderRadius: 999, marginBottom: 14,
            }}>
              CUSTOM SERVICES
            </span>
            <h3 style={{ color: '#fff', fontSize: 26, fontWeight: 800, margin: '0 0 10px', lineHeight: 1.25 }}>
              Need something built <span style={{ color: '#F0801E' }}>just for your shop?</span>
            </h3>
            <p style={{ color: '#bbb', fontSize: 14.5, lineHeight: 1.6, margin: '0 0 18px', maxWidth: 520 }}>
              Custom CNC programs, process and cycle-time optimization, and tools made around your own machines and parts.
              Tell us the requirement and we will get back to you with a quote.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {['CNC Programming', 'Optimization', 'Custom Software', 'On-demand Manufacturing'].map(c => (
                <span key={c} style={{ fontSize: 12, fontWeight: 600, color: '#F0801E', background: 'rgba(240,128,30,0.12)', border: '1px solid rgba(240,128,30,0.3)', padding: '5px 12px', borderRadius: 999 }}>
                  {c}
                </span>
              ))}
            </div>
            <button
              onClick={() => router.push('/services')}
              style={{
                background: '#F0801E', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 28px',
                fontSize: 15, fontWeight: 800, cursor: 'pointer', boxShadow: '0 8px 22px rgba(240,128,30,0.35)',
              }}
            >
              Request a Custom Solution →
            </button>
          </div>

          <div style={{ flex: '0 1 230px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { icon: '⚙️', label: 'Programs' },
              { icon: '⏱️', label: 'Faster cycles' },
              { icon: '💻', label: 'Custom tools' },
              { icon: '🏭', label: 'Shop floor' },
            ].map(t => (
              <div key={t.label} style={{
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(240,128,30,0.25)', borderRadius: 12,
                padding: '18px 10px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 26, marginBottom: 6 }}>{t.icon}</div>
                <div style={{ color: '#ddd', fontSize: 12, fontWeight: 600 }}>{t.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
