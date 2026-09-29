'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import TutorialModal from '@/components/TutorialModal'

type Cycle = {
  id: string
  code: string
  name: string
  tutorial_video_url: string | null
}

type Tool = {
  id: string
  name: string
  slug: string
}

export default function StudioPage() {
  const [tool, setTool] = useState<Tool | null>(null)
  const [cycles, setCycles] = useState<Cycle[]>([])
  const [loading, setLoading] = useState(true)
  const [notAllowed, setNotAllowed] = useState(false)
  const [tutorialFor, setTutorialFor] = useState<Cycle | null>(null)
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const slug = params.slug as string

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data: toolData } = await supabase.from('tools').select('*').eq('slug', slug).single()
      if (!toolData) { router.push('/dashboard'); return }

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('tool_id', toolData.id)
        .eq('status', 'active')
        .maybeSingle()

      if (!sub) {
        setNotAllowed(true)
        setLoading(false)
        return
      }

      const { data: cyclesData } = await supabase.from('cycles').select('*').eq('tool_id', toolData.id)
      setTool(toolData)
      setCycles(cyclesData || [])
      setLoading(false)
    }
    loadData()
  }, [slug])

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#262421', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, sans-serif' }}>Loading...</div>
  }

  if (notAllowed) {
    return (
      <div style={{ minHeight: '100vh', background: '#262421', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, sans-serif', gap: 16 }}>
        <p>You don't have access to this tool yet.</p>
        <button onClick={() => router.push('/membership')} style={{ background: '#F0801E', color: '#fff', border: 'none', borderRadius: 999, padding: '10px 24px', fontWeight: 700, cursor: 'pointer' }}>
          Add this tool
        </button>
      </div>
    )
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

      <div style={{ padding: '48px 40px', maxWidth: 800, margin: '0 auto' }}>
        <h2 style={{ color: '#fff', fontSize: 26, margin: '0 0 6px', fontWeight: 800 }}>{tool?.name}</h2>
        <p style={{ color: '#999', fontSize: 14, marginBottom: 28 }}>Select a cycle to generate your program</p>

        <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 20 }}>
          {cycles.length === 0 ? (
            <p style={{ color: '#777', fontSize: 14 }}>No cycles added yet.</p>
          ) : (
            cycles.map(cycle => (
              <div
                key={cycle.id}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 18px', border: '1px solid #3a3733', borderRadius: 8, marginBottom: 10 }}
              >
                <div>
                  <span style={{ color: '#F0801E', fontFamily: 'Consolas, monospace', fontWeight: 800, marginRight: 14 }}>{cycle.code}</span>
                  <span style={{ color: '#fff', fontSize: 14 }}>{cycle.name}</span>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {cycle.tutorial_video_url && (
                    <button
                      onClick={() => setTutorialFor(cycle)}
                      style={{ padding: '8px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer', background: 'transparent', border: '1px solid #3a3733', color: '#ddd' }}
                    >
                      ▶ Tutorial
                    </button>
                  )}
                  <button
                    onClick={() => router.push(`/cycle/${cycle.id}`)}
                    style={{ padding: '8px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer', background: '#F0801E', border: 'none', color: '#fff', fontWeight: 700 }}
                  >
                    Use Cycle
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {tutorialFor && (
        <TutorialModal
          cycleId={tutorialFor.id}
          title={`${tutorialFor.code} - ${tutorialFor.name}`}
          onClose={() => setTutorialFor(null)}
        />
      )}
    </div>
  )
}