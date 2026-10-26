'use client'
import { useMemo, useState } from 'react'
import ThreadAnim from './ThreadAnim'
import { computeThread } from '@/lib/cycles/thread-motion'

const label = { fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600, display: 'block' } as const
const input = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 12px', fontSize: 14 } as const
const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 24 } as const
const ORANGE = '#F0801E'

type Ctl = 'A' | 'B' | 'C'
type Method = 'multi' | 'single'
const CODE_NAMES: Record<Ctl, [string, string]> = { A: ['G76', 'G92'], B: ['G76', 'G78'], C: ['G78', 'G21'] }
const PRESETS: [string, number, number][] = [
  ['M6 × 1', 6, 1], ['M8 × 1.25', 8, 1.25], ['M10 × 1.5', 10, 1.5], ['M12 × 1.75', 12, 1.75], ['M16 × 2', 16, 2], ['M20 × 2.5', 20, 2.5],
  ['M24 × 3', 24, 3], ['M30 × 3.5', 30, 3.5], ['M30 × 1.5 (fine)', 30, 1.5], ['M30 × 2 (fine)', 30, 2], ['M36 × 4', 36, 4], ['M42 × 4.5', 42, 4.5], ['Custom', 0, 0],
]
const blockE = (e: React.KeyboardEvent) => { if (e.key === 'e' || e.key === 'E') e.preventDefault() }

export default function ThreadingTool({ onGenerate, busy, error }: {
  onGenerate: (values: Record<string, string>) => void
  busy: boolean
  error: string
}) {
  const [ctl, setCtl] = useState<Ctl>('A')
  const [method, setMethod] = useState<Method>('multi')
  const [preset, setPreset] = useState('')
  const [d, setD] = useState('')
  const [p, setP] = useState('')
  const [h, setH] = useState('')
  const [zStart, setZStart] = useState('0')
  const [len, setLen] = useState('')
  const [runout, setRunout] = useState<'groove' | 'chamfer'>('groove')
  const [ang, setAng] = useState('29')
  const [d1, setD1] = useState('0.3')
  const [dmin, setDmin] = useState('0.1')
  const [fin, setFin] = useState('0.05')
  const [m, setM] = useState('2')
  const [rpm, setRpm] = useState('')
  const [maxFeed, setMaxFeed] = useState('3000')
  const [progNum, setProgNum] = useState('')
  const [toolNo, setToolNo] = useState('3')
  const [workOffset, setWorkOffset] = useState('G54')

  const nD = parseFloat(d), nP = parseFloat(p), nH = parseFloat(h)
  const minor = !isNaN(nD) && !isNaN(nH) ? nD - 2 * nH : NaN

  function pickPreset(v: string) {
    setPreset(v)
    const pr = PRESETS[+v]
    if (pr && pr[1]) {
      setD(String(pr[1])); setP(String(pr[2])); setH((0.6134 * pr[2]).toFixed(3))
      setD1(String(Math.min(0.35, +(0.6134 * pr[2] * 0.4).toFixed(2))))
    }
  }
  function changePitch(v: string) { setP(v); const n = parseFloat(v); if (!isNaN(n)) setH((0.6134 * n).toFixed(3)); setPreset(String(PRESETS.length - 1)) }

  const calc = useMemo(() => computeThread({
    D: nD, P: nP, h: nH, zStart: parseFloat(zStart), L: parseFloat(len), d1: parseFloat(d1), dmin: parseFloat(dmin),
    fin: parseFloat(fin) || 0, m: Math.max(0, Math.round(parseFloat(m) || 0)), rpm: parseFloat(rpm),
    maxFeed: parseFloat(maxFeed) || 3000, runout, ang: parseInt(ang, 10),
  }), [nD, nP, nH, zStart, len, d1, dmin, fin, m, rpm, maxFeed, runout, ang])

  const ready = !!d && !!p && !!h && zStart !== '' && !!len && !!d1 && !!dmin && !!rpm && !!progNum && !!toolNo && !!maxFeed
  const tbd = ctl === 'C' && method === 'multi'

  function handleGenerate() {
    onGenerate({ ctl, method, d, p, h, zStart, len, runout, ang, d1, dmin, fin, m, rpm, maxFeed, progNum, toolNo, workOffset })
  }

  const num = (val: string, set: (v: string) => void, ph = '') => (
    <input style={input} type="number" step="any" value={val} placeholder={ph} onKeyDown={blockE} onChange={e => set(e.target.value)} />
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
        <p style={{ color: '#999', fontSize: 13, margin: '0 0 14px', lineHeight: 1.5 }}>External thread on a turned diameter. Pick the Fanuc G-code system of your machine and how the thread should be cut.</p>
        <label style={label}>Fanuc G-code system (control type)</label>
        {choice([['A', 'Type A'], ['B', 'Type B'], ['C', 'Type C']], ctl, v => setCtl(v as Ctl))}
        <label style={{ ...label, marginTop: 14 }}>Method</label>
        {choice([['multi', 'Multi-pass cycle'], ['single', 'Single-pass cycle, pass by pass']], method, v => setMethod(v as Method))}
        <p style={{ color: '#9ad7b0', fontSize: 12.5, margin: '10px 0 0' }}>Type {ctl}: multi-pass = {CODE_NAMES[ctl][0]}, single-pass = {CODE_NAMES[ctl][1]}</p>
        {tbd && <p style={{ color: '#ffcf80', background: '#3a2a10', border: '1px solid #8a5a10', borderRadius: 8, padding: '8px 10px', fontSize: 12.5, margin: '10px 0 0', lineHeight: 1.5 }}>The type C multi-pass (G78) format is not confirmed yet. Use the single-pass cycle (G21) for type C.</p>}
      </div>

      <div style={card}>
        <h4 style={{ color: '#fff', margin: '0 0 14px', fontSize: 16 }}>Thread</h4>
        <label style={label}>Thread size (metric, coarse and fine)</label>
        <select style={input} value={preset} onChange={e => pickPreset(e.target.value)}>
          <option value="">Select a size or enter your own</option>
          {PRESETS.map((x, i) => <option key={x[0]} value={i}>{x[0]}</option>)}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginTop: 14 }}>
          {field('Major diameter D', num(d, v => { setD(v); if (!preset) setPreset(String(PRESETS.length - 1)) }, 'e.g. 30'))}
          {field('Pitch / lead', num(p, changePitch, 'e.g. 1.5'))}
          {field('Thread height h (radial)', num(h, setH))}
          {field('Minor diameter', <input style={{ ...input, opacity: 0.7 }} disabled value={isNaN(minor) ? '' : minor.toFixed(3)} />)}
          {field('Thread starts at Z', num(zStart, setZStart))}
          {field('Thread length', num(len, setLen, 'e.g. 30'))}
        </div>
        <p style={{ color: '#888', fontSize: 12, margin: '10px 0 0' }}>Thread height is set to 0.6134 × pitch when you pick a size or change the pitch. You can edit it.</p>
        <label style={{ ...label, marginTop: 14 }}>Thread end</label>
        {choice([['groove', 'Relief groove'], ['chamfer', 'Pull-out chamfer (45°)']], runout, v => setRunout(v as 'groove' | 'chamfer'))}
      </div>

      <div style={card}>
        <h4 style={{ color: '#fff', margin: '0 0 14px', fontSize: 16 }}>Passes and cutting data</h4>
        <label style={label}>Infeed</label>
        <select style={input} value={ang} onChange={e => setAng(e.target.value)}>
          <option value="29">Flank infeed 29° (most used)</option>
          <option value="60">Flank infeed, 60° tool tip</option>
          <option value="0">Radial infeed 0°</option>
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginTop: 14 }}>
          {field('First cut depth (radial)', num(d1, setD1))}
          {field('Minimum cut depth', num(dmin, setDmin))}
          {field('Finish allowance (radial)', num(fin, setFin))}
          {field('Spring / finish passes', num(m, setM))}
          {field('Spindle RPM (G97 only)', num(rpm, setRpm, 'e.g. 800'))}
          {field('Machine max cutting feed (mm/min)', num(maxFeed, setMaxFeed))}
        </div>
        <p style={{ color: '#9ad7b0', fontSize: 12.5, margin: '10px 0 0', lineHeight: 1.5 }}>Threading always runs at constant RPM (G97). The tool starts about {calc.ok ? calc.geom.leadIn.toFixed(1) : '3 × pitch'} mm before the thread so the feed is steady when it enters.</p>
        {calc.ok && calc.warns.map((w, i) => <p key={i} style={{ color: '#ffb84d', fontSize: 13, margin: '8px 0 0' }}>{w}</p>)}
      </div>

      <div style={card}>
        <h4 style={{ color: '#fff', margin: '0 0 14px', fontSize: 16 }}>Tool movement</h4>
        <ThreadAnim calc={calc} />
      </div>

      <div style={card}>
        <h4 style={{ color: '#fff', margin: '0 0 14px', fontSize: 16 }}>Machining Parameters</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {field('Program No', num(progNum, setProgNum))}
          {field('Tool No (T)', num(toolNo, setToolNo))}
          <div>
            <label style={label}>Work Offset</label>
            <select style={input} value={workOffset} onChange={e => setWorkOffset(e.target.value)}>
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
