'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [verified, setVerified] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const inputStyle = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '11px 13px', fontSize: 14, marginBottom: 16 }
  const labelStyle = { display: 'block', fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600 }

  async function sendCode() {
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    setLoading(false)
    if (error) { setError(error.message); return }
    setStep('otp')
  }

  async function verifyCode() {
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'recovery' })
    setLoading(false)
    if (error) { setError('Invalid or expired code. Please try again.'); return }
    setVerified(true)
  }

  async function updatePassword() {
    setError('')
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => router.push('/'), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#211f1d', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 32 }}>
        {done ? (
          <>
            <h2 style={{ color: '#fff', fontSize: 22, margin: '0 0 6px' }}>Password updated</h2>
            <p style={{ color: '#2fbf71', fontSize: 14 }}>Redirecting to login...</p>
          </>
        ) : verified ? (
          <>
            <h2 style={{ color: '#fff', fontSize: 22, margin: '0 0 6px' }}>Set a new password</h2>
            <p style={{ color: '#999', fontSize: 13, marginBottom: 24 }}>Choose a new password for your account.</p>
            <label style={labelStyle}>New Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} />
            <label style={labelStyle}>Confirm Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} style={inputStyle} />
            <button onClick={updatePassword} disabled={loading} style={{ width: '100%', background: '#F0801E', color: '#fff', border: 'none', borderRadius: 6, padding: 13, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              {loading ? 'Saving...' : 'Update Password'}
            </button>
            {error && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 12 }}>{error}</p>}
          </>
        ) : step === 'email' ? (
          <>
            <h2 style={{ color: '#fff', fontSize: 22, margin: '0 0 6px' }}>Reset your password</h2>
            <p style={{ color: '#999', fontSize: 13, marginBottom: 24 }}>Enter your email and we'll send you a 6-digit code.</p>
            <label style={labelStyle}>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} placeholder="you@example.com" />
            <button onClick={sendCode} disabled={loading} style={{ width: '100%', background: '#F0801E', color: '#fff', border: 'none', borderRadius: 6, padding: 13, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              {loading ? 'Sending...' : 'Send Code'}
            </button>
            {error && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 12 }}>{error}</p>}
          </>
        ) : (
          <>
            <h2 style={{ color: '#fff', fontSize: 22, margin: '0 0 6px' }}>Enter the code</h2>
            <p style={{ color: '#999', fontSize: 13, marginBottom: 24 }}>Check your email for the 6-digit code we sent to {email}.</p>
            <label style={labelStyle}>Code</label>
            <input type="text" value={otp} onChange={e => setOtp(e.target.value)} style={inputStyle} placeholder="123456" />
            <button onClick={verifyCode} disabled={loading} style={{ width: '100%', background: '#F0801E', color: '#fff', border: 'none', borderRadius: 6, padding: 13, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              {loading ? 'Verifying...' : 'Verify Code'}
            </button>
            {error && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 12 }}>{error}</p>}
          </>
        )}

        <p style={{ textAlign: 'center', fontSize: 12, color: '#888', marginTop: 20 }}>
          <a href="/" style={{ color: '#F0801E' }}>Back to login</a>
        </p>
      </div>
    </div>
  )
}