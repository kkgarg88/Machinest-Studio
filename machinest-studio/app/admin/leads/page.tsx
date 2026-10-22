'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 20 } as const
const inputStyle = { background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '9px 12px', fontSize: 13 } as const
const btnGhost = { background: 'transparent', border: '1px solid #3a3733', color: '#ddd', borderRadius: 6, padding: '7px 13px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' } as const

type Status = 'new' | 'contacted' | 'won' | 'lost'

type Lead = {
  id: string
  user_id: string | null
  name: string
  phone: string
  email: string | null
  service_type: string
  message: string
  status: Status
  admin_notes: string | null
  email_sent: boolean
  created_at: string
}

const STATUS_LABEL: Record<Status, string> = { new: 'New', contacted: 'Contacted', won: 'Won', lost: 'Lost' }
const STATUS_COLOR: Record<Status, string> = { new: '#F0801E', contacted: '#4dabf7', won: '#2fbf71', lost: '#555' }
const ALL: Status[] = ['new', 'contacted', 'won', 'lost']

function whatsappLink(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.length === 10) digits = '91' + digits
  return `https://wa.me/${digits}`
}

export default function AdminLeadsPage() {
  const router = useRouter()
  const supabase = createClient()

  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState<Lead[]>([])
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | Status>('all')
  const [serviceFilter, setServiceFilter] = useState('all')
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
    const res = await fetch('/api/admin/leads').then(r => r.json()).catch(() => ({ leads: [] }))
    const list: Lead[] = res.leads || []
    setLeads(list)
    const n: Record<string, string> = {}
    list.forEach(l => { n[l.id] = l.admin_notes || '' })
    setNotes(n)
    setLoading(false)
  }

  function flash(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(''), 3000)
  }

  async function setStatus(id: string, status: Status) {
    const res = await fetch(`/api/admin/leads/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    if (!res.ok) { flash('Could not update status'); return }
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, status } : l)))
  }

  async function saveNotes(id: string) {
    const res = await fetch(`/api/admin/leads/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_notes: notes[id] || '' }),
    })
    if (!res.ok) { flash('Could not save notes'); return }
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, admin_notes: notes[id] || null } : l)))
    flash('Notes saved')
  }

  async function remove(l: Lead) {
    if (!confirm(`Delete the request from ${l.name}? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/leads/${l.id}`, { method: 'DELETE' })
    if (!res.ok) { flash('Could not delete'); return }
    flash('Lead deleted')
    load()
  }

  const services = Array.from(new Set(leads.map(l => l.service_type)))
  const newCount = leads.filter(l => l.status === 'new').length

  const filtered = leads.filter(l => {
    const q = search.toLowerCase()
    const matchesSearch = !q
      || l.name.toLowerCase().includes(q)
      || l.phone.toLowerCase().includes(q)
      || (l.email || '').toLowerCase().includes(q)
      || l.message.toLowerCase().includes(q)
    const matchesStatus = statusFilter === 'all' || l.status === statusFilter
    const matchesService = serviceFilter === 'all' || l.service_type === serviceFilter
    return matchesSearch && matchesStatus && matchesService
  })

  if (checking) {
    return <div style={{ minHeight: '100vh', background: '#262421', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, sans-serif' }}>Checking access...</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #262421 0%, #302d29 100%)', fontFamily: 'Segoe UI, sans-serif', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, margin: 0 }}>
            Custom Service Leads <span style={{ color: '#999', fontSize: 15, fontWeight: 600 }}>({leads.length} total · {newCount} new)</span>
          </h1>
          <button onClick={() => router.push('/admin')} style={btnGhost}>&larr; Back to Admin</button>
        </div>

        {msg && (
          <div style={{ background: '#1f2e22', border: '1px solid #2fbf71', color: '#2fbf71', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 14 }}>
            {msg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input placeholder="Search name, phone, email or message..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 220 }} />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | Status)} style={inputStyle}>
            <option value="all">All statuses</option>
            {ALL.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <select value={serviceFilter} onChange={e => setServiceFilter(e.target.value)} style={inputStyle}>
            <option value="all">All services</option>
            {services.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {loading ? (
          <p style={{ color: '#999' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div style={card}><p style={{ color: '#999', margin: 0, fontSize: 14 }}>No requests found.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(l => (
              <div key={l.id} style={card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: '1 1 300px' }}>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
                      {l.name}
                      <span style={{ marginLeft: 10, background: 'rgba(240,128,30,0.15)', color: '#F0801E', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10 }}>
                        {l.service_type}
                      </span>
                    </div>
                    <div style={{ color: '#999', fontSize: 12.5, marginTop: 5, lineHeight: 1.6 }}>
                      {l.phone}{l.email ? ` · ${l.email}` : ''}
                      {' · '}{l.user_id ? 'registered user' : 'visitor'}
                    </div>
                    <div style={{ color: '#666', fontSize: 11.5, marginTop: 2 }}>
                      {new Date(l.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      {l.email_sent ? ' · emailed to admin' : ' · admin email not sent'}
                    </div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: STATUS_COLOR[l.status], padding: '4px 12px', borderRadius: 10 }}>
                    {STATUS_LABEL[l.status]}
                  </span>
                </div>

                <div style={{ color: '#ccc', fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 8, padding: 14, margin: '14px 0' }}>
                  {l.message}
                </div>

                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <textarea
                    placeholder="Your private notes (quote given, follow-up date...)"
                    value={notes[l.id] ?? ''}
                    onChange={e => setNotes(prev => ({ ...prev, [l.id]: e.target.value }))}
                    rows={2}
                    style={{ ...inputStyle, flex: '1 1 300px', fontFamily: 'inherit' }}
                  />
                  <button style={btnGhost} onClick={() => saveNotes(l.id)}>Save notes</button>
                </div>

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <a href={`tel:${l.phone}`} style={{ ...btnGhost, background: '#F0801E', border: 'none', color: '#fff', textDecoration: 'none', fontWeight: 700 }}>Call</a>
                  <a href={whatsappLink(l.phone)} target="_blank" rel="noopener noreferrer" style={{ ...btnGhost, textDecoration: 'none' }}>WhatsApp</a>
                  {l.email && (
                    <a href={`mailto:${l.email}?subject=${encodeURIComponent('Re: ' + l.service_type)}`} style={{ ...btnGhost, textDecoration: 'none' }}>Email</a>
                  )}
                  {ALL.filter(s => s !== l.status).map(s => (
                    <button key={s} style={btnGhost} onClick={() => setStatus(l.id, s)}>Mark {STATUS_LABEL[s].toLowerCase()}</button>
                  ))}
                  <button style={{ ...btnGhost, borderColor: '#ff6b6b', color: '#ff6b6b' }} onClick={() => remove(l)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
