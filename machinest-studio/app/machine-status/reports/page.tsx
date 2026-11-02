'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import ReportView from '@/components/machine-status/ReportView'

export default function OwnerReportsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/')
      else setReady(true)
    })
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #262421 0%, #302d29 100%)', fontFamily: 'Segoe UI, sans-serif', padding: '24px 16px', color: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>📊 Machine Status reports</h1>
          <button onClick={() => router.push('/machine-status')} style={{ background: 'transparent', border: '1px solid #3a3733', color: '#ddd', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>&larr; Machine Status</button>
        </div>
        {ready ? <ReportView /> : <p style={{ color: '#999' }}>Loading...</p>}
      </div>
    </div>
  )
}
