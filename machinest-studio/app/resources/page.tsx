'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 20 } as const

type ResourceType = 'video' | 'pdf' | 'excel' | 'calculator' | 'link'
type Resource = {
  id: string
  title: string
  description: string | null
  resource_type: ResourceType
  url: string
  category: string | null
}

const TYPE_ICON: Record<ResourceType, string> = {
  video: '▶', pdf: '📄', excel: '📊', calculator: '🧮', link: '🔗',
}
const TYPE_LABEL: Record<ResourceType, string> = {
  video: 'Video', pdf: 'PDF', excel: 'Excel Sheet', calculator: 'Calculator', link: 'Link',
}

export default function ResourcesPage() {
  const router = useRouter()
  const supabase = createClient()
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data } = await supabase
        .from('resources')
        .select('id, title, description, resource_type, url, category')
        .eq('active', true)
        .order('display_order', { ascending: true })

      setResources(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const groups = resources.reduce<Record<string, Resource[]>>((acc, r) => {
    const key = r.category || 'General'
    if (!acc[key]) acc[key] = []
    acc[key].push(r)
    return acc
  }, {})

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #262421 0%, #302d29 100%)', fontFamily: 'Segoe UI, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 32px', background: '#211f1d', borderBottom: '2px solid #F0801E' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo-icon.png" alt="Machinest Studio" style={{ height: 40, width: 'auto' }} />
          <span style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>Machinest <span style={{ color: '#F0801E' }}>Studio</span></span>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ background: '#F0801E', color: '#fff', border: 'none', borderRadius: 999, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          &larr; Dashboard
        </button>
      </header>

      <div style={{ padding: '32px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ color: '#fff', fontSize: 24, margin: '0 0 6px', fontWeight: 800 }}>Free Resources</h2>
        <p style={{ color: '#999', fontSize: 14, margin: '0 0 28px' }}>Videos, Excel sheets, PDFs and calculators — free for every Machinest Studio member.</p>

        {loading ? (
          <p style={{ color: '#999' }}>Loading...</p>
        ) : resources.length === 0 ? (
          <p style={{ color: '#999' }}>No resources yet — check back soon.</p>
        ) : (
          Object.entries(groups).map(([category, items]) => (
            <div key={category} style={{ marginBottom: 32 }}>
              <h3 style={{ color: '#F0801E', fontSize: 15, fontWeight: 700, margin: '0 0 14px', textTransform: 'uppercase', letterSpacing: 0.5 }}>{category}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
                {items.map(r => (
                  <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" style={{ ...card, textDecoration: 'none', display: 'block' }}>
                    <div style={{ fontSize: 26, marginBottom: 10 }}>{TYPE_ICON[r.resource_type]}</div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{r.title}</div>
                    {r.description && <div style={{ color: '#999', fontSize: 13, marginBottom: 10 }}>{r.description}</div>}
                    <span style={{ color: '#F0801E', fontSize: 12, fontWeight: 700 }}>{TYPE_LABEL[r.resource_type]} &rarr;</span>
                  </a>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
