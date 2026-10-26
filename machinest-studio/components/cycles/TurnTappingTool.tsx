'use client'
import { useMemo, useState } from 'react'
import CentreAnim from './CentreAnim'
import { computeTap, TapMethod } from '@/lib/cycles/tap-motion'

const label = { fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600, display: 'block' } as const
const input = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 12px', fontSize: 14 } as const
const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 24 } as const
const ORANGE = '#F0801E'

type Ctl = 'A' | 'B' | 'C'
const SYNC: Record<Ctl, string> = { A: 'G32', B: 'G32', C: 'G33' }
const PRESETS: [string, number, number][] = [
  ['M6 × 1', 6, 1], ['M8 × 1.25', 8, 1.25], ['M10 × 1.5', 10, 1.5], ['M12 × 1.75', 12, 1.75], ['M14 × 2', 14, 2], ['M16 × 2', 16, 2],
  ['M20 × 2.5', 20, 2.5], ['M24 × 3', 24, 3], ['M10 × 1 (fine)', 10, 1], ['M12 × 1.25 (fine)', 12, 1.25], ['M16 × 1.5 (fine)', 16, 1.5], ['Custom', 0, 0],
]
const blockE = (e: React.KeyboardEvent) => { if (e.key === 'e' || e.key === 'E') e.preventDefault() }

export default function TurnTappingTool({ onGenerate, busy, error }: {
  onGenerate: (values: Record<string, string>) => void
  busy: boolean
  error: string
}) {
  const [ctl, setCtl] = useState<Ctl>('A')
  const [method, setMethod] = useState<TapMethod>('rigid')
  const [preset, setPreset] = useState('')
  const [d, setD] = useState('')
  const [p, setP] = useState('')
  const [depth, setDepth] = useState('')
  const [faceZ, setFaceZ] = useState('0')
  const [rpm, setRpm] = useState('')
  const [maxFeed, setMaxFeed] = useState('3000')
  const [dwell, setDwell] = useState('0')
  const [coolant, setCoolant] = useState(true)
  const [progNum, setProgNum] = useState('')
  const [toolNo, setToolNo] = useState('5')
  const [workOffset, setWorkOffset] = useState('G54')

  const nD = parseFloat(d), nP = parseFloat(p)

  function pickPreset(v: string) {
    setPreset(v)
    const pr = PRESETS[+v]
    if (pr && pr[1]) { setD(String(pr[1])); setP(String(pr[2])) }
  }

  const calc = useMemo(() => computeTap({
    D: nD, lead: nP, depth: parseFloat(depth), faceZ: parseFloat(faceZ), method, rpm: parseFloat(rpm), dwell: parseFloat(dwell) || 0, maxFeed: parseFloat(maxFeed),
  }), [nD, nP, depth, faceZ, method, rpm, dwell, maxFeed])

  const ready = !!d && !!p && !!depth && faceZ !== '' && !!rpm && !!maxFeed && !!progNum && !!toolNo

  function handleGenerate() {
    onGenerate({ ctl, method, d, p, depth, faceZ, rpm, maxFeed, dwell, coolant: coolant ? '1' : '0', progNum, toolNo, workOffset })
  }

  const num = (val: string, set: (v: string) => void, ph = '') => (
    <input style={input} type="number" step="any" value={val} placeholder={ph} onKeyDown={blockE} onChange={ev => set(ev.target.value)} />
  )
  const field = (l: string, el: React.ReactNode) => <div><label style={label}>{l}</label>{el}</div>
  const choice = (items: [string, string][], cur: string, set: (v: string) => void) => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {items.map(([k, t]) => (
        <button key={k} type="button" onClick={() => set(k)}
          style={{ flex: '1 1 140px', padding: 11, borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: cur === k ? ORANGE : '#1c1b19', color: cur === k ? '#fff' : '#bbb' }}>{t}</button>
      ))}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={card}>
        <h3 style={{ color: '#fff', margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>Control and method</h3>
        <p style={{ color: '#999', fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>Tapping on the centre line with a tap on the turret. X is always 0. No live tool and no C axis.</p>
        <label style={label}>Fanuc G-code system (control type)</label>
        {choice([['A', 'Type A'], ['B', 'Type B'], ['C', 'Type C']], ctl, v => setCtl(v as Ctl))}
        <label style={{ ...label, marginTop: 14 }}>Method</label>
        {choice([['rigid', 'Rigid tapping (G84 with M29)'], ['sync', `${SYNC[ctl]} with spindle reversal (M04)`]], method, v => setMethod(v as TapMethod))}
      </div>

      <div style={card}>
        <h4 style={{ color: '#fff', margin: '0 0 14px', fontSize: 16 }}>Thread</h4>
        <label style={label}>Tap size (metric, coarse and fine)</label>
        <select style={input} value={preset} onChange={ev => pickPreset(ev.target.value)}>
          <option value="">Select a size or enter your own</option>
          {PRESETS.map((x, i) => <option key={x[0]} value={i}>{x[0]}</option>)}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginTop: 14 }}>
          {field('Tap diameter (M)', num(d, setD, 'e.g. 10'))}
          {field('Pitch / lead', num(p, setP, 'e.g. 1.5'))}
          {field('Pre-drill diameter', <input style={{ ...input, opacity: 0.7 }} disabled value={isNaN(nD) || isNaN(nP) ? '' : (nD - nP).toFixed(3)} />)}
          {field('Thread depth', num(depth, setDepth, 'e.g. 20'))}
          {field('Face Z (finished face)', num(faceZ, setFaceZ))}
        </div>
        <p style={{ color: '#888', fontSize: 12, margin: '10px 0 0' }}>The hole must be drilled before tapping. Pre-drill diameter = tap diameter − pitch. Thread depth is measured with the full tap thread.</p>
      </div>

      <div style={card}>
        <h4 style={{ color: '#fff', margin: '0 0 14px', fontSize: 16 }}>Cutting data</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
          {field('Spindle RPM', num(rpm, setRpm, 'e.g. 300'))}
          {field('Machine max cutting feed (mm/min)', num(maxFeed, setMaxFeed))}
          {method === 'rigid' && field('Dwell at bottom (s)', num(dwell, setDwell))}
        </div>
        <p style={{ color: '#9ad7b0', fontSize: 12.5, margin: '10px 0 0', lineHeight: 1.5 }}>
          Feed equals the pitch and the RPM stays constant. {calc.ok ? `Feed = ${Math.round(nP * parseFloat(rpm))} mm/min.` : ''}
        </p>
        {calc.ok && calc.warns.map((w, i) => <p key={i} style={{ color: '#ffb84d', fontSize: 13, margin: '8px 0 0' }}>{w}</p>)}
        <label style={{ ...label, marginTop: 14, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="checkbox" checked={coolant} onChange={ev => setCoolant(ev.target.checked)} /> Coolant (M08 / M09)
        </label>
      </div>

      <div style={card}>
        <h4 style={{ color: '#fff', margin: '0 0 14px', fontSize: 16 }}>Tool movement</h4>
        <CentreAnim calc={calc} />
      </div>

      <div style={card}>
        <h4 style={{ color: '#fff', margin: '0 0 14px', fontSize: 16 }}>Machining Parameters</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {field('Program No', num(progNum, setProgNum))}
          {field('Tool No (T)', num(toolNo, setToolNo))}
          <div>
            <label style={label}>Work Offset</label>
            <select style={input} value={workOffset} onChange={ev => setWorkOffset(ev.target.value)}>
              {['G54', 'G55', 'G56', 'G57', 'G58', 'G59'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>
        <button onClick={handleGenerate} disabled={!ready || busy}
          style={{ width: '100%', background: ready ? ORANGE : '#4a4744', color: '#fff', border: 'none', borderRadius: 6, padding: 13, fontSize: 15, fontWeight: 700, cursor: ready ? 'pointer' : 'not-allowed', marginTop: 18 }}>
          {busy ? 'Generating...' : 'Generate'}
        </button>
        {error && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 12, marginBottom: 0 }}>{error}</p>}
      </div>
    </div>
  )
}
