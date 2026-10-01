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
  annual_price: number
}

declare global {
  interface Window {
    Razorpay: any
  }
}

export default function MembershipPage() {
  const [tools, setTools] = useState<Tool[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [cycle, setCycle] = useState<'monthly' | 'annual'>('monthly')
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()
  const [activeIds, setActiveIds] = useState<string[]>([])

  useEffect(() => {
    async function loadTools() {
      const { data } = await supabase.from('tools').select('*')
      setTools(data || [])

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: subs } = await supabase
          .from('subscriptions')
          .select('tool_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
        setActiveIds((subs || []).map(s => s.tool_id))
      }

      setLoading(false)
    }
    loadTools()

    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    document.body.appendChild(script)
  }, [])

  function toggleTool(id: string) {
    if (activeIds.includes(id)) return
    setSelected(prev => (prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]))
  }

  function handleSkip() {
    router.push('/dashboard')
  }

  async function handlePay() {
    setError('')
    if (selected.length === 0) {
      handleSkip()
      return
    }
    setPaying(true)

    const res = await fetch('/api/payment/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolIds: selected, cycle }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setPaying(false)
      setError(data.error || 'Could not start payment')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()

    const rzp = new window.Razorpay({
      key: data.keyId,
      amount: data.amount,
      currency: 'INR',
      name: 'Machinest Studio',
      description: `${cycle === 'monthly' ? 'Monthly' : 'Annual'} membership`,
      order_id: data.orderId,
      prefill: { email: user?.email || '' },
      theme: { color: '#F0801E' },
      handler: async (response: any) => {
        const verifyRes = await fetch('/api/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(response),
        })
        setPaying(false)
        const verifyData = await verifyRes.json().catch(() => ({}))
        if (!verifyRes.ok) {
          setError(verifyData.error || 'Payment verification failed')
          return
        }
        router.push('/dashboard')
      },
      modal: {
        ondismiss: () => setPaying(false),
      },
    })

    rzp.on('payment.failed', () => {
      setPaying(false)
      setError('Payment failed. Please try again.')
    })

    rzp.open()
  }

  const total = tools
    .filter(t => selected.includes(t.id))
    .reduce((sum, t) => sum + Number(cycle === 'monthly' ? t.monthly_price : t.annual_price), 0)

  if (loading) return <p style={{ padding: 40, color: '#fff', background: '#211f1d', minHeight: '100vh' }}>Loading...</p>

  return (
    <div style={{ minHeight: '100vh', background: '#211f1d', padding: '48px 24px', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h2 style={{ color: '#fff', fontSize: 26, margin: '0 0 6px' }}>Choose your tools</h2>
        <p style={{ color: '#999', fontSize: 14, marginBottom: 20 }}>Pay only for what you use — pick any tools, or skip for now and add later</p>

        <div style={{ display: 'flex', background: '#2b2a28', borderRadius: 8, padding: 4, marginBottom: 20, width: 'fit-content' }}>
          <button
            onClick={() => setCycle('monthly')}
            style={{ padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: cycle === 'monthly' ? '#F0801E' : 'transparent', color: '#fff' }}
          >
            Monthly
          </button>
          <button
            onClick={() => setCycle('annual')}
            style={{ padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: cycle === 'annual' ? '#F0801E' : 'transparent', color: '#fff' }}
          >
            Annual
          </button>
        </div>

        <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 10, padding: 24 }}>
          {tools.map(tool => {
            const isActive = activeIds.includes(tool.id)
            const isSelected = selected.includes(tool.id)
            const price = cycle === 'monthly' ? tool.monthly_price : tool.annual_price
            return (
              <div
                key={tool.id}
                onClick={() => toggleTool(tool.id)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '16px 18px', border: `1px solid ${isSelected ? '#F0801E' : '#3a3733'}`,
                  borderRadius: 8, marginBottom: 12,
                  cursor: isActive ? 'default' : 'pointer',
                  background: isSelected ? '#2a241b' : 'transparent',
                  opacity: isActive ? 0.55 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: 4, marginRight: 12, flexShrink: 0,
                    border: `2px solid ${isSelected ? '#F0801E' : '#666'}`,
                    background: isSelected ? '#F0801E' : 'transparent',
                  }}></span>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>{tool.name}</div>
                    <div style={{ color: '#999', fontSize: 12, marginTop: 2 }}>{tool.description}</div>
                  </div>
                </div>
                {isActive ? (
                  <span style={{ background: '#F0801E', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 10 }}>
                    Active
                  </span>
                ) : (
                  <div style={{ color: '#F0801E', fontWeight: 700, fontSize: 15 }}>
                    ₹{price}/{cycle === 'monthly' ? 'mo' : 'yr'}
                  </div>
                )}
              </div>
            )
          })}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid #3a3733' }}>
            <span style={{ color: '#999', fontSize: 13 }}>
              {selected.length > 0 ? `Total: ₹${total}/${cycle === 'monthly' ? 'mo' : 'yr'}` : 'No tools selected'}
            </span>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleSkip} style={{ background: 'transparent', border: '1px solid #3a3733', color: '#ddd', borderRadius: 6, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Skip for now
              </button>
              <button onClick={handlePay} disabled={paying} style={{ background: '#F0801E', border: 'none', color: '#fff', borderRadius: 6, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                {paying ? 'Processing...' : selected.length === 0 ? 'Continue' : 'Pay & Continue'}
              </button>
            </div>
          </div>
        </div>
        {error && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  )
}