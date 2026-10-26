'use client'
import { useMemo, useRef, useState } from 'react'
import { Bi } from './g71/Bi'
import SavedPrograms, { SavedProgramsHandle } from './g71/SavedPrograms'
import { LangProvider, LangSwitch, useT } from './g71/lang'

const label = { fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600, display: 'block' } as const
const input = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 12px', fontSize: 14 } as const
const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 24 } as const
const ORANGE = '#F0801E'
const GRAY = '#bdbab5'

type EdgeType = 'plain' | '1' | '2' | '3'
type Method = 'plunge' | 'plungeturn'
const blockE = (e: React.KeyboardEvent) => { if (e.key === 'e' || e.key === 'E') e.preventDefault() }
const fmt = (n: number) => String(Number(n.toFixed(3)))
const pn = (s: string) => { const n = parseFloat(s); return isNaN(n) ? 0 : n }

// Cross-section of the groove: face on the right, chuck on the left, centre line at the bottom.
function Sketch({ di, w, h, faceZ, edge, sI, sO, rbI, rbO, insertW }: {
  di: number; w: number; h: number; faceZ: number; edge: EdgeType; sI: number; sO: number; rbI: number; rbO: number; insertW: number
}) {
  const real = di > 0 && w > 0 && h > 0
  const Di = real ? di : 40, Wd = real ? w : 8, H = real ? h : 6
  const Do = Di + 2 * Wd
  const ri = Di / 2, ro = Do / 2, z0 = faceZ, zb = faceZ - H
  const W = 700, Ht = 330, pad = 28
  const rMin = Math.max(0, ri - 4.5), rMax = ro + 4.5
  const zMin = zb - 2.5, zMax = z0 + 6.5
  const k = Math.min((W - 2 * pad) / (zMax - zMin), (Ht - 2 * pad) / (rMax - rMin))
  const ox = (W - (zMax - zMin) * k) / 2
  const oy = Ht - (Ht - (rMax - rMin) * k) / 2
  const X = (z: number) => ox + (z - zMin) * k
  const Y = (r: number) => oy - (r - rMin) * k

  const top = edge === '1' || edge === '2' ? 'chamfer' : edge === '3' ? 'radius' : 'none'
  const bI = edge === '2' || edge === '3' ? rbI : 0
  const bO = edge === '2' || edge === '3' ? rbO : 0
  const eI = top === 'none' ? 0 : sI, eO = top === 'none' ? 0 : sO
  const pts: [number, number][] = []
  const arc = (cz: number, cr: number, rad: number, a0: number, a1: number, n = 14) => {
    for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; pts.push([cz + rad * Math.cos(a), cr + rad * Math.sin(a)]) }
  }
  if (eI > 0) { pts.push([z0, ri - eI]); if (top === 'chamfer') pts.push([z0 - eI, ri]); else arc(z0 - eI, ri - eI, eI, 0, Math.PI / 2) } else pts.push([z0, ri])
  if (bI > 0) { pts.push([zb + bI, ri]); arc(zb + bI, ri + bI, bI, -Math.PI / 2, -Math.PI) } else pts.push([zb, ri])
  if (bO > 0) { pts.push([zb, ro - bO]); arc(zb + bO, ro - bO, bO, Math.PI, Math.PI / 2) } else pts.push([zb, ro])
  if (eO > 0) { pts.push([z0 - eO, ro]); if (top === 'chamfer') pts.push([z0, ro + eO]); else arc(z0 - eO, ro + eO, eO, -Math.PI / 2, 0) } else pts.push([z0, ro])
  const groove = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(' ')
  const body = `M${X(zMin)},${Y(rMax)} H${X(z0)} V${Y(ro)} ${groove.replace(/^M[^L]*/, '')} V${Y(rMin)} H${X(zMin)} Z`
  const iw = insertW > 0 && insertW <= Wd + 1e-9 ? insertW : 0
  const ax = (x1: number, y1: number, x2: number, y2: number) => <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={ORANGE} strokeWidth="1.5" markerStart="url(#fg-a)" markerEnd="url(#fg-a)" />

  return (
    <svg viewBox={`0 0 ${W} ${Ht}`} style={{ width: '100%', display: 'block', background: '#1c1b19', borderRadius: 10, border: '1px solid #3a3733', opacity: real ? 1 : 0.55 }} aria-label="Face groove sketch">
      <defs><marker id="fg-a" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,1 L10,5 L0,9 z" fill={ORANGE} /></marker></defs>
      <path d={body} fill="#3a3733" opacity=".6" />
      <path d={groove} fill="none" stroke={GRAY} strokeWidth="2.4" />
      {iw > 0 && <rect x={X(zb)} y={Y(ri + iw)} width={(z0 + 8 - zb) * k} height={iw * k} fill="rgba(122,167,255,.3)" stroke="#7aa7ff" strokeDasharray="4 3" />}
      {iw > 0 && <circle cx={X(zb)} cy={Y(ri + iw)} r="3.5" fill="#fff" />}
      {rMin <= 0.01 && <line x1={X(zMin)} y1={Y(0)} x2={X(zMax)} y2={Y(0)} stroke="#6a655f" strokeDasharray="14 4 3 4" />}
      <line x1={X(z0)} y1={Y(rMax)} x2={X(z0)} y2={Y(rMin)} stroke="#6a655f" strokeDasharray="4 4" />
      {ax(X(z0) + 26, Y(ri), X(z0) + 26, Y(ro))}
      <text x={X(z0) + 34} y={(Y(ri) + Y(ro)) / 2 + 4} fill={ORANGE} fontSize="12" fontWeight="700">W = {fmt(Wd)}</text>
      {ax(X(zb) - 14, Y(ri), X(zb) - 14, Y(ro))}
      <text x={X(zb) - 20} y={Y(ro) - 8} fill="#ddd" fontSize="12" fontWeight="700" textAnchor="start">Do {fmt(Do)}</text>
      <text x={X(zb) - 20} y={Y(ri) + 18} fill="#ddd" fontSize="12" fontWeight="700">Di {fmt(Di)}</text>
      {ax(X(zb) + 40, Y(ri) - 20, X(z0) - 0.5, Y(ri) - 20)}
      <line x1={X(zb)} y1={Y(ri) - 24} x2={X(zb)} y2={Y(ri) - 6} stroke="#6a655f" strokeDasharray="2 3" />
      <text x={(X(zb) + X(z0)) / 2} y={Y(ri) - 28} fill={ORANGE} fontSize="12" fontWeight="700" textAnchor="middle">depth = {fmt(H)}</text>
      <text x={X(z0) + 6} y={20} fill="#8a8782" fontSize="12">face</text>
      <text x={X(zMin) + 6} y={20} fill="#8a8782" fontSize="12">◄ chuck</text>
    </svg>
  )
}

export default function FaceGrooveTool(props: {
  onGenerate: (values: Record<string, string>) => void
  busy: boolean
  error: string
}) {
  return <LangProvider><FaceGrooveInner {...props} /></LangProvider>
}

function FaceGrooveInner({ onGenerate, busy, error }: {
  onGenerate: (values: Record<string, string>) => void
  busy: boolean
  error: string
}) {
  const t = useT()
  const saveRef = useRef<SavedProgramsHandle>(null)
  const [gate, setGate] = useState<null | { hasCurrent: boolean; name: string }>(null)
  const [gateName, setGateName] = useState('')
  const [gateErr, setGateErr] = useState<[string, string] | null>(null)
  const [gateBusy, setGateBusy] = useState(false)

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

  const snapshot = {
    v: 1, faceZ, di, w, h, edgeType, cI, cO, rtI, rtO, rbI, rbO, insertW, method, fDepth, fWall, peck, retract, dwell,
    progNum, toolNo, spindleMode, speed, maxRpm, feed, finishFeed, workOffset, safeZ,
  }

  function applyData(raw: unknown) {
    const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const str = (k: string, def: string) => (typeof d[k] === 'string' ? (d[k] as string) : typeof d[k] === 'number' ? String(d[k]) : def)
    const inList = <T extends string>(v: unknown, list: readonly T[], def: T): T => (list.includes(v as T) ? (v as T) : def)
    setFaceZ(str('faceZ', '0')); setDi(str('di', '')); setW(str('w', '')); setH(str('h', ''))
    setEdgeType(inList(d.edgeType, ['plain', '1', '2', '3'] as const, 'plain'))
    setCI(str('cI', '')); setCO(str('cO', '')); setRtI(str('rtI', '')); setRtO(str('rtO', '')); setRbI(str('rbI', '')); setRbO(str('rbO', ''))
    setInsertW(str('insertW', '')); setMethod(inList(d.method, ['plunge', 'plungeturn'] as const, 'plungeturn'))
    setFDepth(str('fDepth', '0.1')); setFWall(str('fWall', '0.1'))
    setPeck(str('peck', '1')); setRetract(str('retract', '0.3')); setDwell(str('dwell', '0.5'))
    setProgNum(str('progNum', '')); setToolNo(str('toolNo', '3'))
    setSpindleMode(inList(d.spindleMode, ['G96', 'G97'] as const, 'G96'))
    setSpeed(str('speed', '')); setMaxRpm(str('maxRpm', '')); setFeed(str('feed', '')); setFinishFeed(str('finishFeed', ''))
    setWorkOffset(inList(d.workOffset, ['G54', 'G55', 'G56', 'G57', 'G58', 'G59'] as const, 'G54'))
    setSafeZ(str('safeZ', '5'))
  }

  function handleGenerate() {
    const st = saveRef.current?.state()
    if (st && st.available && (!st.hasCurrent || st.dirty)) {
      setGateName(st.name || ''); setGateErr(null); setGate({ hasCurrent: st.hasCurrent, name: st.name })
      return
    }
    runGenerate()
  }
  async function saveThenGenerate() {
    if (!gate) return
    setGateBusy(true); setGateErr(null)
    const r = gate.hasCurrent ? await saveRef.current?.saveCurrent() : await saveRef.current?.saveNew(gateName)
    setGateBusy(false)
    if (!r || !r.ok) { setGateErr(r?.error ?? ['Could not save', 'सेव नहीं हो सका']); return }
    setGate(null); runGenerate()
  }
  function runGenerate() {
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
  const sketch = useMemo(() => (
    <Sketch di={pn(di)} w={pn(w)} h={pn(h)} faceZ={pn(faceZ)} edge={edgeType}
      sI={edgeType === '3' ? pn(rtI) : pn(cI)} sO={edgeType === '3' ? pn(rtO) : pn(cO)} rbI={pn(rbI)} rbO={pn(rbO)} insertW={pn(insertW)} />
  ), [di, w, h, faceZ, edgeType, cI, cO, rtI, rtO, rbI, rbO, insertW])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <LangSwitch />
      <SavedPrograms ref={saveRef} cycleCode="FACE-GROOVE" snapshot={snapshot} onLoad={applyData} onNew={() => applyData({})} />

      <div style={card}>
        <h3 style={{ color: '#fff', margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>Configure your face groove</h3>
        <p style={{ color: '#999', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>
          <Bi en="The groove is cut into the face of the part along Z. Give the inner groove diameter, the radial width and the depth. X is diameter."
              hi="ग्रूव पार्ट के फेस में Z की दिशा में कटता है। अंदर का ग्रूव डायमीटर, रेडियल चौड़ाई और गहराई दें। X डायमीटर है।" />
        </p>

        {sketch}

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
          <Bi en="The inner wall is the side nearest the centre, the outer wall is the side nearest the OD. Chamfer and radius are taken from the groove mouth, so Di and Do stay the wall positions."
              hi="अंदर की दीवार सेंटर के सबसे पास वाली है, बाहर की दीवार OD के पास वाली। चैम्फर और रेडियस ग्रूव के मुँह से लिए जाते हैं, इसलिए Di और Do दीवारों की जगह ही रहते हैं।" />
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
          <Bi en="Tool point = the outer corner of the insert (the corner on the larger diameter). Set the tool offset on that corner."
              hi="टूल पॉइंट = इन्सर्ट का बाहरी कोना (बड़े डायमीटर वाला कोना)। टूल ऑफसेट इसी कोने पर सेट करें।" />
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

      {gate && (
        <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.65)', zIndex: 100, display: 'grid', placeItems: 'center', padding: 16 }}>
          <div style={{ background: '#2b2a28', border: `1px solid ${ORANGE}`, borderRadius: 14, padding: 24, maxWidth: 460, width: '100%' }}>
            <h4 style={{ color: '#fff', margin: '0 0 8px', fontSize: 18 }}>{t('Save before generating?', 'जनरेट करने से पहले सेव करें?')}</h4>
            <p style={{ color: '#ccc', fontSize: 14, lineHeight: 1.5, margin: '0 0 14px' }}>
              {gate.hasCurrent
                ? t(`You changed “${gate.name}” after the last save. Save the changes so you do not lose them.`, `“${gate.name}” में आख़िरी सेव के बाद बदलाव हुए हैं। उन्हें सेव कर लें ताकि खो न जाएँ।`)
                : t('This program is not saved yet. Give it a name to keep it for later.', 'यह प्रोग्राम अभी सेव नहीं हुआ है। बाद के लिए रखने हेतु इसे नाम दें।')}
            </p>
            {!gate.hasCurrent && (
              <input style={{ ...input, marginBottom: 12 }} maxLength={80} autoFocus value={gateName}
                placeholder={t('Program name (for example the part number)', 'प्रोग्राम का नाम (जैसे पार्ट नंबर)')}
                onChange={e => setGateName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && gateName.trim() && !gateBusy) saveThenGenerate() }} />
            )}
            {gateErr && <div style={{ color: '#ff8a8a', fontSize: 13, marginBottom: 12 }}>{t(gateErr[0], gateErr[1])}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={saveThenGenerate} disabled={gateBusy || (!gate.hasCurrent && !gateName.trim())}
                style={{ background: (gate.hasCurrent || gateName.trim()) ? ORANGE : '#4a4744', color: '#fff', border: 'none', borderRadius: 8, padding: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                {gateBusy ? t('Saving…', 'सेव हो रहा है…') : gate.hasCurrent ? t('Save changes and generate', 'बदलाव सेव करके जनरेट करें') : t('Save and generate', 'सेव करके जनरेट करें')}
              </button>
              <button onClick={() => { setGate(null); runGenerate() }} disabled={gateBusy}
                style={{ background: 'transparent', color: '#ddd', border: '1px solid #3a3733', borderRadius: 8, padding: 11, fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>
                {t('Generate without saving', 'बिना सेव किए जनरेट करें')}
              </button>
              <button onClick={() => setGate(null)} disabled={gateBusy}
                style={{ background: 'transparent', color: '#999', border: 'none', padding: 8, fontSize: 13, cursor: 'pointer' }}>
                {t('Cancel', 'रद्द करें')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
