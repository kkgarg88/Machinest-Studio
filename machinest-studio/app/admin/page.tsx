'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Profile = { id: string; full_name: string; company_name: string; phone: string; email: string }
type Tool = { id: string; name: string; slug: string; description: string; monthly_price: number; annual_price: number; features: string[] | null }
type Sub = { user_id: string; tool_id: string; status: string; expires_at: string | null }
type Order = { id: string; user_id: string; tool_ids: string[]; billing_cycle: string; amount: number; status: string; created_at: string }

const emptyForm = { id: '', name: '', slug: '', description: '', monthly_price: '', annual_price: '', features: '' }

export default function AdminPage() {
  const [tab, setTab] = useState<'users' | 'tools' | 'payments'>('users')
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [tools, setTools] = useState<Tool[]>([])
  const [subs, setSubs] = useState<Sub[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [toolFilter, setToolFilter] = useState('all')
  const supabase = createClient()
  const router = useRouter()

  async function loadAll() {
    const { data: p } = await supabase.from('profiles').select('*')
    const { data: t } = await supabase.from('tools').select('*')
    const { data: s } = await supabase.from('subscriptions').select('*')
    const { data: o } = await supabase.from('payment_orders').select('*').order('created_at', { ascending: false })
    setProfiles(p || [])
    setTools(t || [])
    setSubs(s || [])
    setOrders(o || [])
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: myProfile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      if (!myProfile?.is_admin) { router.push('/dashboard'); return }
      await loadAll()
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
    await loadAll()
  }

  function startEdit(t: Tool) {
    setForm({
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description || '',
      monthly_price: String(t.monthly_price),
      annual_price: String(t.annual_price ?? ''),
      features: (t.features || []).join('\n'),
    })
  }

  async function saveTool() {
    if (!form.name || !form.slug || !form.monthly_price) return
    const payload = {
      id: form.id || undefined,
      name: form.name,
      slug: form.slug,
      description: form.description,
      monthly_price: Number(form.monthly_price),
      annual_price: form.annual_price ? Number(form.annual_price) : null,
      features: form.features.split('\n').map(f => f.trim()).filter(Boolean),
    }
    if (form.id) {
      await supabase.from('tools').update(payload).eq('id', form.id)
    } else {
      await supabase.from('tools').insert(payload)
    }
    setForm(emptyForm)
    await loadAll()
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#211f1d', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, sans-serif' }}>Loading...</div>

  const inputStyle = { background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '9px 12px', fontSize: 13 }

  const now = Date.now()
  const filteredProfiles = profiles.filter(p => {
    const matchesSearch = !search || (p.full_name || '').toLowerCase().includes(search.toLowerCase()) || (p.email || '').toLowerCase().includes(search.toLowerCase())
    const matchesTool = toolFilter === 'all' || subs.some(s => s.user_id === p.id && s.tool_id === toolFilter && s.status === 'active')
    return matchesSearch && matchesTool
  })

  const activeSubsCount = subs.filter(s => s.status === 'active' && (!s.expires_at || new Date(s.expires_at).getTime() > now)).length
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const monthRevenue = orders
    .filter(o => o.status === 'paid' && new Date(o.created_at).getTime() >= monthStart)
    .reduce((sum, o) => sum + Number(o.amount), 0)

  return (
    <div style={{ minHeight: '100vh', background: '#211f1d', fontFamily: 'Segoe UI, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 32px', background: '#161513', borderBottom: '2px solid #F0801E' }}>
        <span style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>Admin Panel</span>
        <button onClick={() => router.push('/dashboard')} style={{ background: '#F0801E', color: '#fff', border: 'none', borderRadius: 999, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          ← Dashboard
        </button>
      </header>

      <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 14, marginBottom: 26 }}>
          <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 10, padding: 16 }}>
            <div style={{ color: '#999', fontSize: 12 }}>Total Users</div>
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 800 }}>{profiles.length}</div>
          </div>
          <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 10, padding: 16 }}>
            <div style={{ color: '#999', fontSize: 12 }}>Active Subscriptions</div>
            <div style={{ color: '#F0801E', fontSize: 24, fontWeight: 800 }}>{activeSubsCount}</div>
          </div>
          <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 10, padding: 16 }}>
            <div style={{ color: '#999', fontSize: 12 }}>Tools Live</div>
            <div style={{ color: '#fff', fontSize: 24, fontWeight: 800 }}>{tools.length}</div>
          </div>
          <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 10, padding: 16 }}>
            <div style={{ color: '#999', fontSize: 12 }}>This Month's Revenue</div>
            <div style={{ color: '#2fbf71', fontSize: 24, fontWeight: 800 }}>₹{monthRevenue}</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          <button onClick={() => setTab('users')} style={{ padding: '9px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: tab === 'users' ? '#F0801E' : '#2b2a28', color: '#fff' }}>Users</button>
          <button onClick={() => setTab('tools')} style={{ padding: '9px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: tab === 'tools' ? '#F0801E' : '#2b2a28', color: '#fff' }}>Tools</button>
          <button onClick={() => setTab('payments')} style={{ padding: '9px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: tab === 'payments' ? '#F0801E' : '#2b2a28', color: '#fff' }}>Payments</button>
        </div>

        {tab === 'users' && (
          <div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <input placeholder="Search name or email..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 220 }} />
              <select value={toolFilter} onChange={e => setToolFilter(e.target.value)} style={inputStyle}>
                <option value="all">All users</option>
                {tools.map(t => <option key={t.id} value={t.id}>Has: {t.name}</option>)}
              </select>
            </div>

            <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 10, overflow: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: `1.3fr 1.3fr 1fr ${tools.map(() => '1.2fr').join(' ')}`, padding: '12px 16px', fontSize: 12, color: '#999', fontWeight: 700, borderBottom: '1px solid #3a3733', minWidth: 700 }}>
                <span>Name</span><span>Email</span><span>Phone</span>
                {tools.map(t => <span key={t.id}>{t.name}</span>)}
              </div>
              {filteredProfiles.map(p => (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: `1.3fr 1.3fr 1fr ${tools.map(() => '1.2fr').join(' ')}`, padding: '12px 16px', fontSize: 13, color: '#ddd', borderBottom: '1px solid #3a3733', alignItems: 'center', minWidth: 700 }}>
                  <span>{p.full_name || '—'}</span>
                  <span style={{ color: '#999', fontSize: 12 }}>{p.email}</span>
                  <span style={{ color: '#999' }}>{p.phone}</span>
                  {tools.map(t => {
                    const sub = subs.find(s => s.user_id === p.id && s.tool_id === t.id && s.status === 'active')
                    const expired = sub?.expires_at && new Date(sub.expires_at).getTime() < now
                    return (
                      <div key={t.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <button
                          onClick={() => toggleSub(p.id, t.id, !sub)}
                          style={{ padding: '5px 10px', fontSize: 11, borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, background: sub && !expired ? '#F0801E' : '#4a4744', color: '#fff', width: 'fit-content' }}
                        >
                          {sub && !expired ? 'Active' : expired ? 'Expired' : 'Grant'}
                        </button>
                        {sub?.expires_at && (
                          <span style={{ fontSize: 10, color: expired ? '#ff6b6b' : '#888' }}>
                            till {new Date(sub.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
              {filteredProfiles.length === 0 && <p style={{ color: '#777', padding: 16, fontSize: 13 }}>No users match this filter.</p>}
            </div>
          </div>
        )}

        {tab === 'tools' && (
          <div>
            <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 10, padding: 20, marginBottom: 20 }}>
              <h4 style={{ color: '#fff', marginTop: 0 }}>{form.id ? 'Edit Tool' : 'Add New Tool'}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <input placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={inputStyle} />
                <input placeholder="Slug (e.g. calibration-tracker)" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} style={inputStyle} disabled={!!form.id} />
                <input placeholder="Monthly Price" type="number" value={form.monthly_price} onChange={e => setForm({ ...form, monthly_price: e.target.value })} style={inputStyle} />
                <input placeholder="Annual Price" type="number" value={form.annual_price} onChange={e => setForm({ ...form, annual_price: e.target.value })} style={inputStyle} />
              </div>
              <input placeholder="Short description (shown on dashboard tile)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ ...inputStyle, width: '100%', marginBottom: 10 }} />
              <textarea
                placeholder={'Feature bullet points, one per line\ne.g.\nG71 Rough Turning\nOD Threading cycle'}
                value={form.features}
                onChange={e => setForm({ ...form, features: e.target.value })}
                rows={4}
                style={{ ...inputStyle, width: '100%', marginBottom: 12, fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={saveTool} style={{ background: '#F0801E', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 18px', fontWeight: 700, cursor: 'pointer' }}>
                  {form.id ? 'Save Changes' : 'Add Tool'}
                </button>
                {form.id && (
                  <button onClick={() => setForm(emptyForm)} style={{ background: 'transparent', color: '#ddd', border: '1px solid #3a3733', borderRadius: 6, padding: '9px 18px', cursor: 'pointer' }}>
                    Cancel
                  </button>
                )}
              </div>
            </div>

            <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 10, padding: 20 }}>
              {tools.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #3a3733' }}>
                  <div style={{ color: '#ddd', fontSize: 13 }}>
                    <b style={{ color: '#fff' }}>{t.name}</b> — ₹{t.monthly_price}/mo, ₹{t.annual_price}/yr
                  </div>
                  <button onClick={() => startEdit(t)} style={{ background: 'transparent', border: '1px solid #3a3733', color: '#F0801E', borderRadius: 6, padding: '6px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    Edit
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'payments' && (
          <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 10, overflow: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 1fr 1fr', padding: '12px 16px', fontSize: 12, color: '#999', fontWeight: 700, borderBottom: '1px solid #3a3733', minWidth: 700 }}>
              <span>Date</span><span>User</span><span>Tools</span><span>Cycle</span><span>Amount</span><span>Status</span>
            </div>
            {orders.map(o => {
              const userEmail = profiles.find(p => p.id === o.user_id)?.email || o.user_id
              const toolNames = o.tool_ids.map(id => tools.find(t => t.id === id)?.name || '—').join(', ')
              return (
                <div key={o.id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 1fr 1fr', padding: '12px 16px', fontSize: 13, color: '#ddd', borderBottom: '1px solid #3a3733', minWidth: 700 }}>
                  <span style={{ color: '#999', fontSize: 12 }}>{new Date(o.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  <span style={{ fontSize: 12 }}>{userEmail}</span>
                  <span style={{ fontSize: 12 }}>{toolNames}</span>
                  <span style={{ fontSize: 12, textTransform: 'capitalize' }}>{o.billing_cycle}</span>
                  <span style={{ color: '#2fbf71', fontWeight: 700 }}>₹{o.amount}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 10, width: 'fit-content',
                    color: '#fff', background: o.status === 'paid' ? '#2fbf71' : '#555',
                  }}>
                    {o.status}
                  </span>
                </div>
              )
            })}
            {orders.length === 0 && <p style={{ color: '#777', padding: 16, fontSize: 13 }}>No payments yet.</p>}
          </div>
        )}
      </div>
    </div>
  )
}