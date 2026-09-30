'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Profile = { id: string; full_name: string; company_name: string; phone: string; email: string }
type Tool = { id: string; name: string; slug: string; description: string; monthly_price: number }
type Sub = { user_id: string; tool_id: string; status: string }

export default function AdminPage() {
  const [tab, setTab] = useState<'users' | 'tools'>('users')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [tools, setTools] = useState<Tool[]>([])
  const [subs, setSubs] = useState<Sub[]>([])
  const [loading, setLoading] = useState(true)
  const [newTool, setNewTool] = useState({ name: '', slug: '', description: '', monthly_price: '' })
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession()
if (!session) { router.push('/'); return }
const user = session.user

      const { data: myProfile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      if (!myProfile?.is_admin) { router.push('/dashboard'); return }

      const { data: p } = await supabase.from('profiles').select('*')
      const { data: t } = await supabase.from('tools').select('*')
      const { data: s } = await supabase.from('subscriptions').select('*')
      setProfiles(p || [])
      setTools(t || [])
      setSubs(s || [])
      setLoading(false)
    }
    load()
  }, [])

async function toggleSub(userId: string, toolId: string, active: boolean) {
  const res = await fetch('/api/admin/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, toolId, status: active ? 'active' : 'cancelled' }),
  })
  if (!res.ok) { alert('Could not update subscription'); return }
  const { data: s } = await supabase.from('subscriptions').select('*')
  setSubs(s || [])
}

  async function addTool() {
    if (!newTool.name || !newTool.slug || !newTool.monthly_price) return
    await supabase.from('tools').insert({
      name: newTool.name, slug: newTool.slug,
      description: newTool.description, monthly_price: Number(newTool.monthly_price),
    })
    const { data: t } = await supabase.from('tools').select('*')
    setTools(t || [])
    setNewTool({ name: '', slug: '', description: '', monthly_price: '' })
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#211f1d', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, sans-serif' }}>Loading...</div>

  const inputStyle = { background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '9px 12px', fontSize: 13 }

  return (
    <div style={{ minHeight: '100vh', background: '#211f1d', fontFamily: 'Segoe UI, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 32px', background: '#161513', borderBottom: '2px solid #F0801E' }}>
        <span style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>Admin Panel</span>
        <button onClick={() => router.push('/dashboard')} style={{ background: '#F0801E', color: '#fff', border: 'none', borderRadius: 999, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          ← Dashboard
        </button>
      </header>

      <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <button onClick={() => setTab('users')} style={{ padding: '9px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: tab === 'users' ? '#F0801E' : '#2b2a28', color: '#fff' }}>Users</button>
          <button onClick={() => setTab('tools')} style={{ padding: '9px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: tab === 'tools' ? '#F0801E' : '#2b2a28', color: '#fff' }}>Tools</button>
        </div>

        {tab === 'users' && (
          <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: `1.5fr 1fr 1fr ${tools.map(() => '1fr').join(' ')}`, padding: '12px 16px', fontSize: 12, color: '#999', fontWeight: 700, borderBottom: '1px solid #3a3733' }}>
              <span>Name / Email</span><span>Company</span><span>Phone</span>
              {tools.map(t => <span key={t.id}>{t.name}</span>)}
            </div>
            {profiles.map(p => (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: `1.5fr 1fr 1fr ${tools.map(() => '1fr').join(' ')}`, padding: '12px 16px', fontSize: 13, color: '#ddd', borderBottom: '1px solid #3a3733', alignItems: 'center' }}>
                <span>{p.full_name || p.email}</span>
                <span style={{ color: '#999' }}>{p.company_name}</span>
                <span style={{ color: '#999' }}>{p.phone}</span>
                {tools.map(t => {
                  const active = subs.find(s => s.user_id === p.id && s.tool_id === t.id && s.status === 'active')
                  return (
                    <button
                      key={t.id}
                      onClick={() => toggleSub(p.id, t.id, !active)}
                      style={{ padding: '5px 10px', fontSize: 11, borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, background: active ? '#F0801E' : '#4a4744', color: '#fff', width: 'fit-content' }}
                    >
                      {active ? 'Active' : 'Grant'}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {tab === 'tools' && (
          <div>
            <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 10, padding: 20, marginBottom: 20 }}>
              <h4 style={{ color: '#fff', marginTop: 0 }}>Add New Tool</h4>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <input placeholder="Name" value={newTool.name} onChange={e => setNewTool({ ...newTool, name: e.target.value })} style={inputStyle} />
                <input placeholder="Slug (e.g. calibration-tracker)" value={newTool.slug} onChange={e => setNewTool({ ...newTool, slug: e.target.value })} style={inputStyle} />
                <input placeholder="Description" value={newTool.description} onChange={e => setNewTool({ ...newTool, description: e.target.value })} style={inputStyle} />
                <input placeholder="Price/mo" type="number" value={newTool.monthly_price} onChange={e => setNewTool({ ...newTool, monthly_price: e.target.value })} style={{ ...inputStyle, width: 90 }} />
                <button onClick={addTool} style={{ background: '#F0801E', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 18px', fontWeight: 700, cursor: 'pointer' }}>Add</button>
              </div>
            </div>
            <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 10, padding: 20 }}>
              {tools.map(t => (
                <div key={t.id} style={{ padding: '10px 0', borderBottom: '1px solid #3a3733', color: '#ddd', fontSize: 13 }}>
                  <b style={{ color: '#fff' }}>{t.name}</b> — {t.description} — ₹{t.monthly_price}/mo
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}