'use client'
import { useParams, useRouter } from 'next/navigation'
import ReportView from '@/components/machine-status/ReportView'

// Reports for people who have entered the shop PIN on the status board
export default function PublicReportsPage() {
  const params = useParams<{ slug: string }>()
  const router = useRouter()
  const slug = String(params?.slug || '').toLowerCase()

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #262421 0%, #302d29 100%)', fontFamily: 'Segoe UI, sans-serif', padding: '24px 16px', color: '#fff' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 18 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>📊 Reports</h1>
          <button onClick={() => router.push(`/${slug}`)} style={{ background: 'transparent', border: '1px solid #3a3733', color: '#ddd', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>&larr; Status board</button>
        </div>
        <ReportView slug={slug} />
      </div>
    </div>
  )
}
