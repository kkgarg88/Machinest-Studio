'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

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
                  onClick={() => router.push('/membership')}
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
      </div>
    </div>
  )
}