'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 24 } as const
const inputStyle = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 12px', fontSize: 14 } as const
const labelStyle = { display: 'block', fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600 } as const

const CATEGORIES = [
  'Technical help (using a cycle)',
  'New cycle / feature request',
  'Payment / membership',
  'Job / career',
  'Other',
]

type QueryRow = {
  id: string
  category: string
  subject: string
  message: string
  status: 'new' | 'answered' | 'closed'
  created_at: string
}

const STATUS_STYLE: Record<string, { label: string; bg: string }> = {
  new: { label: 'Sent', bg: '#4a4744' },
  answered: { label: 'Answered', bg: '#2fbf71' },
  closed: { label: 'Closed', bg: '#555' },
}

export default function AskPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [rows, setRows] = useState<QueryRow[]>([])
  const [category, setCategory] = useState(CATEGORIES[0])
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  async function loadRows(userId: string) {
    const { data } = await supabase
      .from('queries')
      .select('id, category, subject, message, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setRows((data || []) as QueryRow[])
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setEmail(user.email || '')
      await loadRows(user.id)
      setLoading(false)
    }
    load()
  }, [])

  function flash(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 5000)
  }

  async function submit() {
    if (subject.trim().length < 3) { flash('Please add a short subject.', false); return }
    if (message.trim().length < 10) { flash('Please describe your question in a few words (at least 10 characters).', false); return }

    setBusy(true)
    const res = await fetch('/api/queries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, subject, message }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { flash(data.error || 'Something went wrong', false); return }

    setSubject('')
    setMessage('')
    flash('Question sent. We will reply to your email.')
    const { data: { user } } = await supabase.auth.getUser()
    if (user) loadRows(user.id)
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#262421', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, sans-serif' }}>Loading...</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #262421 0%, #302d29 100%)', fontFamily: 'Segoe UI, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 32px', background: '#211f1d', borderBottom: '2px solid #F0801E' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo-icon.png" alt="Machinest Studio" style={{ height: 40, width: 'auto' }} />
          <span style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>Machinest <span style={{ color: '#F0801E' }}>Studio</span></span>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ background: '#F0801E', color: '#fff', border: 'none', borderRadius: 999, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          &larr; Dashboard
        </button>
      </header>

      <div style={{ padding: '32px 24px', maxWidth: 680, margin: '0 auto' }}>
        <h2 style={{ color: '#fff', fontSize: 24, margin: '0 0 6px', fontWeight: 800 }}>Ask a Question</h2>
        <p style={{ color: '#999', fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
          Stuck on a cycle, want a new one, or have a billing or job query? Send it here. Our reply comes to <b style={{ color: '#ccc' }}>{email}</b>.
        </p>

        {msg && (
          <div style={{
            background: msg.ok ? '#1f2e22' : '#2e1f1f', border: `1px solid ${msg.ok ? '#2fbf71' : '#ff6b6b'}`,
            color: msg.ok ? '#2fbf71' : '#ff6b6b', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 14,
          }}>
            {msg.text}
          </div>
        )}

        <div style={card}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Category</label>
            <select style={inputStyle} value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Subject</label>
            <input style={inputStyle} value={subject} maxLength={120} onChange={e => setSubject(e.target.value)} placeholder="One line summary" />
          </div>
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Your question</label>
            <textarea
              style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
              rows={6}
              maxLength={2000}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Describe what you need. For a cycle problem, mention the cycle name and the values you entered."
            />
            <div style={{ textAlign: 'right', color: '#777', fontSize: 11.5, marginTop: 4 }}>{message.length}/2000</div>
          </div>
          <button
            onClick={submit}
            disabled={busy}
            style={{ background: '#F0801E', color: '#fff', border: 'none', borderRadius: 6, padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            {busy ? 'Sending...' : 'Send question'}
          </button>
        </div>

        <h3 style={{ color: '#fff', fontSize: 16, margin: '32px 0 14px' }}>Your questions</h3>
        {rows.length === 0 ? (
          <p style={{ color: '#777', fontSize: 14 }}>You haven't asked anything yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {rows.map(r => {
              const st = STATUS_STYLE[r.status] || STATUS_STYLE.new
              return (
                <div key={r.id} style={{ ...card, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{r.subject}</div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: '#fff', background: st.bg, padding: '3px 10px', borderRadius: 10, whiteSpace: 'nowrap' }}>{st.label}</span>
                  </div>
                  <div style={{ color: '#888', fontSize: 12, margin: '4px 0 8px' }}>
                    {r.category} · {new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                  <div style={{ color: '#bbb', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{r.message}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
