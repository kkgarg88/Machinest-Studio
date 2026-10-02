'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const supabase = createClient()

  async function handleSubmit() {
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setSent(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#211f1d', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 380, background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 32 }}>
        <h2 style={{ color: '#fff', fontSize: 22, margin: '0 0 6px' }}>Reset your password</h2>
        <p style={{ color: '#999', fontSize: 13, marginBottom: 24 }}>Enter your email and we'll send you a reset link.</p>

        {sent ? (
          <p style={{ color: '#2fbf71', fontSize: 14 }}>Check your email for a password reset link.</p>
        ) : (
          <>
            <label style={{ display: 'block', fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600 }}>Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '11px 13px', fontSize: 14, marginBottom: 16 }}
              placeholder="you@example.com"
            />
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{ width: '100%', background: '#F0801E', color: '#fff', border: 'none', borderRadius: 6, padding: 13, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
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