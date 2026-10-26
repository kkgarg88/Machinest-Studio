'use client'
import { useMemo, useState } from 'react'
import CentreAnim from './CentreAnim'
import { computeDrill, DrillMethod } from '@/lib/cycles/drill-motion'

const label = { fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600, display: 'block' } as const
const input = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 12px', fontSize: 14 } as const
const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 24 } as const
const ORANGE = '#F0801E'

type Ctl = 'A' | 'B' | 'C'
const CHIP: Record<Ctl, string> = { A: 'G74', B: 'G74', C: 'G76' }
const blockE = (e: React.KeyboardEvent) => { if (e.key === 'e' || e.key === 'E') e.preventDefault() }

export default function DrillingTool({ onGenerate, busy, error }: {
  onGenerate: (values: Record<string, string>) => void
  busy: boolean
  error: string
}) {
  const [ctl, setCtl] = useState<Ctl>('A')
  const [method, setMethod] = useState<DrillMethod>('chip')
  const [d, setD] = useState('')
  const [depth, setDepth] = useState('')
  const [depthTo, setDepthTo] = useState<'full' | 'tip'>('full')
  const [tip, setTip] = useState('118')
  const [faceZ, setFaceZ] = useState('0')
  const [q, setQ] = useState('')
  const [e, setE] = useState('0.5')
  const [rpm, setRpm] = useState('')
  const [feed, setFeed] = useState('')
  const [dwell, setDwell] = useState('0')
  const [coolant, setCoolant] = useState(true)
  const [progNum, setProgNum] = useState('')
  const [toolNo, setToolNo] = useState('4')
  const [workOffset, setWorkOffset] = useState('G54')

  const calc = useMemo(() => computeDrill({
    D: parseFloat(d), depth: parseFloat(depth), depthTo, tip: parseFloat(tip), faceZ: parseFloat(faceZ), method,
    Q: parseFloat(q), e: parseFloat(e) || 0, rpm: parseFloat(rpm), feed: parseFloat(feed), dwell: parseFloat(dwell) || 0,
  }), [d, depth, depthTo, tip, faceZ, method, q, e, rpm, feed, dwell])

  const needQ = method !== 'plain'
  const ready = !!d && !!depth && !!tip && faceZ !== '' && !!rpm && !!feed && !!progNum && !!toolNo && (!needQ || !!q)

  function handleGenerate() {
    onGenerate({ ctl, method, d, depth, depthTo, tip, faceZ, q, e, rpm, feed, dwell, coolant: coolant ? '1' : '0', progNum, toolNo, workOffset })
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
        <p style={{ color: '#999', fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>Drilling on the centre line with a drill on the turret. X is always 0. No live tool and no C axis.</p>
        <label style={label}>Fanuc G-code system (control type)</label>
        {choice([['A', 'Type A'], ['B', 'Type B'], ['C', 'Type C']], ctl, v => setCtl(v as Ctl))}
        <label style={{ ...label, marginTop: 14 }}>Method</label>
        {choice([['chip', `Peck, chip break (${CHIP[ctl]})`], ['full', 'Peck, full retract (G83)'], ['plain', 'Plain drilling, no peck']], method, v => setMethod(v as DrillMethod))}
      </div>

      <div style={card}>
        <h4 style={{ color: '#fff', margin: '0 0 14px', fontSize: 16 }}>Hole</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
          {field('Drill diameter', num(d, setD, 'e.g. 10'))}
          {field('Hole depth', num(depth, setDepth, 'e.g. 30'))}
          {field('Face Z (finished face)', num(faceZ, setFaceZ))}
          {field('Point angle', num(tip, setTip))}
        </div>
        <label style={{ ...label, marginTop: 14 }}>Hole depth is measured to</label>
        {choice([['full', 'Full diameter (drill tip is added)'], ['tip', 'Drill tip']], depthTo, v => setDepthTo(v as 'full' | 'tip'))}
        <p style={{ color: '#9ad7b0', fontSize: 12.5, margin: '10px 0 0', lineHeight: 1.5 }}>
          {calc.ok ? `Drill tip travels to Z${String(Number(calc.geom.zEnd.toFixed(3)))}${calc.geom.tipLen > 0 ? ` (tip length ${calc.geom.tipLen.toFixed(3)})` : ''}. Start point Z${String(Number(calc.geom.zInit.toFixed(3)))}, R point Z${String(Number(calc.geom.zR.toFixed(3)))}.` : 'The drill starts 5 mm in front of the face and works from an R point 2 mm in front of the face.'}
        </p>
      </div>

      <div style={card}>
        <h4 style={{ color: '#fff', margin: '0 0 14px', fontSize: 16 }}>Cutting data</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
          {field('Spindle RPM (G97)', num(rpm, setRpm, 'e.g. 1200'))}
          {field('Feed (mm/rev)', num(feed, setFeed, 'e.g. 0.1'))}
          {needQ && field('Peck depth', num(q, setQ, 'e.g. 5'))}
          {method === 'chip' && field('Chip-break retract', num(e, setE))}
          {method !== 'chip' && field('Dwell at bottom (s)', num(dwell, setDwell))}
        </div>
        {method === 'chip' && <p style={{ color: '#888', fontSize: 12, margin: '10px 0 0' }}>The {CHIP[ctl]} cycle has no dwell at the bottom, so it is not offered here. Use full retract or plain drilling if you need a dwell.</p>}
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
