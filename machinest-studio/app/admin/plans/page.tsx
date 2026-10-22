'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 24 } as const
const inputStyle = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 12px', fontSize: 14 } as const
const labelStyle = { display: 'block', fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600 } as const
const btnPrimary = { background: '#F0801E', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' } as const
const btnGhost = { background: 'transparent', border: '1px solid #3a3733', color: '#ddd', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const

type Plan = {
  id: string
  name: string
  description: string | null
  tool_ids: string[]
  monthly_price: number
  annual_price: number | null
  features: string[] | null
  badge: string | null
  display_order: number
  active: boolean
}
type ToolLite = { id: string; name: string }

const EMPTY = {
  id: '', name: '', description: '', tool_ids: [] as string[],
  monthly_price: '', annual_price: '', features: '', badge: '', display_order: '0', active: true,
}

export default function AdminPlansPage() {
  const router = useRouter()
  const supabase = createClient()

  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(true)
  const [plans, setPlans] = useState<Plan[]>([])
  const [tools, setTools] = useState<ToolLite[]>([])
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
      if (!profile?.is_admin) { router.push('/dashboard'); return }
      setChecking(false)
      load()
    }
    check()
  }, [])

  async function load() {
    setLoading(true)
    const res = await fetch('/api/admin/plans').then(r => r.json()).catch(() => ({ plans: [], tools: [] }))
    setPlans(res.plans || [])
    setTools(res.tools || [])
    setLoading(false)
  }

  function flash(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  function toggleTool(id: string) {
    setForm(f => ({
      ...f,
      tool_ids: f.tool_ids.includes(id) ? f.tool_ids.filter(t => t !== id) : [...f.tool_ids, id],
    }))
  }

  function startEdit(p: Plan) {
    setForm({
      id: p.id,
      name: p.name,
      description: p.description || '',
      tool_ids: p.tool_ids || [],
      monthly_price: String(p.monthly_price),
      annual_price: p.annual_price === null || p.annual_price === undefined ? '' : String(p.annual_price),
      features: (p.features || []).join('\n'),
      badge: p.badge || '',
      display_order: String(p.display_order ?? 0),
      active: p.active,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save() {
    setBusy(true)
    const payload = {
      name: form.name,
      description: form.description,
      tool_ids: form.tool_ids,
      monthly_price: form.monthly_price,
      annual_price: form.annual_price,
      features: form.features.split('\n').map(f => f.trim()).filter(Boolean),
      badge: form.badge,
      display_order: form.display_order,
      active: form.active,
    }
    const res = form.id
      ? await fetch(`/api/admin/plans/${form.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/admin/plans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { flash(data.error || 'Something went wrong', false); return }
    flash(form.id ? 'Plan updated' : 'Plan created')
    setForm(EMPTY)
    load()
  }

  async function toggleActive(p: Plan) {
    const res = await fetch(`/api/admin/plans/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !p.active }),
    })
    if (!res.ok) { flash('Could not update', false); return }
    load()
  }

  const toolName = (id: string) => tools.find(t => t.id === id)?.name || 'Unknown tool'

  if (checking) {
    return <div style={{ minHeight: '100vh', background: '#262421', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, sans-serif' }}>Checking access...</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #262421 0%, #302d29 100%)', fontFamily: 'Segoe UI, sans-serif', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, margin: 0 }}>Plans</h1>
          <button onClick={() => router.push('/admin')} style={btnGhost}>&larr; Back to Admin</button>
        </div>

        {msg && (
          <div style={{
            background: msg.ok ? '#1f2e22' : '#2e1f1f', border: `1px solid ${msg.ok ? '#2fbf71' : '#ff6b6b'}`,
            color: msg.ok ? '#2fbf71' : '#ff6b6b', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 14,
          }}>
            {msg.text}
          </div>
        )}

        <div style={{ ...card, marginBottom: 24 }}>
          <h2 style={{ color: '#fff', fontSize: 18, margin: '0 0 6px' }}>{form.id ? 'Edit plan' : 'Create plan'}</h2>
          <p style={{ color: '#999', fontSize: 13, margin: '0 0 18px' }}>
            Changes affect new purchases only. People who already bought keep what they paid for until it expires.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Plan name</label>
              <input style={inputStyle} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Turning + Milling" />
            </div>
            <div>
              <label style={labelStyle}>Badge (optional)</label>
              <input style={inputStyle} value={form.badge} onChange={e => setForm({ ...form, badge: e.target.value })} placeholder="e.g. Best value" />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Short description</label>
            <input style={inputStyle} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="One line shown under the plan name" />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Tools included</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              {tools.map(t => {
                const on = form.tool_ids.includes(t.id)
                return (
                  <label key={t.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8, background: '#1c1b19', cursor: 'pointer',
                    border: `1px solid ${on ? '#F0801E' : '#3a3733'}`, borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#ccc',
                  }}>
                    <input type="checkbox" checked={on} onChange={() => toggleTool(t.id)} />
                    {t.name}
                  </label>
                )
              })}
              {tools.length === 0 && <span style={{ color: '#777', fontSize: 13 }}>No tools found.</span>}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Monthly price (₹)</label>
              <input style={inputStyle} type="number" value={form.monthly_price} onChange={e => setForm({ ...form, monthly_price: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Annual price (₹, optional)</label>
              <input style={inputStyle} type="number" value={form.annual_price} onChange={e => setForm({ ...form, annual_price: e.target.value })} placeholder="Empty = not sold yearly" />
            </div>
            <div>
              <label style={labelStyle}>Display order</label>
              <input style={inputStyle} type="number" value={form.display_order} onChange={e => setForm({ ...form, display_order: e.target.value })} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Feature bullets (one per line, optional)</label>
            <textarea
              style={{ ...inputStyle, fontFamily: 'inherit' }}
              rows={4}
              value={form.features}
              onChange={e => setForm({ ...form, features: e.target.value })}
              placeholder={'Leave empty to show the included tools\' own features automatically'}
            />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ccc', fontSize: 13, marginBottom: 18, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
            Visible on the Membership page
          </label>

          <div style={{ display: 'flex', gap: 10 }}>
            <button style={btnPrimary} onClick={save} disabled={busy}>{busy ? 'Saving...' : form.id ? 'Save changes' : 'Create plan'}</button>
            {form.id && <button style={btnGhost} onClick={() => setForm(EMPTY)}>Cancel</button>}
          </div>
        </div>

        <div style={card}>
          <h2 style={{ color: '#fff', fontSize: 18, margin: '0 0 16px' }}>All plans</h2>
          {loading ? (
            <p style={{ color: '#999' }}>Loading...</p>
          ) : plans.length === 0 ? (
            <p style={{ color: '#999' }}>No plans yet. Create one above.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {plans.map(p => (
                <div key={p.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 8, padding: '12px 16px',
                  opacity: p.active ? 1 : 0.6,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
                      {p.name}
                      {p.badge && <span style={{ marginLeft: 8, color: '#2fbf71', fontSize: 11 }}>{p.badge}</span>}
                      {!p.active && <span style={{ marginLeft: 8, color: '#ff6b6b', fontSize: 11 }}>Hidden</span>}
                    </div>
                    <div style={{ color: '#999', fontSize: 12.5, marginTop: 3 }}>
                      {(p.tool_ids || []).map(toolName).join(' + ')}
                    </div>
                    <div style={{ color: '#F0801E', fontSize: 12.5, marginTop: 3, fontWeight: 600 }}>
                      ₹{p.monthly_price}/mo{p.annual_price ? ` · ₹${p.annual_price}/yr` : ' · no yearly option'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={btnGhost} onClick={() => toggleActive(p)}>{p.active ? 'Hide' : 'Show'}</button>
                    <button style={btnGhost} onClick={() => startEdit(p)}>Edit</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
