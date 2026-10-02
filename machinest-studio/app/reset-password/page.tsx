'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)
  const supabase = createClient()
  const router = useRouter()

useEffect(() => {
  async function init() {
    const url = new URL(window.location.href)
    const code = url.searchParams.get('code')

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) {
        setError('This reset link is invalid or has expired. Please request a new one.')
        return
      }
      setReady(true)
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      setReady(true)
    } else {
      setError('This reset link is invalid or has expired. Please request a new one.')
    }
  }
  init()
}, [])

  async function handleSubmit() {
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
        <h2 style={{ color: '#fff', fontSize: 22, margin: '0 0 6px' }}>Set a new password</h2>

    {!ready ? (
  error ? (
    <p style={{ color: '#ff6b6b', fontSize: 14 }}>{error}</p>
  ) : (
    <p style={{ color: '#999', fontSize: 14 }}>Verifying your reset link...</p>
  )
) : done ? (
          <p style={{ color: '#2fbf71', fontSize: 14 }}>Password updated! Redirecting to login...</p>
        ) : (
          <>
            <label style={{ display: 'block', fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600 }}>New Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '11px 13px', fontSize: 14, marginBottom: 16 }}
            />
            <label style={{ display: 'block', fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600 }}>Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              style={{ width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '11px 13px', fontSize: 14, marginBottom: 16 }}
            />
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{ width: '100%', background: '#F0801E', color: '#fff', border: 'none', borderRadius: 6, padding: 13, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
            >
              {loading ? 'Saving...' : 'Update Password'}
            </button>
            {error && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 12 }}>{error}</p>}
          </>
        )}
      </div>
    </div>
  )
}