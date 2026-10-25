'use client'
import { useEffect, useState } from 'react'

const label = { fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600, display: 'block' } as const
const input = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 12px', fontSize: 14 } as const
const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 24 } as const
const ORANGE = '#F0801E'
const GRAY = '#bdbab5'

type EdgeType = 'plain' | '1' | '2' | '3'

// small input used on the sketch
function Chip({ name, text, value, set, left, top, narrow }: {
  name: string; text: string; value: string; set: (v: string) => void; left: number; top: number; narrow: boolean
}) {
  const box = (
    <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 11.5, fontWeight: 800, color: ORANGE, whiteSpace: 'nowrap' }}>{name} <span style={{ color: '#9a958d', fontWeight: 600 }}>{text}</span></span>
      <input
        type="number" step="any" value={value} onChange={e => set(e.target.value)}
        onKeyDown={e => { if (e.key === 'e' || e.key === 'E') e.preventDefault() }}
        style={{ ...input, width: narrow ? '100%' : 78, padding: '6px 8px', textAlign: 'center', fontSize: 14, fontWeight: 700, background: '#12100e', borderColor: ORANGE }}
      />
    </label>
  )
  if (narrow) return <div>{box}</div>
  return <div style={{ position: 'absolute', left: `${(left / 640) * 100}%`, top: `${(top / 360) * 100}%`, transform: 'translate(-50%,-50%)' }}>{box}</div>
}

function Sketch({ type }: { type: EdgeType }) {
  const gx1 = 290, gx2 = 390, face = 540, y0 = 70, yg = 120
  const t = type === 'plain' ? 0 : 14
  const rb = type === '2' || type === '3' ? 12 : 0
  const top: string[] = [`M40,${y0}`, `H${gx1 - t}`]
  if (t) top.push(type === '3' ? `A${t},${t} 0 0 1 ${gx1},${y0 + t}` : `L${gx1},${y0 + t}`)
  top.push(`V${yg - rb}`)
  if (rb) top.push(`A${rb},${rb} 0 0 0 ${gx1 + rb},${yg}`)
  top.push(`H${gx2 - rb}`)
  if (rb) top.push(`A${rb},${rb} 0 0 0 ${gx2},${yg - rb}`)
  top.push(`V${y0 + t}`)
  if (t) top.push(type === '3' ? `A${t},${t} 0 0 1 ${gx2 + t},${y0}` : `L${gx2 + t},${y0}`)
  top.push(`H${face}`, 'V170')
  const d = top.join(' ')
  const arrow = (x1: number, y1: number, x2: number, y2: number) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={ORANGE} strokeWidth="1.6" markerStart="url(#og-a)" markerEnd="url(#og-a)" />
  )
  return (
    <svg viewBox="0 0 640 360" style={{ width: '100%', display: 'block' }} aria-label="Groove sketch">
      <defs>
        <marker id="og-a" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" fill={ORANGE} /></marker>
      </defs>
      <g>
        <path d={d + ' H40 Z'} fill="#3a3733" opacity=".55" />
        <path d={d + ' H40 Z'} fill="#3a3733" opacity=".55" transform="translate(0,340) scale(1,-1)" />
        <path d={d} fill="none" stroke={GRAY} strokeWidth="2.2" />
        <path d={d} fill="none" stroke={GRAY} strokeWidth="2.2" transform="translate(0,340) scale(1,-1)" />
        <line x1="20" y1="170" x2="620" y2="170" stroke="#6a655f" strokeDasharray="14 4 3 4" />
        <line x1={face} y1="40" x2={face} y2="300" stroke="#6a655f" strokeDasharray="4 4" />
      </g>
      <text x={face + 8} y="176" fill="#cfc8bd" fontSize="13" fontWeight="700">Z = 0</text>
      {/* B */}
      {arrow(gx2, 44, face, 44)}
      <line x1={gx2} y1="44" x2={gx2} y2={y0 - 4} stroke="#6a655f" strokeDasharray="2 3" />
      {/* D */}
      {arrow(70, y0, 70, 340 - y0)}
      {/* A */}
      {arrow(340, yg, 340, 340 - yg)}
      {/* W */}
      {arrow(gx1, 300, gx2, 300)}
      <line x1={gx1} y1="236" x2={gx1} y2="304" stroke="#6a655f" strokeDasharray="2 3" />
      <line x1={gx2} y1="236" x2={gx2} y2="304" stroke="#6a655f" strokeDasharray="2 3" />
      <text x="60" y="30" fill="#8a8782" fontSize="12">Z- (towards chuck)  ◄</text>
    </svg>
  )
}

export default function OdGrooveTool({ onGenerate, busy, error }: {
  onGenerate: (values: Record<string, string>) => void
  busy: boolean
  error: string
}) {
  // groove
  const [d, setD] = useState('')
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [w, setW] = useState('')
  const [edgeType, setEdgeType] = useState<EdgeType>('plain')
  const [cL, setCL] = useState(''); const [cR, setCR] = useState('')
  const [rtL, setRtL] = useState(''); const [rtR, setRtR] = useState('')
  const [rbL, setRbL] = useState(''); const [rbR, setRbR] = useState('')
  // tool & method
  const [insertW, setInsertW] = useState('')
  const [method, setMethod] = useState<'plunge' | 'plungeturn'>('plungeturn')
  const [fDia, setFDia] = useState('0.1')
  const [fFace, setFFace] = useState('0.1')
  const [peck, setPeck] = useState('1')
  const [retract, setRetract] = useState('0.3')
  const [dwell, setDwell] = useState('0.5')
  // machining
  const [progNum, setProgNum] = useState('')
  const [toolNo, setToolNo] = useState('3')
  const [spindleMode, setSpindleMode] = useState('G96')
  const [speed, setSpeed] = useState('')
  const [maxRpm, setMaxRpm] = useState('')
  const [feed, setFeed] = useState('')
  const [finishFeed, setFinishFeed] = useState('')
  const [workOffset, setWorkOffset] = useState('G54')
  const [safeX, setSafeX] = useState('2')
  const [safeZ, setSafeZ] = useState('5')

  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 620px)')
    const f = () => setNarrow(mq.matches)
    f(); mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])

  const nW = Number(w), nI = Number(insertW)
  const insertKnown = w !== '' && insertW !== '' && !isNaN(nW) && !isNaN(nI)
  const narrower = insertKnown && nI < nW - 1e-9
  const tooWide = insertKnown && nI > nW + 1e-9
  const hasBottom = edgeType === '2' || edgeType === '3'
  const bottomNeedsTurn = hasBottom && method === 'plunge' && narrower

  const ready = !!d && !!a && !!b && !!w && !!insertW && !!progNum && !!speed && !!feed && (spindleMode === 'G97' || !!maxRpm)

  function handleGenerate() {
    onGenerate({
      d, a, b, w, insertW, edgeType, method: narrower ? method : 'plunge',
      cL, cR, rtL, rtR, rbL, rbR, fDia, fFace, peck, retract, dwell,
      progNum, toolNo, spindleMode, speed, maxRpm, feed, finishFeed, workOffset, safeX, safeZ,
    })
  }

  const num = (val: string, set: (v: string) => void, ph = '') => (
    <input style={input} type="number" step="any" value={val} placeholder={ph}
      onKeyDown={e => { if (e.key === 'e' || e.key === 'E') e.preventDefault() }}
      onChange={e => set(e.target.value)} />
  )
  const pair = (l: string, lv: string, ls: (v: string) => void, r: string, rv: string, rs: (v: string) => void) => (
    <>
      <div><label style={label}>{l}</label>{num(lv, ls)}</div>
      <div><label style={label}>{r}</label>{num(rv, rs)}</div>
    </>
  )

  const typeBtn = (t: EdgeType, text: string) => (
    <button key={t} onClick={() => setEdgeType(t)}
      style={{ flex: '1 1 120px', padding: '10px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: edgeType === t ? ORANGE : '#1c1b19', color: edgeType === t ? '#fff' : '#bbb' }}>
      {text}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={card}>
        <h3 style={{ color: '#fff', margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>Configure your groove</h3>
        <p style={{ color: '#999', fontSize: 13, margin: '0 0 16px' }}>Type the values straight into the sketch. Z0 is the face of the part, the groove is cut towards the chuck.</p>

        <div style={{ position: 'relative', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 10, padding: 8, maxWidth: 680 }}>
          <Sketch type={edgeType} />
          {!narrow && (
            <>
              <Chip name="D" text="R.M. dia" value={d} set={setD} left={135} top={170} narrow={false} />
              <Chip name="A" text="groove dia" value={a} set={setA} left={340} top={170} narrow={false} />
              <Chip name="B" text="from Z0" value={b} set={setB} left={465} top={20} narrow={false} />
              <Chip name="W" text="groove width" value={w} set={setW} left={340} top={334} narrow={false} />
            </>
          )}
        </div>
        {narrow && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
            <Chip name="D" text="R.M. dia" value={d} set={setD} left={0} top={0} narrow />
            <Chip name="A" text="groove dia" value={a} set={setA} left={0} top={0} narrow />
            <Chip name="B" text="from Z0" value={b} set={setB} left={0} top={0} narrow />
            <Chip name="W" text="groove width" value={w} set={setW} left={0} top={0} narrow />
          </div>
        )}

        <h4 style={{ color: '#fff', margin: '22px 0 10px', fontSize: 15 }}>Groove edges</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {typeBtn('plain', 'Plain')}
          {typeBtn('1', 'Type 1 · Chamfer')}
          {typeBtn('2', 'Type 2 · Chamfer + Radius')}
          {typeBtn('3', 'Type 3 · Radius + Radius')}
        </div>
        {edgeType !== 'plain' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {(edgeType === '1' || edgeType === '2') && pair('Top chamfer C – left', cL, setCL, 'Top chamfer C – right', cR, setCR)}
            {edgeType === '3' && pair('Top radius R – left', rtL, setRtL, 'Top radius R – right', rtR, setRtR)}
            {hasBottom && pair('Bottom radius R1 – left', rbL, setRbL, 'Bottom radius R1 – right', rbR, setRbR)}
          </div>
        )}
        <p style={{ color: '#888', fontSize: 12, margin: '10px 0 0' }}>
          Left means the side away from Z0, right is the side nearest Z0. Chamfer and radius are taken from the shoulder, so B stays the wall position.
        </p>
      </div>

      <div style={card}>
        <h4 style={{ color: '#fff', margin: '0 0 14px', fontSize: 16 }}>Insert and cutting method</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><label style={label}>Insert width</label>{num(insertW, setInsertW, 'e.g. 3')}</div>
          <div><label style={label}>Tool No (T)</label>{num(toolNo, setToolNo)}</div>
        </div>
        {tooWide && <p style={{ color: '#ff6b6b', fontSize: 13, margin: '10px 0 0' }}>Insert is wider than the groove.</p>}
        {insertKnown && !tooWide && !narrower && <p style={{ color: '#9ad7b0', fontSize: 13, margin: '10px 0 0' }}>Insert equals the groove width, so the cycle is a single plunge.</p>}

        {narrower && (
          <div style={{ marginTop: 16 }}>
            <label style={label}>The insert is narrower than the groove. How do you want to cut it?</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([['plunge', 'Plunge only'], ['plungeturn', 'Plunge + Turn']] as const).map(([k, t]) => (
                <button key={k} onClick={() => setMethod(k)}
                  style={{ flex: '1 1 160px', padding: 11, borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: method === k ? ORANGE : '#1c1b19', color: method === k ? '#fff' : '#bbb' }}>
                  {t}
                </button>
              ))}
            </div>
            {bottomNeedsTurn && <p style={{ color: '#ffb84d', fontSize: 13, margin: '10px 0 0' }}>Bottom radius needs Plunge + Turn.</p>}
            {method === 'plungeturn' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
                <div><label style={label}>Finish allowance – groove dia (per side)</label>{num(fDia, setFDia)}</div>
                <div><label style={label}>Finish allowance – groove faces (per face)</label>{num(fFace, setFFace)}</div>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 16 }}>
          <div><label style={label}>Peck depth</label>{num(peck, setPeck)}</div>
          <div><label style={label}>Peck retract</label>{num(retract, setRetract)}</div>
          <div><label style={label}>Dwell (sec)</label>{num(dwell, setDwell)}</div>
        </div>
      </div>

      <div style={card}>
        <h4 style={{ color: '#fff', margin: '0 0 14px', fontSize: 16 }}>Machining Parameters</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div><label style={label}>Program No</label>{num(progNum, setProgNum)}</div>
          <div>
            <label style={label}>Spindle Mode</label>
            <select style={input} value={spindleMode} onChange={e => setSpindleMode(e.target.value)}>
              <option value="G96">G96 - Constant Surface Speed</option>
              <option value="G97">G97 - Direct RPM</option>
            </select>
          </div>
          <div><label style={label}>{spindleMode === 'G96' ? 'Surface Speed (m/min)' : 'Speed (RPM)'}</label>{num(speed, setSpeed)}</div>
          {spindleMode === 'G96' && <div><label style={label}>Max Spindle RPM (G50)</label>{num(maxRpm, setMaxRpm, 'e.g. 2000')}</div>}
          <div><label style={label}>Feed (mm/rev)</label>{num(feed, setFeed)}</div>
          <div><label style={label}>Finish Feed (mm/rev, optional)</label>{num(finishFeed, setFinishFeed, 'same as feed')}</div>
          <div>
            <label style={label}>Work Offset</label>
            <select style={input} value={workOffset} onChange={e => setWorkOffset(e.target.value)}>
              {['G54', 'G55', 'G56', 'G57', 'G58', 'G59'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}><label style={label}>Safe X</label>{num(safeX, setSafeX)}</div>
            <div style={{ flex: 1 }}><label style={label}>Safe Z</label>{num(safeZ, setSafeZ)}</div>
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
