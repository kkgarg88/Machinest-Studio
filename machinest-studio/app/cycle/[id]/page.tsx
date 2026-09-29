'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useParams } from 'next/navigation'
import { definitions, Field } from '@/lib/cycles/definitions'

const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 24 } as const
const inputStyle = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 12px', fontSize: 15 } as const
const labelStyle = { display: 'block', fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600 } as const

export default function CyclePage() {
  const [cycle, setCycle] = useState<any>(null)
  const [toolSlug, setToolSlug] = useState('')
  const [fields, setFields] = useState<Field[] | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [gcode, setGcode] = useState('')
  const [svg, setSvg] = useState('')
  const [introSvg, setIntroSvg] = useState('')
  const [programName, setProgramName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<'' | 'ok' | 'fail'>('')
  const supabase = createClient()
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      const { data } = await supabase.from('cycles').select('id, code, name, tools(slug)').eq('id', id).single()
      if (!data) { router.push('/dashboard'); return }

      const rel: any = data.tools
      const slug: string = Array.isArray(rel) ? rel[0]?.slug : rel?.slug
      setCycle(data)
      setToolSlug(slug)

      const defs = definitions[`${slug}:${data.code}`] || null
      setFields(defs)
      if (defs) {
        const init: Record<string, string> = {}
        defs.forEach(f => { init[f.key] = f.default ?? '' })
        setValues(init)

        // page khulte hi example / animation (agar is cycle ke liye bana ho)
        fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cycleId: id, intro: true }),
        })
          .then(r => r.json())
          .then(d => { if (d.svg) setIntroSvg(d.svg) })
          .catch(() => {})
      }
      setLoading(false)
    }
    load()
  }, [id])

  async function generate() {
    setBusy(true)
    setError('')
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cycleId: id, values }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(data.error || 'Something went wrong'); return }
    setGcode(data.gcode)
    setSvg(data.svg)
    setProgramName(data.programName)
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(gcode)
      setCopied('ok')
    } catch {
      setCopied('fail')
    }
    setTimeout(() => setCopied(''), 2000)
  }

  function download() {
    const blob = new Blob([gcode], { type: 'text/plain' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${programName}.nc`
    a.click()
    URL.revokeObjectURL(a.href)
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
        <button onClick={() => router.push(`/studio/${toolSlug}`)} style={{ background: '#F0801E', color: '#fff', border: 'none', borderRadius: 999, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          ← Back
        </button>
      </header>

      <div style={{ padding: '32px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <h2 style={{ color: '#fff', fontSize: 24, margin: '0 0 22px', fontWeight: 800 }}>{cycle.code} - {cycle.name}</h2>

        {!fields ? (
          <p style={{ color: '#999' }}>This cycle is coming soon.</p>
        ) : (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ ...card, flex: '0 0 340px', maxWidth: '100%' }}>
              {fields.map(f => (
                <div key={f.key} style={{ marginBottom: 14 }}>
                  <label style={labelStyle}>{f.label}</label>
                  {f.type === 'select' ? (
                    <select value={values[f.key]} onChange={e => setValues({ ...values, [f.key]: e.target.value })} style={inputStyle}>
                      {f.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input
                      type="number"
                      step={f.step ?? 'any'}
                      value={values[f.key]}
                      onKeyDown={e => { if (e.key === 'e' || e.key === 'E') e.preventDefault() }}
                      onChange={e => setValues({ ...values, [f.key]: e.target.value })}
                      style={inputStyle}
                    />
                  )}
                </div>
              ))}
              <button onClick={generate} disabled={busy} style={{ width: '100%', background: '#F0801E', color: '#fff', border: 'none', borderRadius: 6, padding: 13, fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 6 }}>
                {busy ? 'Generating...' : 'Generate'}
              </button>
              {error && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 12, marginBottom: 0 }}>{error}</p>}
            </div>

            <div style={{ flex: '1 1 460px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {introSvg && <div style={card} dangerouslySetInnerHTML={{ __html: introSvg }} />}

              <div style={card}>
                {svg
                  ? <div dangerouslySetInnerHTML={{ __html: svg }} />
                  : <p style={{ color: '#777', fontSize: 14, margin: 0 }}>Diagram will appear here after you generate.</p>}
              </div>

              <div style={{ background: '#0e0d0c', border: '1px solid #3a3733', borderRadius: 12, padding: 20 }}>
                <pre style={{ margin: 0, minHeight: 200, color: '#F0801E', fontFamily: 'Consolas, monospace', fontSize: 13.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {gcode || '// Fill the values and click Generate'}
                </pre>
                {gcode && (
                  <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                    <button
                      onClick={copy}
                      style={{
                        flex: 1, padding: 11, borderRadius: 6, fontWeight: 600, cursor: 'pointer',
                        border: `1px solid ${copied === 'ok' ? '#2fbf71' : '#3a3733'}`,
                        background: copied === 'ok' ? 'rgba(47,191,113,0.15)' : 'transparent',
                        color: copied === 'ok' ? '#2fbf71' : copied === 'fail' ? '#ff6b6b' : '#ddd',
                      }}
                    >
                      {copied === 'ok' ? '✓ Copied' : copied === 'fail' ? 'Copy failed' : 'Copy'}
                    </button>
                    <button onClick={download} style={{ flex: 1, padding: 11, borderRadius: 6, border: 'none', background: '#F0801E', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                      Download .nc
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}