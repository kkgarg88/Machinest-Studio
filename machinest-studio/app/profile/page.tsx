'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 28 } as const
const inputStyle = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '11px 13px', fontSize: 14, marginBottom: 16 } as const
const labelStyle = { display: 'block', fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600 } as const

export default function ProfilePage() {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [machineType, setMachineType] = useState('CNC Turning')
  const [experience, setExperience] = useState('')
  const [activeTools, setActiveTools] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setEmail(user.email || '')

      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      if (p) {
        setFullName(p.full_name || '')
        setCompanyName(p.company_name || '')
        setPhone(p.phone || '')
        setMachineType(p.machine_type || 'CNC Turning')
        setExperience(p.experience_years || '')
      }

      const { data: subs } = await supabase
        .from('subscriptions')
        .select('tools(name)')
        .eq('user_id', user.id)
        .eq('status', 'active')
      const names = (subs || []).map((s: any) => (Array.isArray(s.tools) ? s.tools[0]?.name : s.tools?.name)).filter(Boolean)
      setActiveTools(names)
      setLoading(false)
    }
    load()
  }, [])

  async function save() {
    setError('')
    setSaved(false)

    if (!fullName.trim() || !companyName.trim() || !phone.trim() || !experience.trim()) {
      setError('Please fill in all fields.')
      return
    }
    const cleanPhone = phone.replace(/\D/g, '').slice(-10)
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError('Please enter a valid 10-digit mobile number.')
      return
    }
    const exp = Number(experience)
    if (!Number.isFinite(exp) || exp < 0 || exp > 60) {
      setError('Experience must be between 0 and 60 years.')
      return
    }

    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: fullName.trim(),
      company_name: companyName.trim(),
      phone: cleanPhone,
      machine_type: machineType,
      experience_years: String(exp),
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setPhone(cleanPhone)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
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
          ← Dashboard
        </button>
      </header>

      <div style={{ padding: '40px 24px', maxWidth: 560, margin: '0 auto' }}>
        <h2 style={{ color: '#fff', fontSize: 26, margin: '0 0 22px', fontWeight: 800 }}>My Profile</h2>

        <div style={card}>
          <label style={labelStyle}>Email</label>
          <input type="text" value={email} disabled style={{ ...inputStyle, opacity: 0.6, cursor: 'not-allowed' }} />

          <label style={labelStyle}>Full Name</label>
          <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} />

          <label style={labelStyle}>Company / Workshop Name</label>
          <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} style={inputStyle} />

          <label style={labelStyle}>Phone Number</label>
          <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} placeholder="10-digit mobile number" />

          <label style={labelStyle}>Machine Type</label>
          <select value={machineType} onChange={e => setMachineType(e.target.value)} style={inputStyle}>
            <option>CNC Turning</option>
            <option>VMC</option>
            <option>Sliding Head CNC</option>
            <option>Other</option>
          </select>

          <label style={labelStyle}>Years of Experience</label>
          <input type="number" value={experience} onChange={e => setExperience(e.target.value)} style={inputStyle} />

          <button onClick={save} disabled={saving} style={{ width: '100%', background: '#F0801E', color: '#fff', border: 'none', borderRadius: 6, padding: 13, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          {error && <p style={{ color: '#ff6b6b', fontSize: 13, margin: '12px 0 0' }}>{error}</p>}
          {saved && <p style={{ color: '#2fbf71', fontSize: 13, margin: '12px 0 0' }}>✓ Profile updated</p>}
        </div>

        <div style={{ ...card, marginTop: 20 }}>
          <div style={{ color: '#ccc', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Your active tools</div>
          {activeTools.length === 0 ? (
            <p style={{ color: '#777', fontSize: 13, margin: 0 }}>No active tools yet.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {activeTools.map(n => (
                <span key={n} style={{ background: 'rgba(240,128,30,0.15)', border: '1px solid rgba(240,128,30,0.5)', color: '#F0801E', fontSize: 12, fontWeight: 700, padding: '5px 12px', borderRadius: 999 }}>{n}</span>
              ))}
            </div>
          )}
          <button onClick={() => router.push('/membership')} style={{ marginTop: 16, background: 'transparent', border: '1px solid #3a3733', color: '#ddd', borderRadius: 6, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Manage tools
          </button>
        </div>
      </div>
    </div>
  )
}