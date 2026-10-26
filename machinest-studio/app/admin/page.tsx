'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Profile = { id: string; full_name: string; company_name: string; phone: string; email: string }
type Tool = { id: string; name: string; slug: string; description: string; monthly_price: number; annual_price: number; features: string[] | null }
type Sub = { user_id: string; tool_id: string; status: string; expires_at: string | null }
type Order = { id: string; user_id: string; tool_ids: string[]; billing_cycle: string; amount: number; status: string; created_at: string }
type Coupon = { id: string; code: string; discount_type: string; discount_value: number; max_uses: number | null; used_count: number; expires_at: string | null; active: boolean }

type PlanLite = { id: string; name: string; tool_ids: string[] }

const emptyForm = { id: '', name: '', slug: '', description: '', monthly_price: '', annual_price: '', features: '' }

export default function AdminPage() {
  const [tab, setTab] = useState<'users' | 'tools' | 'payments' | 'coupons'>('users')
  const [coupons, setCoupons] = useState<Coupon[]>([])
  const [couponForm, setCouponForm] = useState({ code: '', discount_type: 'percent', discount_value: '', max_uses: '', expires_at: '' })
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [tools, setTools] = useState<Tool[]>([])
  const [subs, setSubs] = useState<Sub[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [plans, setPlans] = useState<PlanLite[]>([])
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
    const { data: pl } = await supabase.from('plans').select('id, name, tool_ids').order('display_order', { ascending: true })
    setPlans((pl || []) as PlanLite[])
    const { data: c } = await supabase.from('coupons').select('*').order('created_at', { ascending: false })
    setCoupons(c || [])
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
    if (!form.name || !form.slug) return
    const payload = {
      id: form.id || undefined,
      name: form.name,
      slug: form.slug,
      description: form.description,
      features: form.features.split('\n').map(f => f.trim()).filter(Boolean),
    }
    if (form.id) {
      await supabase.from('tools').update(payload).eq('id', form.id)
    } else {
      // Prices now live on Plans; keep the old columns filled so the database stays valid
      await supabase.from('tools').insert({ ...payload, monthly_price: 0, annual_price: null })
    }
    setForm(emptyForm)
    await loadAll()
  }

  async function createCoupon() {
    if (!couponForm.code || !couponForm.discount_value) return
    await supabase.from('coupons').insert({
      code: couponForm.code.toUpperCase(),
      discount_type: couponForm.discount_type,
      discount_value: Number(couponForm.discount_value),
      max_uses: couponForm.max_uses ? Number(couponForm.max_uses) : null,
      expires_at: couponForm.expires_at || null,
    })
    setCouponForm({ code: '', discount_type: 'percent', discount_value: '', max_uses: '', expires_at: '' })
    await loadAll()
  }

  async function toggleCoupon(id: string, active: boolean) {
    await supabase.from('coupons').update({ active }).eq('id', id)
    await loadAll()
  }

  if (loading) return <div style={{ minHeight: '100vh', background: '#211f1d', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, sans-serif' }}>Loading...</div>

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

  const TABS: { key: 'users' | 'tools' | 'payments' | 'coupons'; label: string }[] = [
    { key: 'users', label: 'Users' },
    { key: 'tools', label: 'Tools' },
    { key: 'payments', label: 'Payments' },
    { key: 'coupons', label: 'Coupons' },
  ]
  const PAGES: { href: string; icon: string; label: string; note: string }[] = [
    { href: '/admin/plans', icon: '💳', label: 'Plans', note: 'Prices and tools in each plan' },
    { href: '/admin/cycle-media', icon: '🖼️', label: 'Cycle Media', note: 'Thumbnails and descriptions' },
    { href: '/admin/resources', icon: '📚', label: 'Resources', note: 'Free PDFs, videos, web tools' },
    { href: '/admin/leads', icon: '📞', label: 'Leads', note: 'Custom service requests' },
    { href: '/admin/queries', icon: '💬', label: 'Questions', note: 'Questions from users' },
    { href: '/admin/resumes', icon: '📄', label: 'Resumes', note: 'Uploaded CNC resumes' },
  ]

  const userCols = `minmax(150px,1.2fr) minmax(190px,1.4fr) minmax(110px,0.9fr) ${tools.map(() => 'minmax(110px,1fr)').join(' ')}`
  const initial = (n: string, e: string) => ((n || e || '?').trim()[0] || '?').toUpperCase()

  return (
    <div className="adm">
      <style>{CSS}</style>
      <header className="adm-top">
        <div className="adm-title">Admin <span>Panel</span></div>
        <button className="adm-back" onClick={() => router.push('/dashboard')}>← Dashboard</button>
      </header>

      <div className="adm-wrap">
        <div className="adm-stats">
          <div className="adm-stat"><div className="adm-sl">Total Users</div><div className="adm-sv">{profiles.length}</div></div>
          <div className="adm-stat"><div className="adm-sl">Active Subscriptions</div><div className="adm-sv" style={{ color: '#F0801E' }}>{activeSubsCount}</div></div>
          <div className="adm-stat"><div className="adm-sl">Tools Live</div><div className="adm-sv">{tools.length}</div></div>
          <div className="adm-stat"><div className="adm-sl">This Month&apos;s Revenue</div><div className="adm-sv" style={{ color: '#2fbf71' }}>₹{monthRevenue}</div></div>
        </div>

        <div className="adm-sec">Manage</div>
        <div className="adm-pages">
          {PAGES.map(pg => (
            <button key={pg.href} className="adm-page" onClick={() => router.push(pg.href)}>
              <span className="adm-pi">{pg.icon}</span>
              <span className="adm-pt"><b>{pg.label}</b><small>{pg.note}</small></span>
              <span className="adm-pa">→</span>
            </button>
          ))}
        </div>

        <div className="adm-tabs">
          {TABS.map(t => (
            <button key={t.key} className={`adm-tab${tab === t.key ? ' on' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>

        {tab === 'users' && (
          <div>
            <div className="adm-bar">
              <input className="adm-in" placeholder="Search name or email..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
              <select className="adm-in" value={toolFilter} onChange={e => setToolFilter(e.target.value)}>
                <option value="all">All users</option>
                {tools.map(t => <option key={t.id} value={t.id}>Has: {t.name}</option>)}
              </select>
              <span className="adm-count">{filteredProfiles.length} {filteredProfiles.length === 1 ? 'user' : 'users'}</span>
            </div>

            <div className="adm-table">
              <div className="adm-th" style={{ gridTemplateColumns: userCols }}>
                <span>Name</span><span>Email</span><span>Phone</span>
                {tools.map(t => <span key={t.id}>{t.name}</span>)}
              </div>
              {filteredProfiles.map(p => (
                <div key={p.id} className="adm-tr" style={{ gridTemplateColumns: userCols }}>
                  <span className="adm-who"><i>{initial(p.full_name, p.email)}</i><b>{p.full_name || '—'}</b></span>
                  <span className="adm-mut adm-ell">{p.email}</span>
                  <span className="adm-mut">{p.phone}</span>
                  {tools.map(t => {
                    const sub = subs.find(s => s.user_id === p.id && s.tool_id === t.id && s.status === 'active')
                    const expired = sub?.expires_at && new Date(sub.expires_at).getTime() < now
                    const on = !!sub && !expired
                    return (
                      <div key={t.id} className="adm-sub">
                        <button
                          className={`adm-pill ${on ? 'on' : expired ? 'exp' : 'off'}`}
                          onClick={() => toggleSub(p.id, t.id, !sub)}
                          title={on ? 'Click to cancel this subscription' : 'Click to grant access'}
                        >
                          {on ? 'Active' : expired ? 'Expired' : 'Grant'}
                        </button>
                        {sub?.expires_at && (
                          <small style={{ color: expired ? '#ff6b6b' : '#8a8782' }}>
                            till {new Date(sub.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </small>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
              {filteredProfiles.length === 0 && <p className="adm-empty">No users match this filter.</p>}
            </div>
          </div>
        )}

        {tab === 'tools' && (
          <div>
            <div className="adm-card">
              <h4>{form.id ? 'Edit Tool' : 'Add New Tool'}</h4>
              <p className="adm-hint">
                Prices are set per plan. After adding a tool, include it in a plan under <a onClick={() => router.push('/admin/plans')}>Plans →</a>
              </p>
              <div className="adm-g2">
                <input className="adm-in" placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                <input className="adm-in" placeholder="Slug (e.g. calibration-tracker)" value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} disabled={!!form.id} />
              </div>
              <input className="adm-in" placeholder="Short description (shown on dashboard tile)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ width: '100%', marginBottom: 10 }} />
              <textarea
                className="adm-in"
                placeholder={'Feature bullet points, one per line\ne.g.\nG71 Rough Turning\nOD Threading cycle'}
                value={form.features}
                onChange={e => setForm({ ...form, features: e.target.value })}
                rows={4}
                style={{ width: '100%', marginBottom: 12, fontFamily: 'inherit' }}
              />
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="adm-btn" onClick={saveTool}>{form.id ? 'Save Changes' : 'Add Tool'}</button>
                {form.id && <button className="adm-btn ghost" onClick={() => setForm(emptyForm)}>Cancel</button>}
              </div>
            </div>

            <div className="adm-card">
              {tools.map(t => {
                const inPlans = plans.filter(pl => (pl.tool_ids || []).includes(t.id))
                return (
                  <div key={t.id} className="adm-row">
                    <div>
                      <b style={{ color: '#fff' }}>{t.name}</b>
                      {inPlans.length > 0
                        ? <span className="adm-mut"> — in plans: {inPlans.map(pl => pl.name).join(', ')}</span>
                        : <span style={{ color: '#ff6b6b' }}> — not in any plan yet</span>}
                    </div>
                    <button className="adm-btn ghost sm" onClick={() => startEdit(t)}>Edit</button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {tab === 'payments' && (
          <div className="adm-table">
            <div className="adm-th" style={{ gridTemplateColumns: '1.3fr 1.6fr 1.2fr 0.8fr 0.8fr 0.8fr' }}>
              <span>Date</span><span>User</span><span>Tools</span><span>Cycle</span><span>Amount</span><span>Status</span>
            </div>
            {orders.map(o => {
              const userEmail = profiles.find(p => p.id === o.user_id)?.email || o.user_id
              const toolNames = o.tool_ids.map(id => tools.find(t => t.id === id)?.name || '—').join(', ')
              return (
                <div key={o.id} className="adm-tr" style={{ gridTemplateColumns: '1.3fr 1.6fr 1.2fr 0.8fr 0.8fr 0.8fr' }}>
                  <span className="adm-mut">{new Date(o.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                  <span className="adm-ell">{userEmail}</span>
                  <span>{toolNames}</span>
                  <span style={{ textTransform: 'capitalize' }}>{o.billing_cycle}</span>
                  <span style={{ color: '#2fbf71', fontWeight: 700 }}>₹{o.amount}</span>
                  <span className={`adm-pill static ${o.status === 'paid' ? 'paid' : 'off'}`}>{o.status}</span>
                </div>
              )
            })}
            {orders.length === 0 && <p className="adm-empty">No payments yet.</p>}
          </div>
        )}

        {tab === 'coupons' && (
          <div>
            <div className="adm-card">
              <h4>Create Coupon</h4>
              <div className="adm-g3">
                <input className="adm-in" placeholder="Code (e.g. DIWALI20)" value={couponForm.code} onChange={e => setCouponForm({ ...couponForm, code: e.target.value })} />
                <select className="adm-in" value={couponForm.discount_type} onChange={e => setCouponForm({ ...couponForm, discount_type: e.target.value })}>
                  <option value="percent">Percent (%)</option>
                  <option value="flat">Flat (₹)</option>
                </select>
                <input className="adm-in" placeholder="Discount value" type="number" value={couponForm.discount_value} onChange={e => setCouponForm({ ...couponForm, discount_value: e.target.value })} />
                <input className="adm-in" placeholder="Max uses (optional)" type="number" value={couponForm.max_uses} onChange={e => setCouponForm({ ...couponForm, max_uses: e.target.value })} />
                <input className="adm-in" placeholder="Expiry date (optional)" type="date" value={couponForm.expires_at} onChange={e => setCouponForm({ ...couponForm, expires_at: e.target.value })} />
              </div>
              <button className="adm-btn" onClick={createCoupon}>Create Coupon</button>
            </div>

            <div className="adm-card">
              {coupons.map(c => (
                <div key={c.id} className="adm-row">
                  <div>
                    <b style={{ color: '#F0801E' }}>{c.code}</b> — {c.discount_type === 'percent' ? `${c.discount_value}%` : `₹${c.discount_value}`} off
                    <span className="adm-mut">
                      {' · '}used {c.used_count}{c.max_uses ? `/${c.max_uses}` : ''}
                      {c.expires_at ? ` · expires ${new Date(c.expires_at).toLocaleDateString('en-IN')}` : ''}
                    </span>
                  </div>
                  <button className={`adm-pill ${c.active ? 'paid' : 'off'}`} onClick={() => toggleCoupon(c.id, !c.active)}>
                    {c.active ? 'Active' : 'Disabled'}
                  </button>
                </div>
              ))}
              {coupons.length === 0 && <p className="adm-empty" style={{ padding: 0 }}>No coupons yet.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const CSS = `
.adm{min-height:100vh;background:#211f1d;font-family:'Segoe UI',sans-serif;color:#ddd}
.adm *{box-sizing:border-box}
.adm-top{display:flex;align-items:center;justify-content:space-between;padding:14px 32px;background:#161513;border-bottom:2px solid #F0801E;position:sticky;top:0;z-index:5}
.adm-title{font-size:20px;font-weight:800;color:#fff}.adm-title span{color:#F0801E}
.adm-back{background:#F0801E;color:#fff;border:none;border-radius:999px;padding:9px 20px;font-size:13px;font-weight:700;cursor:pointer}
.adm-wrap{padding:28px 32px 48px;max-width:1240px;margin:0 auto}
.adm-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:30px}
.adm-stat{background:#2b2a28;border:1px solid #3a3733;border-radius:12px;padding:18px 20px}
.adm-sl{color:#9a958d;font-size:12.5px;margin-bottom:6px}.adm-sv{color:#fff;font-size:30px;font-weight:800;line-height:1.1}
.adm-sec{font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#8a8782;margin:0 0 12px}
.adm-pages{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px;margin-bottom:34px}
.adm-page{display:flex;align-items:center;gap:12px;background:#2b2a28;border:1px solid #3a3733;border-radius:12px;padding:14px 16px;cursor:pointer;text-align:left;color:#fff;transition:border-color .15s,transform .15s}
.adm-page:hover{border-color:#F0801E;transform:translateY(-1px)}
.adm-pi{width:40px;height:40px;border-radius:10px;background:rgba(240,128,30,.14);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
.adm-pt{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}.adm-pt b{font-size:14.5px}.adm-pt small{color:#8a8782;font-size:12px}
.adm-pa{color:#F0801E;font-weight:800}
.adm-tabs{display:flex;gap:4px;border-bottom:1px solid #3a3733;margin-bottom:22px;overflow-x:auto}
.adm-tab{background:none;border:none;color:#9a958d;font-weight:700;font-size:14px;padding:12px 20px;cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-1px;white-space:nowrap}
.adm-tab:hover{color:#fff}.adm-tab.on{color:#F0801E;border-bottom-color:#F0801E}
.adm-bar{display:flex;gap:10px;margin-bottom:14px;flex-wrap:wrap;align-items:center}
.adm-in{background:#1c1b19;border:1px solid #3a3733;border-radius:8px;color:#fff;padding:10px 12px;font-size:13.5px}
.adm-in:focus{outline:none;border-color:#F0801E}
.adm-count{color:#8a8782;font-size:12.5px;margin-left:4px}
.adm-table{background:#2b2a28;border:1px solid #3a3733;border-radius:12px;overflow-x:auto}
.adm-th,.adm-tr{display:grid;gap:12px;padding:13px 18px;align-items:center;min-width:760px}
.adm-th{font-size:11.5px;color:#8a8782;font-weight:800;letter-spacing:.06em;text-transform:uppercase;background:#242321;border-bottom:1px solid #3a3733}
.adm-tr{font-size:13.5px;border-bottom:1px solid #353230}.adm-tr:last-child{border-bottom:none}.adm-tr:hover{background:#302e2b}
.adm-who{display:flex;align-items:center;gap:10px;min-width:0}.adm-who b{color:#fff;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.adm-who i{font-style:normal;width:30px;height:30px;border-radius:50%;background:rgba(240,128,30,.18);color:#F0801E;font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.adm-mut{color:#9a958d}.adm-ell{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.adm-sub{display:flex;flex-direction:column;gap:3px;align-items:flex-start}.adm-sub small{font-size:10.5px}
.adm-pill{padding:5px 13px;font-size:11.5px;border-radius:999px;border:1px solid transparent;cursor:pointer;font-weight:700;color:#fff;background:#4a4744}
.adm-pill.on,.adm-pill.paid{background:#F0801E}.adm-pill.paid{background:#2fbf71}
.adm-pill.off{background:transparent;border-color:#4a4744;color:#bbb}.adm-pill.off:hover{border-color:#F0801E;color:#F0801E}
.adm-pill.exp{background:rgba(255,107,107,.15);border-color:#ff6b6b;color:#ff8a8a}
.adm-pill.static{cursor:default;width:fit-content;text-transform:capitalize}.adm-pill.static.off{background:#3a3733;border-color:transparent;color:#ddd}
.adm-empty{color:#777;padding:18px;font-size:13px;margin:0}
.adm-card{background:#2b2a28;border:1px solid #3a3733;border-radius:12px;padding:20px;margin-bottom:18px}
.adm-card h4{color:#fff;margin:0 0 12px;font-size:16px}
.adm-hint{color:#9a958d;font-size:12.5px;margin:-4px 0 14px}.adm-hint a{color:#F0801E;cursor:pointer;font-weight:700}
.adm-g2{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px}
.adm-g3{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-bottom:14px}
.adm-btn{background:#F0801E;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-weight:700;font-size:13.5px;cursor:pointer}
.adm-btn.ghost{background:transparent;color:#F0801E;border:1px solid #3a3733}.adm-btn.sm{padding:6px 14px;font-size:12px}
.adm-row{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #353230;font-size:13.5px}
.adm-row:last-child{border-bottom:none}
@media(max-width:640px){.adm-top{padding:12px 16px}.adm-wrap{padding:20px 16px 40px}.adm-g2{grid-template-columns:1fr}.adm-sv{font-size:26px}}
`
