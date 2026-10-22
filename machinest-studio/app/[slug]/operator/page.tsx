'use client'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import MachineCard, { type CardMachine } from '@/components/machine-status/MachineCard'
import StatusModal from '@/components/machine-status/StatusModal'

type View =
  | { state: 'loading' }
  | { state: 'not_found' }
  | { state: 'login'; shopName: string; logoUrl: string | null; operators: { id: string; name: string }[] }
  | { state: 'ok'; shopName: string; logoUrl: string | null; operatorName: string; active: boolean; machines: CardMachine[] }

const page = { minHeight: '100vh', background: 'linear-gradient(180deg, #262421 0%, #302d29 100%)', fontFamily: 'Segoe UI, sans-serif', color: '#fff' } as const
const inputStyle = { background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 8, color: '#fff', padding: '12px', fontSize: 15, width: '100%', boxSizing: 'border-box' } as const

function Logo({ url, size }: { url: string | null; size: number }) {
  if (!url) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" style={{ width: size, height: size, objectFit: 'contain', background: '#fff', borderRadius: 10, padding: 3, boxSizing: 'border-box' }} />
}

export default function OperatorPage() {
  const params = useParams<{ slug: string }>()
  const slug = String(params?.slug || '').toLowerCase()

  const [view, setView] = useState<View>({ state: 'loading' })
  const [operatorId, setOperatorId] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState<CardMachine | null>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const flash = useCallback((text: string, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3500)
  }, [])

  const load = useCallback(async () => {
    const res = await fetch(`/api/machine-status/operator/${encodeURIComponent(slug)}`, { cache: 'no-store' }).catch(() => null)
    if (!res) return
    const data = await res.json().catch(() => null)
    if (!data) return
    if (res.status === 404) setView({ state: 'not_found' })
    else setView(data as View)
  }, [slug])

  useEffect(() => {
    load()
    const poll = setInterval(load, 6000)
    return () => clearInterval(poll)
  }, [load])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    const res = await fetch(`/api/machine-status/operator/${encodeURIComponent(slug)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operatorId, pin }),
    }).catch(() => null)
    setBusy(false)
    if (!res) { setError('Network error. Please try again'); return }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setError(data.error || 'Could not log in'); return }
    setPin('')
    load()
  }

  async function logout() {
    await fetch(`/api/machine-status/operator/${encodeURIComponent(slug)}`, { method: 'DELETE' }).catch(() => null)
    setSelected(null)
    load()
  }

  if (view.state === 'loading') {
    return <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>
  }

  if (view.state === 'not_found') {
    return (
      <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔍</div>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>This link is not available</h1>
          <p style={{ color: '#999', fontSize: 14, margin: 0 }}>Please check the link with your shop owner.</p>
        </div>
      </div>
    )
  }

  if (view.state === 'login') {
    return (
      <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <form onSubmit={login} style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 14, padding: 28, width: '100%', maxWidth: 360, textAlign: 'center' }}>
          {view.logoUrl ? <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Logo url={view.logoUrl} size={72} /></div> : <div style={{ fontSize: 38, marginBottom: 10 }}>📟</div>}
          <h1 style={{ fontSize: 20, margin: '0 0 4px' }}>{view.shopName}</h1>
          <p style={{ color: '#999', fontSize: 13, margin: '0 0 18px' }}>Operator login</p>

          {view.operators.length === 0 ? (
            <p style={{ color: '#e0b13a', fontSize: 13.5, margin: 0 }}>No operators have been added yet. Ask your shop owner to add you.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <select value={operatorId} onChange={e => setOperatorId(e.target.value)} style={inputStyle} required>
                <option value="">Select your name</option>
                {view.operators.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              <input
                type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} placeholder="Your PIN"
                onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
                style={{ ...inputStyle, fontSize: 22, letterSpacing: 8, textAlign: 'center' }}
              />
              {error && <div style={{ color: '#ff6b6b', fontSize: 13 }}>{error}</div>}
              <button
                type="submit"
                disabled={busy || !operatorId || pin.length < 4}
                style={{ background: '#F0801E', color: '#fff', border: 'none', borderRadius: 999, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: busy || !operatorId || pin.length < 4 ? 0.5 : 1 }}
              >
                {busy ? 'Checking...' : 'Log in'}
              </button>
            </div>
          )}
        </form>
      </div>
    )
  }

  return (
    <div style={{ ...page, padding: '20px 14px' }}>
      {msg && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 50, background: msg.ok ? '#1f2e22' : '#3a2222', border: `1px solid ${msg.ok ? '#2fbf71' : '#ff6b6b'}`, color: msg.ok ? '#2fbf71' : '#ff6b6b', borderRadius: 8, padding: '10px 18px', fontSize: 14 }}>
          {msg.text}
        </div>
      )}
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Logo url={view.logoUrl} size={44} />
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{view.shopName}</h1>
              <div style={{ color: '#999', fontSize: 12.5, marginTop: 2 }}>Logged in as {view.operatorName}</div>
            </div>
          </div>
          <button onClick={logout} style={{ background: 'transparent', border: '1px solid #3a3733', color: '#ddd', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Log out</button>
        </div>

        {!view.active && (
          <div style={{ background: '#3a2f1a', border: '1px solid #e0b13a', color: '#e0b13a', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 14 }}>
            The shop&apos;s subscription has expired. You can view machines but cannot update status.
          </div>
        )}

        {view.machines.length === 0 ? (
          <p style={{ color: '#999' }}>The owner has not added any machines yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(136px, 1fr))', gap: 12 }}>
            {view.machines.map(m => <MachineCard key={m.id} machine={m} onClick={() => setSelected(m)} />)}
          </div>
        )}
      </div>

      {selected && (
        <StatusModal
          key={selected.id}
          machine={selected}
          canEdit={view.active}
          onClose={() => setSelected(null)}
          onDone={text => { setSelected(null); flash(text); load() }}
          onError={text => flash(text, false)}
        />
      )}
    </div>
  )
}
