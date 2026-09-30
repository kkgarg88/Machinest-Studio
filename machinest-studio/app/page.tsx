'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()
  const [info, setInfo] = useState('')
useEffect(() => {
  async function checkSession() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
    router.push(profile ? '/dashboard' : '/onboarding')
  }
  checkSession()
}, [])
 async function handleSubmit() {
  setLoading(true)
  setError('')
  setInfo('')

  if (isSignUp) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    setLoading(false)
    if (error) { setError(error.message); return }
    if (!data.session) {
      setInfo('Account created. Please check your email and click the verification link, then log in.')
      setIsSignUp(false)
      return
    }
    router.push('/onboarding')
    return
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  setLoading(false)
  if (error) { setError(error.message); return }
  router.push('/dashboard')
}

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', minHeight: '100vh', fontFamily: 'Segoe UI, sans-serif' }}>
      {/* Left brand panel */}
      <div style={{
        flex: '1 1 480px',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '48px 40px',
        color: '#fff',
        background: 'radial-gradient(ellipse at 25% 30%, rgba(240,128,30,0.20), transparent 55%), linear-gradient(140deg,#1c1b19 0%,#2c2a27 50%,#3a3733 100%)'
      }}>
        <div style={{ maxWidth: 480, margin: '0 auto', width: '100%' }}>
          <div style={{ marginBottom: 30 }}>
            <img
              src="/logo.png"
              alt="Machinest Studio"
              style={{
                height: 220,
                width: 'auto',
                display: 'block',
                filter: 'drop-shadow(0 0 14px rgba(255,255,255,0.35))'
              }}
            />
          </div>

          <h1 style={{ fontSize: 'clamp(24px,4vw,30px)', lineHeight: 1.25, fontWeight: 800, margin: '0 0 16px' }}>
            One platform to run your <span style={{ color: '#F0801E' }}>entire CNC shop.</span>
          </h1>
          <p style={{ color: '#bbb', fontSize: 14.5, lineHeight: 1.6, marginBottom: 26 }}>
            From instant G-code generation to shop-floor tracking — Machinest Studio brings every tool a machinist needs into one place, built by a 15+ year CNC operator.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
            {['Turning Studio', 'Milling Studio', 'Calibration Tracker', 'Maintenance Tracker', 'KPI Dashboard'].map(tag => (
              <span key={tag} style={{ background: '#2a2723', border: '1px solid #3a3733', color: '#ddd', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 20 }}>{tag}</span>
            ))}
            <span style={{ color: '#F0801E', border: '1px solid #F0801E', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 20 }}>+ more tools coming</span>
          </div>

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 13 }}>
            {['No programming experience needed', 'Video tutorials for every tool', 'Pay only for the tools you actually use'].map(f => (
              <li key={f} style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, color: '#ddd' }}>
                <span style={{ color: '#F0801E' }}>⚙</span>{f}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Right auth panel */}
      <div style={{ flex: '1 1 360px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#211f1d', padding: '40px 24px' }}>
        <div style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ display: 'flex', background: '#2b2a28', borderRadius: 8, padding: 4, marginBottom: 28 }}>
            <div onClick={() => setIsSignUp(false)} style={{ flex: 1, textAlign: 'center', padding: 9, fontSize: 13, fontWeight: 700, borderRadius: 6, cursor: 'pointer', color: !isSignUp ? '#fff' : '#999', background: !isSignUp ? '#F0801E' : 'transparent' }}>Login</div>
            <div onClick={() => setIsSignUp(true)} style={{ flex: 1, textAlign: 'center', padding: 9, fontSize: 13, fontWeight: 700, borderRadius: 6, cursor: 'pointer', color: isSignUp ? '#fff' : '#999', background: isSignUp ? '#F0801E' : 'transparent' }}>Sign Up</div>
          </div>
          <h2 style={{ fontSize: 22, margin: '0 0 6px', color: '#fff' }}>{isSignUp ? 'Create your account' : 'Welcome back'}</h2>
          <div style={{ color: '#999', fontSize: 13, marginBottom: 26 }}>{isSignUp ? 'Sign up to get started' : 'Login to access your tools'}</div>

          <label style={{ display: 'block', fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600 }}>Email Address</label>
         <input type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '12px 14px', fontSize: 14, marginBottom: 16 }} />
          <label style={{ display: 'block', fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600 }}>Password</label>
          <input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} style={{ width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '12px 14px', fontSize: 14, marginBottom: 16 }} />
          {!isSignUp && <div style={{ textAlign: 'right', fontSize: 12, color: '#999', margin: '-8px 0 20px', cursor: 'pointer' }}>Forgot password?</div>}
<button onClick={handleSubmit} disabled={loading} style={{ width: '100%', background: '#F0801E', color: '#fff', border: 'none', borderRadius: 6, padding: 13, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
  {loading ? 'Please wait...' : isSignUp ? 'Sign Up' : 'Login'}
</button>
{error && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 12 }}>{error}</p>}
{info && <p style={{ color: '#2fbf71', fontSize: 13, marginTop: 12 }}>{info}</p>}

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#666', fontSize: 12, margin: '22px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#3a3733' }}></div>OR<div style={{ flex: 1, height: 1, background: '#3a3733' }}></div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 12, color: '#888', marginTop: 18 }}>
            {isSignUp ? 'Already have an account? ' : 'New to Machinest Studio? '}
            <div style={{ textAlign: 'center', fontSize: 11, color: '#666', marginTop: 24 }}>
  <a href="/terms" style={{ color: '#888', marginRight: 12 }}>Terms</a>
  <a href="/privacy" style={{ color: '#888', marginRight: 12 }}>Privacy</a>
  <a href="/refund" style={{ color: '#888' }}>Refund Policy</a>
</div>
            <span onClick={() => setIsSignUp(!isSignUp)} style={{ color: '#F0801E', cursor: 'pointer', fontWeight: 600 }}>
              {isSignUp ? 'Login' : 'Create an account'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}