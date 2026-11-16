'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Funnel = {
  signups: number
  signups_7d: number
  generated: number
  machine_added: number
  paid: number
  sources: { source: string; count: number }[]
}

const SOURCE_LABEL: Record<string, string> = {
  google: 'Google search', youtube: 'YouTube', linkedin: 'LinkedIn', whatsapp: 'WhatsApp',
  facebook: 'Facebook', instagram: 'Instagram', friend: 'Friend or colleague', other: 'Other',
}

const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 20, marginBottom: 18 } as const

export default function InsightsPage() {
  const router = useRouter()
  const [data, setData] = useState<Funnel | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/admin/insights', { cache: 'no-store' })
      .then(async res => {
        const body = await res.json().catch(() => ({}))
        if (!res.ok) { setError(body.error || 'Could not load'); return }
        setData(body as Funnel)
      })
      .catch(() => setError('Network error'))
  }, [])

  const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : '0%')

  const steps = data ? [
    { label: 'Signed up', n: data.signups },
    { label: 'Generated a cycle', n: data.generated },
    { label: 'Added a machine (Machine Status)', n: data.machine_added },
    { label: 'Paid', n: data.paid },
  ] : []

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #262421 0%, #302d29 100%)', fontFamily: 'Segoe UI, sans-serif', padding: '24px 16px', color: '#fff' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>📈 Growth insights</h1>
          <button onClick={() => router.push('/admin')} style={{ background: 'transparent', border: '1px solid #3a3733', color: '#ddd', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>&larr; Admin</button>
        </div>

        {error && <div style={{ background: '#3a2222', border: '1px solid #ff6b6b', color: '#ff8a8a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13.5 }}>{error}</div>}
        {!data && !error && <p style={{ color: '#999' }}>Loading...</p>}

        {data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 18 }}>
              <div style={{ background: '#33312e', borderRadius: 10, padding: 14 }}><div style={{ fontSize: 28, fontWeight: 800 }}>{data.signups}</div><div style={{ color: '#999', fontSize: 12 }}>Total signups</div></div>
              <div style={{ background: '#33312e', borderRadius: 10, padding: 14 }}><div style={{ fontSize: 28, fontWeight: 800, color: '#2fbf71' }}>{data.signups_7d}</div><div style={{ color: '#999', fontSize: 12 }}>Signups in the last 7 days</div></div>
              <div style={{ background: '#33312e', borderRadius: 10, padding: 14 }}><div style={{ fontSize: 28, fontWeight: 800, color: '#F0801E' }}>{data.paid}</div><div style={{ color: '#999', fontSize: 12 }}>Paying users</div></div>
            </div>

            <div style={card}>
              <b>From signup to paying</b>
              <div style={{ color: '#999', fontSize: 12.5, margin: '4px 0 12px' }}>Each bar is a share of everyone who signed up. Tracking of cycles and machines starts from the day this was installed.</div>
              {steps.map(s => (
                <div key={s.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, 240px) 1fr 90px', gap: 12, alignItems: 'center', margin: '10px 0', fontSize: 13.5 }}>
                  <span>{s.label}</span>
                  <div style={{ height: 18, borderRadius: 5, background: '#1c1b19', overflow: 'hidden' }}>
                    <i style={{ display: 'block', height: '100%', width: `${data.signups > 0 ? Math.min(100, (s.n / data.signups) * 100) : 0}%`, background: '#F0801E' }} />
                  </div>
                  <b style={{ textAlign: 'right' }}>{s.n} <span style={{ color: '#999', fontWeight: 400 }}>({pct(s.n, data.signups)})</span></b>
                </div>
              ))}
            </div>

            <div style={card}>
              <b>Where people heard about Machinest</b>
              <div style={{ color: '#999', fontSize: 12.5, margin: '4px 0 8px' }}>From the optional question at signup. Older users did not see it.</div>
              {data.sources.length === 0 && <p style={{ color: '#999', fontSize: 13.5 }}>No data yet.</p>}
              {data.sources.map(s => (
                <div key={s.source} style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #3a3733', padding: '9px 0', fontSize: 13.5 }}>
                  <span>{SOURCE_LABEL[s.source] || s.source}</span><b>{s.count}</b>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
