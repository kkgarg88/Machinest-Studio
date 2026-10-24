'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import TutorialModal from '@/components/TutorialModal'
import CycleIcon from '@/components/CycleIcon'

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
  const [freeCycleIds, setFreeCycleIds] = useState<string[]>([])
  const [hasToolAccess, setHasToolAccess] = useState(false)
  const [loading, setLoading] = useState(true)
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

      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()

      const nowIso = new Date().toISOString()
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('id')
        .eq('user_id', user.id)
        .eq('tool_id', toolData.id)
        .eq('status', 'active')
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .maybeSingle()

      const { data: cyclesData } = await supabase.from('cycles').select('*').eq('tool_id', toolData.id)
      const cycleIds = (cyclesData || []).map(c => c.id)
      const { data: freeRows } = cycleIds.length
        ? await supabase.from('free_cycles').select('cycle_id').in('cycle_id', cycleIds)
        : { data: [] }

      setTool(toolData)
      setCycles(cyclesData || [])
      setFreeCycleIds((freeRows || []).map(r => r.cycle_id))
      setHasToolAccess(!!profile?.is_admin || !!sub)
      setLoading(false)
    }
    loadData()
  }, [slug])

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

      <div style={{ padding: '48px 40px', maxWidth: 1100, margin: '0 auto' }}>
        <h2 style={{ color: '#fff', fontSize: 26, margin: '0 0 6px', fontWeight: 800 }}>{tool?.name}</h2>
        <p style={{ color: '#999', fontSize: 14, marginBottom: 20 }}>Select a cycle to generate your program</p>

        {!hasToolAccess && (
          <div style={{ background: 'rgba(240,128,30,0.1)', border: '1px solid rgba(240,128,30,0.4)', borderRadius: 8, padding: '12px 16px', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ color: '#F0801E', fontSize: 13 }}>You have free access to 1 cycle below. Upgrade to unlock all of {tool?.name}.</span>
            <button onClick={() => router.push('/membership')} style={{ background: '#F0801E', color: '#fff', border: 'none', borderRadius: 999, padding: '8px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              View Plans
            </button>
          </div>
        )}

        {cycles.length === 0 ? (
          <p style={{ color: '#777', fontSize: 14 }}>No cycles added yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
            {cycles.map(cycle => {
              const isFree = freeCycleIds.includes(cycle.id)
              const unlocked = hasToolAccess || isFree
              return (
                <div
                  key={cycle.id}
                  style={{
                    position: 'relative', background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12,
                    padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
                  }}
                >
                  {isFree && !hasToolAccess && (
                    <span style={{ position: 'absolute', top: 10, right: 10, background: '#2fbf71', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10 }}>FREE</span>
                  )}

                  <div style={{
                    width: 56, height: 56, borderRadius: 12, background: 'rgba(240,128,30,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14, flexShrink: 0,
                    opacity: unlocked ? 1 : 0.6,
                  }}>
                    <CycleIcon code={cycle.code} />
                  </div>

                  <div style={{ minHeight: 58, display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', marginBottom: 18 }}>
                    <span style={{ color: '#F0801E', fontFamily: 'Consolas, monospace', fontWeight: 800, fontSize: 13, marginBottom: 4 }}>
                      {cycle.code}
                    </span>
                    <span style={{ color: '#fff', fontSize: 14, fontWeight: 600, lineHeight: 1.3 }}>
                      {cycle.name}
                    </span>
                  </div>

                  {unlocked ? (
                    <button
                      onClick={() => router.push(`/cycle/${cycle.id}`)}
                      style={{ width: '100%', padding: '10px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#F0801E', border: 'none', color: '#fff', fontWeight: 700, marginBottom: 8 }}
                    >
                      Use Cycle
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push('/membership')}
                      style={{ width: '100%', padding: '10px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer', background: '#4a4744', border: 'none', color: '#fff', fontWeight: 700, marginBottom: 8 }}
                    >
                      🔒 Unlock
                    </button>
                  )}
                  <button
                    onClick={() => setTutorialFor(cycle)}
                    style={{ width: '100%', padding: '9px 14px', fontSize: 12, borderRadius: 6, cursor: 'pointer', background: 'transparent', border: '1px solid #3a3733', color: '#ddd' }}
                  >
                    ▶ Tutorial
                  </button>
                </div>
              )
            })}
          </div>
        )}
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
