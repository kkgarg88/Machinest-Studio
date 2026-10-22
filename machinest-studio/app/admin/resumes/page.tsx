'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 20 } as const
const inputStyle = { background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '9px 12px', fontSize: 13 } as const
const btnGhost = { background: 'transparent', border: '1px solid #3a3733', color: '#ddd', borderRadius: 6, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const

type ResumeItem = {
  id: string
  user_id: string
  file_name: string
  file_size: number | null
  job_interest: string | null
  preferred_location: string | null
  consent: boolean
  updated_at: string
  profile: {
    full_name: string | null
    email: string | null
    phone: string | null
    company_name: string | null
    machine_type: string | null
    experience_years: number | string | null
  } | null
}

export default function AdminResumesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<ResumeItem[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
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
    const res = await fetch('/api/admin/resumes').then(r => r.json()).catch(() => ({ resumes: [] }))
    setItems(res.resumes || [])
    setLoading(false)
  }

  function flash(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(''), 3000)
  }

  async function download(id: string) {
    const res = await fetch(`/api/admin/resumes/${id}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.url) { flash(data.error || 'Could not open the file'); return }
    window.open(data.url, '_blank')
  }

  async function remove(item: ResumeItem) {
    const who = item.profile?.full_name || item.profile?.email || 'this user'
    if (!confirm(`Delete the resume of ${who}? This cannot be undone.`)) return
    const res = await fetch(`/api/admin/resumes/${item.id}`, { method: 'DELETE' })
    if (!res.ok) { flash('Could not delete'); return }
    flash('Resume deleted')
    load()
  }

  const roles = Array.from(new Set(items.map(i => i.job_interest).filter(Boolean))) as string[]

  const filtered = items.filter(i => {
    const q = search.toLowerCase()
    const matchesSearch = !q
      || (i.profile?.full_name || '').toLowerCase().includes(q)
      || (i.profile?.email || '').toLowerCase().includes(q)
      || (i.preferred_location || '').toLowerCase().includes(q)
    const matchesRole = roleFilter === 'all' || i.job_interest === roleFilter
    return matchesSearch && matchesRole
  })

  if (checking) {
    return <div style={{ minHeight: '100vh', background: '#262421', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, sans-serif' }}>Checking access...</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #262421 0%, #302d29 100%)', fontFamily: 'Segoe UI, sans-serif', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, margin: 0 }}>
            Resumes <span style={{ color: '#999', fontSize: 15, fontWeight: 600 }}>({items.length})</span>
          </h1>
          <button onClick={() => router.push('/admin')} style={btnGhost}>&larr; Back to Admin</button>
        </div>

        {msg && (
          <div style={{ background: '#1f2e22', border: '1px solid #2fbf71', color: '#2fbf71', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 14 }}>
            {msg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
          <input placeholder="Search name, email or location..." value={search} onChange={e => setSearch(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 220 }} />
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} style={inputStyle}>
            <option value="all">All roles</option>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        {loading ? (
          <p style={{ color: '#999' }}>Loading...</p>
        ) : filtered.length === 0 ? (
          <div style={card}><p style={{ color: '#999', margin: 0, fontSize: 14 }}>No resumes found.</p></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map(i => (
              <div key={i.id} style={{ ...card, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <div style={{ minWidth: 0, flex: '1 1 320px' }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
                    {i.profile?.full_name || '—'}
                    {i.job_interest && (
                      <span style={{ marginLeft: 10, background: 'rgba(240,128,30,0.15)', color: '#F0801E', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10 }}>
                        {i.job_interest}
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#999', fontSize: 12.5, marginTop: 4, lineHeight: 1.6 }}>
                    {i.profile?.email || '—'}{i.profile?.phone ? ` · ${i.profile.phone}` : ''}
                  </div>
                  <div style={{ color: '#777', fontSize: 12, marginTop: 2, lineHeight: 1.6 }}>
                    {[
                      i.profile?.company_name,
                      i.profile?.machine_type,
                      i.profile?.experience_years ? `${i.profile.experience_years} yrs exp` : null,
                      i.preferred_location ? `Wants: ${i.preferred_location}` : null,
                    ].filter(Boolean).join(' · ') || ' '}
                  </div>
                  <div style={{ color: '#666', fontSize: 11.5, marginTop: 4 }}>
                    {i.file_name} · updated {new Date(i.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{ ...btnGhost, background: '#F0801E', border: 'none', color: '#fff', fontWeight: 700 }} onClick={() => download(i.id)}>Download</button>
                  <button style={{ ...btnGhost, borderColor: '#ff6b6b', color: '#ff6b6b' }} onClick={() => remove(i)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
