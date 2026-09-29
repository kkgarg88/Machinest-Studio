'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function OnboardingPage() {
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [phone, setPhone] = useState('')
  const [machineType, setMachineType] = useState('CNC Turning')
  const [experience, setExperience] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  async function handleSubmit() {
    setError('')

    if (!fullName.trim() || !companyName.trim() || !phone.trim() || !experience.trim()) {
      setError('Please fill in all fields.')
      return
    }

    const phoneRegex = /^[6-9]\d{9}$/
    const cleanPhone = phone.replace(/\D/g, '').slice(-10)
    if (!phoneRegex.test(cleanPhone)) {
      setError('Please enter a valid 10-digit mobile number.')
      return
    }

    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: fullName,
      company_name: companyName,
      phone: cleanPhone,
      machine_type: machineType,
      experience_years: experience,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    router.push('/membership')
  }

  const inputStyle = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '12px 14px', fontSize: 14, marginBottom: 16 }
  const labelStyle = { display: 'block', fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600 }

  return (
    <div style={{ minHeight: '100vh', background: '#211f1d', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 420, background: '#2b2a28', borderRadius: 12, padding: 36, border: '1px solid #3a3733' }}>
        <h2 style={{ color: '#fff', fontSize: 22, margin: '0 0 6px' }}>Tell us about yourself</h2>
        <p style={{ color: '#999', fontSize: 13, marginBottom: 28 }}>This helps us set up your workspace</p>

        <label style={labelStyle}>Full Name</label>
        <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} style={inputStyle} placeholder="Your name" />

        <label style={labelStyle}>Company / Workshop Name</label>
        <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} style={inputStyle} placeholder="Your workshop name" />

        <label style={labelStyle}>Phone Number</label>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} placeholder="+91 9XXXXXXXXX" />

        <label style={labelStyle}>Machine Type</label>
        <select value={machineType} onChange={(e) => setMachineType(e.target.value)} style={inputStyle}>
          <option>CNC Turning</option>
          <option>VMC</option>
          <option>Sliding Head CNC</option>
          <option>Other</option>
        </select>

        <label style={labelStyle}>Years of Experience</label>
        <input type="number" value={experience} onChange={(e) => setExperience(e.target.value)} style={inputStyle} placeholder="e.g. 5" />

        <button onClick={handleSubmit} disabled={loading} style={{ width: '100%', background: '#F0801E', color: '#fff', border: 'none', borderRadius: 6, padding: 13, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
          {loading ? 'Saving...' : 'Continue'}
        </button>
        {error && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  )
}