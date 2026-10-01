'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Tool = {
  id: string
  name: string
  slug: string
  description: string
  monthly_price: number
}

const iconMap: Record<string, string> = {
  'turning-studio': '🔩',
  'milling-studio': '⚙️',
}

export default function Dashboard() {
  const [tools, setTools] = useState<Tool[]>([])
  const [activeIds, setActiveIds] = useState<string[]>([])
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
  .select('tool_id')
  .eq('user_id', user.id)
  .eq('status', 'active')
  .or(`expires_at.is.null,expires_at.gt.${nowIso}`)

      setTools(toolsData || [])
      setActiveIds((subsData || []).map(s => s.tool_id))
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

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #262421 0%, #302d29 100%)', fontFamily: 'Segoe UI, sans-serif' }}>
      <header style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 32px', background: '#4b3f3f', borderBottom: '2px solid #F0801E', position: 'relative'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
  <img src="/logo-icon.png" alt="Machinest Studio" style={{ height: 44, width: 'auto', display: 'block' }} />
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
                  { label: 'Membership Plan', action: () => router.push('/membership') },
                  { label: 'Renew Validity', action: () => router.push('/membership') },
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

      <div style={{ padding: '48px 40px', maxWidth: 1000, margin: '0 auto' }}>
        <h2 style={{ color: '#fff', fontSize: 28, margin: '0 0 6px', fontWeight: 800 }}>Your Dashboard</h2>
        <p style={{ color: '#999', fontSize: 14, marginBottom: 32 }}>Pick a tool to get started</p>

        {tools.length === 0 ? (
          <p style={{ color: '#777', fontSize: 14 }}>No tools available yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 20 }}>
            {tools.map(tool => {
              const isActive = activeIds.includes(tool.id)
              return (
                <div
                  key={tool.id}
                  onClick={() => isActive ? router.push(`/studio/${tool.slug}`) : router.push('/membership')}
                  style={{
                    background: 'linear-gradient(150deg, #2f2d2a 0%, #262421 100%)',
                    border: `1px solid ${isActive ? 'rgba(240,128,30,0.5)' : '#3a3733'}`,
                    borderRadius: 12, padding: 24, cursor: 'pointer',
                    boxShadow: isActive ? '0 6px 20px rgba(240,128,30,0.12)' : '0 4px 14px rgba(0,0,0,0.2)',
                    transition: '.2s'
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, marginBottom: 14, background: isActive ? 'rgba(240,128,30,0.15)' : 'rgba(255,255,255,0.05)'
                  }}>
                    {iconMap[tool.slug] || '🛠️'}
                  </div>
                  <h4 style={{ color: '#fff', margin: '0 0 6px', fontSize: 16, fontWeight: 700 }}>{tool.name}</h4>
                  <p style={{ color: '#999', margin: 0, fontSize: 12.5, lineHeight: 1.5 }}>{tool.description}</p>
                  <span style={{
                    display: 'inline-block', fontSize: 10, fontWeight: 700, marginTop: 14,
                    padding: '3px 11px', borderRadius: 10, color: '#fff',
                    background: isActive ? '#F0801E' : '#4a4744'
                  }}>
                    {isActive ? 'Active' : 'Add tool'}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}