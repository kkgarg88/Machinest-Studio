'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 20 } as const
const inputStyle = { background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '9px 12px', fontSize: 13 } as const
const btnGhost = { background: 'transparent', border: '1px solid #3a3733', color: '#ddd', borderRadius: 6, padding: '7px 13px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' } as const

type Status = 'new' | 'answered' | 'closed'

type QueryItem = {
  id: string
  user_id: string
  category: string
  subject: string
  message: string
  status: Status
  email_sent: boolean
  created_at: string
  profile: { full_name: string | null; email: string | null; phone: string | null; company_name: string | null } | null
}

const STATUS_LABEL: Record<Status, string> = { new: 'New', answered: 'Answered', closed: 'Closed' }
const STATUS_COLOR: Record<Status, string> = { new: '#F0801E', answered: '#2fbf71', closed: '#555' }

export default function AdminQueriesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<QueryItem[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [msg, setMsg] = useState('')

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
    const res = await fetch('/api/admin/queries').then(r => r.json()).catch(() => ({ queries: [] }))
    setItems(res.queries || [])
    setLoading(false)
  }

  function flash(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(''), 3000)
  }

  async function setStatus(id: string, status: Status) {
    const res = await fetch(`/api/admin/queries/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) { flash('Could not update status'); return }
    setItems(prev => prev.map(i => (i.id === id ? { ...i, status } : i)))
  }

  async function remove(item: QueryItem) {
    if (!confirm(`Delete "${item.subject}"? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/queries/${item.id}`, { method: 'DELETE' })
    if (!res.ok) { flash('Could not delete'); return }
    flash('Question deleted')
    load()
  }

  const categories = Array.from(new Set(items.map(i => i.category)))
  const newCount = items.filter(i => i.status === 'new').length

  const filtered = items.filter(i => {
    const q = search.toLowerCase()
    const matchesSearch = !q
      || i.subject.toLowerCase().includes(q)
      || i.message.toLowerCase().includes(q)
      || (i.profile?.full_name || '').toLowerCase().includes(q)
      || (i.profile?.email || '').toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'all' || i.status === statusFilter
    const matchesCategory = categoryFilter === 'all' || i.category === categoryFilter
    return matchesSearch && matchesStatus && matchesCategory
  })

  if (checking) {
    return <div style={{ minHeight: '100vh', background: '#262421', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, sans-serif' }}>Checking access...</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #262421 0%, #302d29 100%)', fontFamily: 'Segoe UI, sans-serif', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, margin: 0 }}>
            Questions <span style={{ color: '#999', fontSize: 15, fontWeight: 600 }}>({items.length} total · {newCount} new)</span>
          </h1>
          <button onClick={() => router.push('/admin')} style={btnGhost}>&larr; Back to Admin</button>
        </div>

        {msg && (
          <div style={{ background: '#1f2e22', border: '1px solid #2fbf71', color: '#2fbf71', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 14 }}>
            {msg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input placeholder="Search subject, message, name or email..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 220 }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | Status)} style={inputStyle}>
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="answered">Answered</option>
            <option value="closed">Closed</option>
          </select>
          <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={inputStyle}>
            <option value="all">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {loading ? (
          <p style={{ color: '#999' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div style={card}><p style={{ color: '#999', margin: 0, fontSize: 14 }}>No questions found.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(i => {
              const email = i.profile?.email || ''
              const mailto = email
                ? `mailto:${email}?subject=${encodeURIComponent('Re: ' + i.subject)}`
                : ''
              return (
                <div key={i.id} style={card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0, flex: '1 1 300px' }}>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{i.subject}</div>
                      <div style={{ color: '#F0801E', fontSize: 12, fontWeight: 600, marginTop: 3 }}>{i.category}</div>
                      <div style={{ color: '#999', fontSize: 12.5, marginTop: 6, lineHeight: 1.6 }}>
                        {i.profile?.full_name || '—'}{email ? ` · ${email}` : ''}{i.profile?.phone ? ` · ${i.profile.phone}` : ''}
                        {i.profile?.company_name ? ` · ${i.profile.company_name}` : ''}
                      </div>
                      <div style={{ color: '#666', fontSize: 11.5, marginTop: 2 }}>
                        {new Date(i.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        {i.email_sent ? ' · emailed to admin' : ' · admin email not sent'}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: STATUS_COLOR[i.status], padding: '4px 12px', borderRadius: 10 }}>
                      {STATUS_LABEL[i.status]}
                    </span>
                  </div>

                  <div style={{ color: '#ccc', fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 8, padding: 14, margin: '14px 0' }}>
                    {i.message}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {mailto && (
                      <a href={mailto} style={{ ...btnGhost, background: '#F0801E', border: 'none', color: '#fff', textDecoration: 'none', fontWeight: 700 }}>
                        Reply by email
                      </a>
                    )}
                    {(['new', 'answered', 'closed'] as Status[]).filter(s => s !== i.status).map(s => (
                      <button key={s} style={btnGhost} onClick={() => setStatus(i.id, s)}>Mark {STATUS_LABEL[s].toLowerCase()}</button>
                    ))}
                    <button style={{ ...btnGhost, borderColor: '#ff6b6b', color: '#ff6b6b' }} onClick={() => remove(i)}>Delete</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
