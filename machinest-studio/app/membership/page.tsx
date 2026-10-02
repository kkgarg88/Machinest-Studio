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
  features: string[] | null
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
  const [activeIds, setActiveIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [couponCode, setCouponCode] = useState('')
const [couponApplied, setCouponApplied] = useState<{ discount: number; subtotal: number } | null>(null)
const [couponMsg, setCouponMsg] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    async function loadTools() {
      const { data } = await supabase.from('tools').select('*')
      setTools(data || [])

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const nowIso = new Date().toISOString()
        const { data: subs } = await supabase
          .from('subscriptions')
          .select('tool_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
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
  body: JSON.stringify({ toolIds: selected, cycle, couponCode }),
})
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setPaying(false)
      setError(data.error || 'Could not start payment')
      return
    }
    if (data.discount > 0) {
  setCouponApplied({ discount: data.discount, subtotal: data.subtotal })
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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #211f1d 0%, #2a2724 100%)', padding: '48px 24px', fontFamily: 'Segoe UI, sans-serif' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 30 }}>
          <h2 style={{ color: '#fff', fontSize: 30, margin: '0 0 8px', fontWeight: 800 }}>Choose your tools</h2>
          <p style={{ color: '#999', fontSize: 15 }}>Pay only for what you use — pick any tools, or skip for now and add later</p>

          <div style={{ display: 'inline-flex', background: '#2b2a28', borderRadius: 8, padding: 4, marginTop: 20 }}>
            <button
              onClick={() => setCycle('monthly')}
              style={{ padding: '9px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: cycle === 'monthly' ? '#F0801E' : 'transparent', color: '#fff' }}
            >
              Monthly
            </button>
            <button
              onClick={() => setCycle('annual')}
              style={{ padding: '9px 20px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: cycle === 'annual' ? '#F0801E' : 'transparent', color: '#fff' }}
            >
              Annual <span style={{ opacity: 0.8, fontWeight: 400 }}>(save more)</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: 22, marginBottom: 28 }}>
          {tools.map(tool => {
            const isActive = activeIds.includes(tool.id)
            const isSelected = selected.includes(tool.id)
            const price = cycle === 'monthly' ? tool.monthly_price : tool.annual_price

            return (
              <div
                key={tool.id}
                onClick={() => toggleTool(tool.id)}
                style={{
                  background: isSelected ? 'linear-gradient(160deg, #2e2920 0%, #262320 100%)' : '#2b2a28',
                  border: `2px solid ${isSelected ? '#F0801E' : '#3a3733'}`,
                  borderRadius: 14, padding: 26, cursor: isActive ? 'default' : 'pointer',
                  opacity: isActive ? 0.6 : 1, position: 'relative', display: 'flex', flexDirection: 'column',
                  boxShadow: isSelected ? '0 8px 24px rgba(240,128,30,0.15)' : 'none',
                }}
              >
                {isActive && (
                  <span style={{ position: 'absolute', top: 16, right: 16, background: '#F0801E', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 10 }}>
                    ACTIVE
                  </span>
                )}

                <h3 style={{ color: '#fff', fontSize: 19, fontWeight: 800, margin: '0 0 6px' }}>{tool.name}</h3>
                <p style={{ color: '#999', fontSize: 13, marginBottom: 18, minHeight: 36 }}>{tool.description}</p>

                <div style={{ marginBottom: 20 }}>
                  <span style={{ color: '#F0801E', fontSize: 32, fontWeight: 800 }}>₹{price}</span>
                  <span style={{ color: '#999', fontSize: 13 }}>/{cycle === 'monthly' ? 'month' : 'year'}</span>
                </div>

                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 22px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(tool.features || []).map((f, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#ddd' }}>
                      <span style={{ color: '#2fbf71', fontWeight: 700, flexShrink: 0 }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <div style={{
                  textAlign: 'center', padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  background: isActive ? '#3a3733' : isSelected ? '#F0801E' : 'transparent',
                  border: isActive || isSelected ? 'none' : '1px solid #3a3733',
                  color: isActive ? '#aaa' : isSelected ? '#fff' : '#ddd',
                }}>
                  {isActive ? 'Already Active' : isSelected ? 'Selected ✓' : 'Select this tool'}
                </div>
              </div>
            )
          })}
        </div>
<div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
  <input
    type="text"
    placeholder="Have a coupon code?"
    value={couponCode}
    onChange={e => { setCouponCode(e.target.value.toUpperCase()); setCouponMsg('') }}
    style={{ background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 14px', fontSize: 13, flex: '1 1 200px' }}
  />
  <span style={{ color: '#888', fontSize: 12 }}>Coupon applies automatically at checkout</span>
</div>
        <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
          <span style={{ color: '#999', fontSize: 14 }}>
            {selected.length > 0 ? `Total: ₹${total}/${cycle === 'monthly' ? 'mo' : 'yr'} for ${selected.length} tool${selected.length > 1 ? 's' : ''}` : 'No tools selected'}
          </span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={handleSkip} style={{ background: 'transparent', border: '1px solid #3a3733', color: '#ddd', borderRadius: 6, padding: '11px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Skip for now
            </button>
            <button onClick={handlePay} disabled={paying} style={{ background: '#F0801E', border: 'none', color: '#fff', borderRadius: 6, padding: '11px 24px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              {paying ? 'Processing...' : selected.length === 0 ? 'Continue' : 'Pay & Continue'}
            </button>
          </div>
        </div>
        {error && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 12, textAlign: 'center' }}>{error}</p>}
      </div>
    </div>
  )
}