'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const inputStyle = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '11px 12px', fontSize: 14 } as const
const labelStyle = { display: 'block', fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600 } as const

const SERVICES = [
  { icon: '⚙️', title: 'CNC Programming', text: 'Programs for your parts on Fanuc-style controls, ready to run on your machine.' },
  { icon: '🧠', title: 'Technical Consulting', text: 'Talk through a machining problem with someone who has run these machines for years.' },
  { icon: '🏭', title: 'Machine Shop Optimization', text: 'Better flow, fewer stoppages and less waiting across your shop floor.' },
  { icon: '⏱️', title: 'Process & Product Optimization', text: 'Shorter cycle times and steadier quality on parts you already make.' },
  { icon: '📦', title: 'On-demand Manufacturing', text: 'Need parts made? Share the requirement and we will take it forward.' },
  { icon: '💻', title: 'Custom Software / Tools', text: 'Calculators, job cards, trackers and other tools built around how your shop works.' },
]

const OPTIONS = [
  'CNC Programming',
  'Technical Consulting',
  'Machine Shop Optimization',
  'Process & Product Optimization',
  'On-demand Manufacturing',
  'Custom Software / Tools',
  'Other',
]

const STEPS = [
  { n: '1', title: 'Tell us what you need', text: 'Fill the short form below.' },
  { n: '2', title: 'We get back to you', text: 'We call or message you to understand the requirement.' },
  { n: '3', title: 'You get a quote', text: 'Pricing is decided per project, once we know the scope.' },
]

export default function ServicesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loggedIn, setLoggedIn] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [service, setService] = useState(OPTIONS[0])
  const [message, setMessage] = useState('')
  const [website, setWebsite] = useState('') // honeypot, stays empty for real users
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function prefill() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setLoggedIn(true)
      setEmail(user.email || '')
      const { data: profile } = await supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle()
      if (profile?.full_name) setName(profile.full_name)
      if (profile?.phone) setPhone(profile.phone)
    }
    prefill()
  }, [])

  async function submit() {
    setError('')
    if (name.trim().length < 2) { setError('Please enter your name.'); return }
    if (phone.replace(/\D/g, '').length < 7) { setError('Please enter a valid phone number.'); return }
    if (message.trim().length < 10) { setError('Please describe what you need in a few words.'); return }

    setBusy(true)
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, service_type: service, message, website }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(data.error || 'Something went wrong. Please try again.'); return }
    setDone(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #211f1d 0%, #2a2724 100%)', fontFamily: 'Segoe UI, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 32px', background: '#211f1d', borderBottom: '2px solid #F0801E' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo-icon.png" alt="Machinest Studio" style={{ height: 40, width: 'auto' }} />
          <span style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>Machinest <span style={{ color: '#F0801E' }}>Studio</span></span>
        </div>
        <button
          onClick={() => router.push(loggedIn ? '/dashboard' : '/')}
          style={{ background: '#F0801E', color: '#fff', border: 'none', borderRadius: 999, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
        >
          {loggedIn ? '← Dashboard' : 'Login'}
        </button>
      </header>

      <div style={{ padding: '48px 24px', maxWidth: 1000, margin: '0 auto' }}>
        {/* HERO */}
        <div style={{ textAlign: 'center', marginBottom: 44 }}>
          <span style={{ display: 'inline-block', background: 'rgba(240,128,30,0.15)', color: '#F0801E', fontSize: 11, fontWeight: 800, letterSpacing: 1, padding: '5px 14px', borderRadius: 999, marginBottom: 16 }}>
            CUSTOM SERVICES
          </span>
          <h1 style={{ color: '#fff', fontSize: 34, fontWeight: 800, margin: '0 0 12px', lineHeight: 1.25 }}>
            Need something built <span style={{ color: '#F0801E' }}>just for your shop?</span>
          </h1>
          <p style={{ color: '#aaa', fontSize: 16, lineHeight: 1.6, maxWidth: 640, margin: '0 auto' }}>
            Beyond the cycle generators, we take on custom CNC work, optimization and tools made for your own machines and parts.
            Built by a CNC professional with 15+ years on the shop floor.
          </p>
        </div>

        {/* SERVICES */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 18, marginBottom: 48 }}>
          {SERVICES.map(s => (
            <div key={s.title} style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 14, padding: 22 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, background: 'rgba(240,128,30,0.15)', marginBottom: 14 }}>
                {s.icon}
              </div>
              <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 700, margin: '0 0 6px' }}>{s.title}</h3>
              <p style={{ color: '#999', fontSize: 13.5, lineHeight: 1.55, margin: 0 }}>{s.text}</p>
            </div>
          ))}
        </div>

        {/* HOW IT WORKS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18, marginBottom: 48 }}>
          {STEPS.map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ flexShrink: 0, width: 34, height: 34, borderRadius: '50%', background: '#F0801E', color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {s.n}
              </div>
              <div>
                <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{s.title}</div>
                <div style={{ color: '#999', fontSize: 13.5, marginTop: 2, lineHeight: 1.5 }}>{s.text}</div>
              </div>
            </div>
          ))}
        </div>

        {/* FORM */}
        <div id="request" style={{ background: '#2b2a28', border: '1px solid rgba(240,128,30,0.5)', borderRadius: 16, padding: 30, maxWidth: 640, margin: '0 auto', boxShadow: '0 10px 40px rgba(240,128,30,0.1)' }}>
          {done ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 44, marginBottom: 10 }}>✅</div>
              <h2 style={{ color: '#fff', fontSize: 22, margin: '0 0 8px' }}>Request received</h2>
              <p style={{ color: '#aaa', fontSize: 14.5, lineHeight: 1.6, margin: '0 0 22px' }}>
                Thank you. We will contact you on the phone number you gave us.
              </p>
              <button
                onClick={() => router.push(loggedIn ? '/dashboard' : '/')}
                style={{ background: '#F0801E', color: '#fff', border: 'none', borderRadius: 6, padding: '11px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
              >
                {loggedIn ? 'Back to dashboard' : 'Back to home'}
              </button>
            </div>
          ) : (
            <>
              <h2 style={{ color: '#fff', fontSize: 22, margin: '0 0 6px' }}>Request a custom solution</h2>
              <p style={{ color: '#999', fontSize: 13.5, margin: '0 0 22px' }}>No payment now. Pricing is agreed per project after we understand your requirement.</p>

              {/* Honeypot: hidden from people, bots tend to fill it */}
              <div style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }} aria-hidden="true">
                <label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Your name</label>
                  <input style={inputStyle} value={name} maxLength={80} onChange={e => setName(e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Phone number</label>
                  <input style={inputStyle} value={phone} maxLength={20} onChange={e => setPhone(e.target.value)} placeholder="+91 ..." />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Email (optional)</label>
                <input style={inputStyle} type="email" value={email} maxLength={120} onChange={e => setEmail(e.target.value)} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>What do you need?</label>
                <select style={inputStyle} value={service} onChange={e => setService(e.target.value)}>
                  {OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 18 }}>
                <label style={labelStyle}>Tell us about it</label>
                <textarea
                  style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
                  rows={5}
                  maxLength={2000}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Part or problem, machine and controller, quantity, any deadline..."
                />
              </div>

              {error && <p style={{ color: '#ff6b6b', fontSize: 13.5, margin: '0 0 14px' }}>{error}</p>}

              <button
                onClick={submit}
                disabled={busy}
                style={{ width: '100%', background: '#F0801E', color: '#fff', border: 'none', borderRadius: 8, padding: 14, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
              >
                {busy ? 'Sending...' : 'Send request'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
