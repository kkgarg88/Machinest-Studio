'use client'
import { useMemo, useState } from 'react'
import FaceGrooveAnim from './FaceGrooveAnim'
import { faceGrooveMotion } from '@/lib/cycles/face-groove-motion'

const label = { fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600, display: 'block' } as const
const input = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 12px', fontSize: 14 } as const
const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 24 } as const
const ORANGE = '#F0801E'

type EdgeType = 'plain' | '1' | '2' | '3'
type Method = 'plunge' | 'plungeturn'
const blockE = (e: React.KeyboardEvent) => { if (e.key === 'e' || e.key === 'E') e.preventDefault() }
const fmt = (n: number) => String(Number(n.toFixed(3)))
const pn = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n }

export default function FaceGrooveTool({ onGenerate, busy, error }: {
  onGenerate: (values: Record<string, string>) => void
  busy: boolean
  error: string
}) {
  const [faceZ, setFaceZ] = useState('0')
  const [di, setDi] = useState('')
  const [w, setW] = useState('')
  const [h, setH] = useState('')
  const [edgeType, setEdgeType] = useState<EdgeType>('plain')
  const [cI, setCI] = useState(''); const [cO, setCO] = useState('')
  const [rtI, setRtI] = useState(''); const [rtO, setRtO] = useState('')
  const [rbI, setRbI] = useState(''); const [rbO, setRbO] = useState('')
  const [insertW, setInsertW] = useState('')
  const [method, setMethod] = useState<Method>('plungeturn')
  const [fDepth, setFDepth] = useState('0.1')
  const [fWall, setFWall] = useState('0.1')
  const [peck, setPeck] = useState('1')
  const [retract, setRetract] = useState('0.3')
  const [dwell, setDwell] = useState('0.5')
  const [progNum, setProgNum] = useState('')
  const [toolNo, setToolNo] = useState('3')
  const [spindleMode, setSpindleMode] = useState('G96')
  const [speed, setSpeed] = useState('')
  const [maxRpm, setMaxRpm] = useState('')
  const [feed, setFeed] = useState('')
  const [finishFeed, setFinishFeed] = useState('')
  const [workOffset, setWorkOffset] = useState('G54')
  const [safeZ, setSafeZ] = useState('5')

  const nW = parseFloat(w), nI = parseFloat(insertW)
  const insertKnown = w !== '' && insertW !== '' && !isNaN(nW) && !isNaN(nI)
  const narrower = insertKnown && nI < nW - 1e-9
  const tooWide = insertKnown && nI > nW + 1e-9
  const hasBottom = edgeType === '2' || edgeType === '3'
  const bottomNeedsTurn = hasBottom && method === 'plunge' && narrower
  const doNote = !isNaN(parseFloat(di)) && !isNaN(nW) ? `Do = Di + 2 × W = ${fmt(parseFloat(di) + 2 * nW)}` : ''

  const ready = !!di && !!w && !!h && faceZ !== '' && !!insertW && !!progNum && !!speed && !!feed && (spindleMode === 'G97' || !!maxRpm)

  function handleGenerate() {
    onGenerate({
      faceZ, di, w, h, insertW, edgeType, method: narrower ? method : 'plunge',
      cI, cO, rtI, rtO, rbI, rbO, fDepth, fWall, peck, retract, dwell,
      progNum, toolNo, spindleMode, speed, maxRpm, feed, finishFeed, workOffset, safeZ,
    })
  }

  const num = (val: string, set: (v: string) => void, ph = '') => (
    <input style={input} type="number" step="any" value={val} placeholder={ph} onKeyDown={blockE} onChange={e => set(e.target.value)} />
  )
  const field = (l: string, el: React.ReactNode) => <div><label style={label}>{l}</label>{el}</div>
  const pair = (l: string, lv: string, ls: (v: string) => void, r: string, rv: string, rs: (v: string) => void) => (
    <>{field(l, num(lv, ls))}{field(r, num(rv, rs))}</>
  )
  const typeBtn = (tp: EdgeType, text: string) => (
    <button key={tp} onClick={() => setEdgeType(tp)}
      style={{ flex: '1 1 120px', padding: '10px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: edgeType === tp ? ORANGE : '#1c1b19', color: edgeType === tp ? '#fff' : '#bbb' }}>
      {text}
    </button>
  )
  const motion = useMemo(() => faceGrooveMotion({
    faceZ: pn(faceZ), di: parseFloat(di), w: parseFloat(w), h: parseFloat(h), insertW: parseFloat(insertW),
    edge: edgeType, method: narrower ? method : 'plunge',
    cI: pn(cI), cO: pn(cO), rtI: pn(rtI), rtO: pn(rtO), rbI: pn(rbI), rbO: pn(rbO),
    fDepth: pn(fDepth), fWall: pn(fWall), peck: parseFloat(peck), retract: pn(retract), safeZ: parseFloat(safeZ),
  }), [faceZ, di, w, h, insertW, edgeType, method, narrower, cI, cO, rtI, rtO, rbI, rbO, fDepth, fWall, peck, retract, safeZ])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={card}>
        <h3 style={{ color: '#fff', margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>Configure your face groove</h3>
        <p style={{ color: '#999', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>
          The groove is cut into the face of the part along Z. Give the inner groove diameter, the radial width and the depth. X is diameter. Press Play to watch the insert cut the groove.
        </p>

        <FaceGrooveAnim motion={motion} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginTop: 16 }}>
          {field('Inner groove diameter (Di)', num(di, setDi, 'e.g. 40'))}
          {field('Groove width (W, radial)', num(w, setW, 'e.g. 8'))}
          {field('Groove depth (Z)', num(h, setH, 'e.g. 6'))}
          {field('Face Z (top of the groove)', num(faceZ, setFaceZ))}
        </div>
        {doNote && <p style={{ color: '#9ad7b0', fontSize: 12.5, margin: '10px 0 0' }}>{doNote}</p>}

        <h4 style={{ color: '#fff', margin: '22px 0 10px', fontSize: 15 }}>Groove edges</h4>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
          {typeBtn('plain', 'Plain')}
          {typeBtn('1', 'Type 1 · Chamfer')}
          {typeBtn('2', 'Type 2 · Chamfer + Radius')}
          {typeBtn('3', 'Type 3 · Radius + Radius')}
        </div>
        {edgeType !== 'plain' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {(edgeType === '1' || edgeType === '2') && pair('Top chamfer C – inner wall', cI, setCI, 'Top chamfer C – outer wall', cO, setCO)}
            {edgeType === '3' && pair('Top radius R – inner wall', rtI, setRtI, 'Top radius R – outer wall', rtO, setRtO)}
            {hasBottom && pair('Bottom radius R1 – inner wall', rbI, setRbI, 'Bottom radius R1 – outer wall', rbO, setRbO)}
          </div>
        )}
        <p style={{ color: '#888', fontSize: 12, margin: '10px 0 0', lineHeight: 1.5 }}>
          The inner wall is the side nearest the centre, the outer wall is the side nearest the OD. Chamfer and radius are taken from the groove mouth, so Di and Do stay the wall positions.
        </p>
      </div>

      <div style={card}>
        <h4 style={{ color: '#fff', margin: '0 0 14px', fontSize: 16 }}>Insert and cutting method</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {field('Insert width', num(insertW, setInsertW, 'e.g. 3'))}
          {field('Tool No (T)', num(toolNo, setToolNo))}
        </div>
        {tooWide && <p style={{ color: '#ff6b6b', fontSize: 13, margin: '10px 0 0' }}>Insert is wider than the groove.</p>}
        {insertKnown && !tooWide && !narrower && <p style={{ color: '#9ad7b0', fontSize: 13, margin: '10px 0 0' }}>Insert equals the groove width, so the cycle is a single plunge.</p>}
        <p style={{ color: '#9ad7b0', fontSize: 12.5, margin: '10px 0 0', lineHeight: 1.5 }}>
          Tool point = the outer corner of the insert (the corner on the larger diameter). Set the tool offset on that corner.
        </p>

        {narrower && (
          <div style={{ marginTop: 16 }}>
            <label style={label}>The insert is narrower than the groove. How do you want to cut it?</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {([['plunge', 'Plunge only'], ['plungeturn', 'Plunge + Turn']] as const).map(([k, tx]) => (
                <button key={k} onClick={() => setMethod(k)}
                  style={{ flex: '1 1 160px', padding: 11, borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: method === k ? ORANGE : '#1c1b19', color: method === k ? '#fff' : '#bbb' }}>
                  {tx}
                </button>
              ))}
            </div>
            {bottomNeedsTurn && <p style={{ color: '#ffb84d', fontSize: 13, margin: '10px 0 0' }}>Bottom radius needs Plunge + Turn.</p>}
            {method === 'plungeturn' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
                {field('Finish allowance – groove bottom (Z)', num(fDepth, setFDepth))}
                {field('Finish allowance – groove walls (per wall)', num(fWall, setFWall))}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginTop: 16 }}>
          {field('Peck depth (Z)', num(peck, setPeck))}
          {field('Peck retract', num(retract, setRetract))}
          {field('Dwell (sec)', num(dwell, setDwell))}
        </div>
      </div>

      <div style={card}>
        <h4 style={{ color: '#fff', margin: '0 0 14px', fontSize: 16 }}>Machining Parameters</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {field('Program No', num(progNum, setProgNum))}
          <div>
            <label style={label}>Spindle Mode</label>
            <select style={input} value={spindleMode} onChange={e => setSpindleMode(e.target.value)}>
              <option value="G96">G96 - Constant Surface Speed</option>
              <option value="G97">G97 - Direct RPM</option>
            </select>
          </div>
          {field(spindleMode === 'G96' ? 'Surface Speed (m/min)' : 'Speed (RPM)', num(speed, setSpeed))}
          {spindleMode === 'G96' && field('Max Spindle RPM (G50)', num(maxRpm, setMaxRpm, 'e.g. 2000'))}
          {field('Feed (mm/rev)', num(feed, setFeed))}
          {field('Finish Feed (mm/rev, optional)', num(finishFeed, setFinishFeed, 'same as feed'))}
          <div>
            <label style={label}>Work Offset</label>
            <select style={input} value={workOffset} onChange={e => setWorkOffset(e.target.value)}>
              {['G54', 'G55', 'G56', 'G57', 'G58', 'G59'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          {field('Safe Z (above the face)', num(safeZ, setSafeZ))}
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
