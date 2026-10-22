'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { STATUSES } from '@/lib/machineStatus'
import MachineCard, { type CardMachine } from '@/components/machine-status/MachineCard'

type View =
  | { state: 'loading' }
  | { state: 'not_found' }
  | { state: 'expired'; shopName: string; logoUrl: string | null }
  | { state: 'locked'; shopName: string; logoUrl: string | null }
  | { state: 'ok'; shopName: string; logoUrl: string | null; machines: CardMachine[] }

const page = { minHeight: '100vh', background: 'linear-gradient(180deg, #262421 0%, #302d29 100%)', fontFamily: 'Segoe UI, sans-serif', color: '#fff' } as const

function Logo({ url, size }: { url: string | null; size: number }) {
  if (!url) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" style={{ width: size, height: size, objectFit: 'contain', background: '#fff', borderRadius: 10, padding: 3, boxSizing: 'border-box' }} />
}

// Live date and time (Indian time), ticking every second
function Clock({ big }: { big: boolean }) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!now) return <div style={{ height: big ? 30 : 22 }} />
  const date = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now)
  const time = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).format(now).toUpperCase()
  return (
    <div style={{ color: '#ddd', fontSize: big ? 22 : 15, fontWeight: 600, marginTop: 6 }}>
      {date} <span style={{ color: '#666', margin: '0 6px' }}>|</span> <span style={{ fontVariantNumeric: 'tabular-nums' }}>{time}</span>
    </div>
  )
}

export default function PublicShopBoard() {
  const params = useParams<{ slug: string }>()
  const slug = String(params?.slug || '').toLowerCase()

  const [view, setView] = useState<View>({ state: 'loading' })
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [busy, setBusy] = useState(false)
  const [tv, setTv] = useState(false)
  const boardRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/machine-status/public/${encodeURIComponent(slug)}`, { cache: 'no-store' }).catch(() => null)
    if (!res) return
    const data = await res.json().catch(() => null)
    if (!data) return
    if (res.status === 404) setView({ state: 'not_found' })
    else setView(data as View)
  }, [slug])

  useEffect(() => {
    load()
    const poll = setInterval(load, 5000)
    return () => clearInterval(poll)
  }, [load])

  useEffect(() => {
    const onChange = () => setTv(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  async function submitPin(e: React.FormEvent) {
    e.preventDefault()
    setPinError('')
    setBusy(true)
    const res = await fetch(`/api/machine-status/public/${encodeURIComponent(slug)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }),
    }).catch(() => null)
    setBusy(false)
    if (!res) { setPinError('Network error. Please try again'); return }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { setPinError(data.error || 'Wrong PIN'); return }
    setPin('')
    load()
  }

  function toggleTv() {
    if (document.fullscreenElement) document.exitFullscreen()
    else boardRef.current?.requestFullscreen?.().catch(() => {})
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
          <p style={{ color: '#999', fontSize: 14, margin: 0 }}>Please check the link with the shop owner.</p>
        </div>
      </div>
    )
  }

  if (view.state === 'expired') {
    return (
      <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, textAlign: 'center' }}>
        <div>
          {view.logoUrl ? <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Logo url={view.logoUrl} size={72} /></div> : <div style={{ fontSize: 44, marginBottom: 12 }}>⏸️</div>}
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>{view.shopName}</h1>
          <p style={{ color: '#999', fontSize: 14, margin: 0 }}>Subscription expired. This status board is paused until the owner renews.</p>
        </div>
      </div>
    )
  }

  if (view.state === 'locked') {
    return (
      <div style={{ ...page, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <form onSubmit={submitPin} style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 14, padding: 28, width: '100%', maxWidth: 340, textAlign: 'center' }}>
          {view.logoUrl ? <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Logo url={view.logoUrl} size={72} /></div> : <div style={{ fontSize: 38, marginBottom: 10 }}>🔒</div>}
          <h1 style={{ fontSize: 20, margin: '0 0 6px' }}>{view.shopName}</h1>
          <p style={{ color: '#999', fontSize: 13, margin: '0 0 18px' }}>Enter the PIN to view live machine status</p>
          <input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
            placeholder="PIN"
            autoFocus
            style={{ width: '100%', boxSizing: 'border-box', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 8, color: '#fff', padding: '12px', fontSize: 22, letterSpacing: 8, textAlign: 'center' }}
          />
          {pinError && <div style={{ color: '#ff6b6b', fontSize: 13, marginTop: 10 }}>{pinError}</div>}
          <button
            type="submit"
            disabled={busy || pin.length < 4}
            style={{ marginTop: 16, width: '100%', background: '#F0801E', color: '#fff', border: 'none', borderRadius: 999, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: busy || pin.length < 4 ? 0.5 : 1 }}
          >
            {busy ? 'Checking...' : 'View status'}
          </button>
        </form>
      </div>
    )
  }

  const machines = view.machines
  const counts = STATUSES.map(s => ({ ...s, n: machines.filter(m => m.status === s.key).length })).filter(s => s.n > 0)

  return (
    <div ref={boardRef} style={{ ...page, padding: tv ? '20px 24px' : '24px 16px', overflowY: 'auto' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <h2 style={{ fontSize: tv ? 36 : 24, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase', margin: 0, color: '#F0801E' }}>
            Machine Status Board
          </h2>
          <Clock big={tv} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Logo url={view.logoUrl} size={tv ? 60 : 48} />
            <div>
              <h1 style={{ fontSize: tv ? 30 : 22, fontWeight: 800, margin: 0 }}>{view.shopName}</h1>
              <div style={{ color: '#999', fontSize: 12.5, marginTop: 3 }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: '#2fbf71', marginRight: 6 }} />
                Live · {machines.length} machine{machines.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>
          <button onClick={toggleTv} style={{ background: 'transparent', border: '1px solid #3a3733', color: '#ddd', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {tv ? 'Exit full screen' : '📺 Full screen'}
          </button>
        </div>

        {counts.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
            {counts.map(c => (
              <span key={c.key} style={{ background: '#2b2a28', border: `1px solid ${c.color}`, color: '#fff', borderRadius: 999, padding: '5px 13px', fontSize: 12.5, fontWeight: 600 }}>
                <span style={{ color: c.color }}>●</span> {c.label}: {c.n}
              </span>
            ))}
          </div>
        )}

        {machines.length === 0 ? (
          <p style={{ color: '#999' }}>No machines have been added yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, minmax(${tv ? 260 : 136}px, 1fr))`, gap: 12 }}>
            {machines.map(m => <MachineCard key={m.id} machine={m} tv={tv} />)}
          </div>
        )}
      </div>
    </div>
  )
}
