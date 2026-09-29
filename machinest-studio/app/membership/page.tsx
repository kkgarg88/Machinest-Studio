'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Tool = {
  id: string
  name: string
  slug: string
  description: string
  monthly_price: number
}

export default function MembershipPage() {
  const [tools, setTools] = useState<Tool[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function loadTools() {
      const { data } = await supabase.from('tools').select('*')
      setTools(data || [])
      setLoading(false)
    }
    loadTools()
  }, [])

  function toggleTool(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id])
  }

  async function handleContinue() {
    setError('')
    if (selected.length === 0) {
      handleSkip()
      return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const rows = selected.map(toolId => ({
      user_id: user.id,
      tool_id: toolId,
      status: 'active',
    }))
    const { error } = await supabase.from('subscriptions').upsert(rows, { onConflict: 'user_id,tool_id' })
    setSaving(false)
    if (error) { setError(error.message); return }
    router.push('/dashboard')
  }

  function handleSkip() {
    router.push('/dashboard')
  }

  const total = tools.filter(t => selected.includes(t.id)).reduce((sum, t) => sum + Number(t.monthly_price), 0)

  if (loading) return <p style={{ padding: 40, color: '#fff', background: '#211f1d', minHeight: '100vh' }}>Loading...</p>

  return (
    <div style={{ minHeight: '100vh', background: '#211f1d', padding: '48px 24px', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h2 style={{ color: '#fff', fontSize: 26, margin: '0 0 6px' }}>Choose your tools</h2>
        <p style={{ color: '#999', fontSize: 14, marginBottom: 28 }}>Pay only for what you use — pick any tools, or skip for now and add later</p>

        <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 10, padding: 24 }}>
          {tools.map(tool => {
            const isSelected = selected.includes(tool.id)
            return (
              <div
                key={tool.id}
                onClick={() => toggleTool(tool.id)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 18px', border: `1px solid ${isSelected ? '#F0801E' : '#3a3733'}`,
                  borderRadius: 8, marginBottom: 12, cursor: 'pointer',
                  background: isSelected ? '#2a241b' : 'transparent'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 4, marginRight: 12, flexShrink: 0,
                    border: `2px solid ${isSelected ? '#F0801E' : '#666'}`,
                    background: isSelected ? '#F0801E' : 'transparent'
                  }}></span>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{tool.name}</div>
                    <div style={{ color: '#999', fontSize: 12, marginTop: 2 }}>{tool.description}</div>
                  </div>
                </div>
                <div style={{ color: '#F0801E', fontWeight: 700, fontSize: 15 }}>₹{tool.monthly_price}/mo</div>
              </div>
            )
          })}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid #3a3733' }}>
            <span style={{ color: '#999', fontSize: 13 }}>
              {selected.length > 0 ? `Total: ₹${total}/mo` : 'No tools selected'}
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleSkip} style={{ background: 'transparent', border: '1px solid #3a3733', color: '#ddd', borderRadius: 6, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Skip for now
              </button>
              <button onClick={handleContinue} disabled={saving} style={{ background: '#F0801E', border: 'none', color: '#fff', borderRadius: 6, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {saving ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </div>
        </div>
        {error && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  )
}