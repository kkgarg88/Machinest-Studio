'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildProfile, sampleProfile, fmt, InPoint, SegType, ProfileResult } from '@/lib/cycles/g71-geometry'
import { Bi } from './g71/Bi'
import MachinePicker, { Machine, Comp } from './g71/MachinePicker'
import ToolTypePicker from './g71/ToolTypePicker'
import SavedPrograms, { SavedProgramsHandle } from './g71/SavedPrograms'
import { LangProvider, LangSwitch, useT } from './g71/lang'

const label = { fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600, display: 'block' } as const
const input = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 12px', fontSize: 14 } as const
const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 24 } as const
const ORANGE = '#F0801E'
const SPARK = '#FFB34D'

type Row = { type: SegType; x: string; z: string; r: string }

// Same part as the earlier example: taper, cylinder, inside radius R2 (G02), shoulder, 45 degree chamfer, cylinder
const EXAMPLE: Row[] = [
  { type: 'line', x: '12', z: '0', r: '' },
  { type: 'line', x: '20', z: '-10', r: '' },
  { type: 'line', x: '20', z: '-23', r: '' },
  { type: 'g02', x: '24', z: '-25', r: '2' },
  { type: 'line', x: '28', z: '-25', r: '' },
  { type: 'line', x: '28', z: '-39', r: '' },
  { type: 'line', x: '30', z: '-40', r: '' },
  { type: 'line', x: '30', z: '-50', r: '' },
]

const blankRow = (): Row => ({ type: 'line', x: '', z: '', r: '' })
const blockE = (e: React.KeyboardEvent) => { if (e.key === 'e' || e.key === 'E') e.preventDefault() }

// Rows that are complete, up to the first incomplete one, so the sketch grows while the user types
function completePrefix(rows: Row[]): InPoint[] {
  const out: InPoint[] = []
  for (let i = 0; i < rows.length; i++) {
    const x = parseFloat(rows[i].x), z = parseFloat(rows[i].z), r = parseFloat(rows[i].r)
    if (isNaN(x) || isNaN(z)) break
    if (i > 0 && rows[i].type !== 'line' && !(r > 0)) break
    out.push({ x, z, type: i === 0 ? 'line' : rows[i].type, r: rows[i].type === 'line' || isNaN(r) ? 0 : r })
  }
  return out
}

function Sketch({ pts, res, stock, depth, allowX, passes, compact }: {
  pts: InPoint[]; res: ProfileResult; stock: number; depth: number; allowX: number; passes: boolean; compact: boolean
}) {
  const W = 700, H = 300, pad = 34
  if (pts.length < 2) {
    return (
      <div style={{ background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 10, color: '#777', fontSize: 14, padding: '70px 20px', textAlign: 'center' }}>
        Enter the start point and the end point of the first segment to see the profile.
      </div>
    )
  }
  const stockOk = !isNaN(stock) && stock > 0
  const maxX = Math.max(...pts.map(p => p.x), stockOk ? stock : 0)
  const zs = pts.map(p => p.z)
  const zMax = Math.max(...zs), zMin = Math.min(...zs)
  const zSpan = Math.max(zMax - zMin, 1)
  const rSpan = Math.max(maxX / 2, 1)
  const k = Math.min((W - 2 * pad) / zSpan, (H - 2 * pad) / rSpan)
  const ox = pad + ((W - 2 * pad) - zSpan * k) / 2
  const oy = H - pad
  const X = (z: number) => ox + (z - zMin) * k
  const Y = (r: number) => oy - r * k

  const sp = res.ok ? sampleProfile(res.start, res.segs) : pts.map(p => ({ z: p.z, r: p.x / 2 }))
  const path = sp.map((p, i) => `${i ? 'L' : 'M'}${X(p.z).toFixed(1)},${Y(p.r).toFixed(1)}`).join(' ')

  // roughing passes: a pass at radius r stops where the profile (plus the allowance) reaches r
  const lines: { r: number; zEnd: number }[] = []
  const ax = isNaN(allowX) ? 0 : allowX
  if (passes && res.ok && stockOk && depth > 0) {
    const minR = sp.reduce((m, p) => Math.min(m, p.r), 1e9) + ax / 2
    let idx = 0
    for (let r = stock / 2 - depth; r >= Math.max(minR, 0) - 1e-9 && idx < 40; r -= depth, idx++) {
      let zEnd = zMin
      for (let i = 1; i < sp.length; i++) {
        const a = sp[i - 1], b = sp[i]
        if (a.r >= r - ax / 2) { zEnd = a.z; break }
        if (b.r >= r - ax / 2) { const t = (r - ax / 2 - a.r) / ((b.r - a.r) || 1); zEnd = a.z + (b.z - a.z) * t; break }
      }
      lines.push({ r, zEnd })
    }
  }

  // labels for arcs (G02 / G03 and R) at the middle of each arc
  const arcLabels: { x: number; y: number; t: string }[] = []
  if (res.ok) {
    let cz = res.start.z, cr = res.start.x / 2
    for (const s of res.segs) {
      if (s.kind === 'arc') {
        const oz = s.cz, or = s.cx / 2
        const a0 = Math.atan2(cr - or, cz - oz)
        const mid = a0 + ((s.sweep / 180) * Math.PI * (s.ccw ? 1 : -1)) / 2
        const mx = X(oz + s.r * Math.cos(mid)), my = Y(or + s.r * Math.sin(mid))
        arcLabels.push({ x: mx + Math.cos(mid) * 20, y: my - Math.sin(mid) * 14 + 4, t: `${s.ccw ? 'G03' : 'G02'} R${fmt(s.r)}` })
      }
      cz = s.z; cr = s.x / 2
    }
  }

  const firstPassR = stockOk && depth > 0 ? stock / 2 - depth : null
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxHeight: compact ? 230 : undefined, display: 'block', background: '#1c1b19', borderRadius: 10, border: '1px solid #3a3733' }}>
      {stockOk && (
        <rect x={X(zMin)} y={Y(stock / 2)} width={zSpan * k} height={(stock / 2) * k} fill="rgba(240,128,30,.07)" stroke="#8a8782" strokeDasharray="5 4" />
      )}
      <line x1={pad - 10} y1={oy} x2={W - pad + 10} y2={oy} stroke="#6a655f" strokeDasharray="14 4 3 4" />
      {lines.map((l, i) => (
        <line key={i} x1={X(zMax)} y1={Y(l.r)} x2={X(l.zEnd)} y2={Y(l.r)} stroke={SPARK} strokeWidth="1.4" strokeDasharray="6 5" opacity=".75" />
      ))}
      <path d={path} fill="none" stroke={res.ok ? ORANGE : '#ff6b6b'} strokeWidth="2.8" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={X(p.z)} cy={Y(p.x / 2)} r="3.8" fill="#fff" stroke="#111" />
          <text x={X(p.z) + 6} y={Y(p.x / 2) - 6} fill="#ddd" fontSize="11" fontWeight="700">{i + 1}</text>
        </g>
      ))}
      {arcLabels.map((a, i) => (
        <text key={i} x={a.x} y={a.y} fill={SPARK} fontSize="11" fontWeight="700" textAnchor="middle">{a.t}</text>
      ))}
      {lines.length > 0 && firstPassR !== null && (
        <circle r="5" cy={Y(firstPassR)} fill={SPARK}>
          <animate attributeName="cx" values={`${X(zMax)};${X(zMin)};${X(zMax)}`} dur="5s" repeatCount="indefinite" />
        </circle>
      )}
      <text x={W - pad} y={18} fill="#8a8782" fontSize="12" textAnchor="end">Z-  towards chuck  ◄</text>
      <text x={pad - 10} y={18} fill="#8a8782" fontSize="12">dashed box = stock · dashed lines = rough passes</text>
    </svg>
  )
}

export default function G71Tool(props: {
  onGenerate: (values: Record<string, string>) => void
  busy: boolean
  error: string
}) {
  return <LangProvider><G71Inner {...props} /></LangProvider>
}

function G71Inner({ onGenerate, busy, error }: {
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
  const [rows, setRows] = useState<Row[]>([blankRow(), blankRow()])
  const [stock, setStock] = useState('')
  const [depth, setDepth] = useState('')
  const [retract, setRetract] = useState('0.5')
  const [allowX, setAllowX] = useState('0.4')
  const [allowZ, setAllowZ] = useState('0.1')
  const [showPasses, setShowPasses] = useState(true)
  const [pinSketch, setPinSketch] = useState(true)
  const [useFinish, setUseFinish] = useState(true)
  const [comp, setComp] = useState<Comp>('none')
  const [machine, setMachine] = useState<Machine>('')
  const [noseR, setNoseR] = useState('0.4')
  const [toolType, setToolType] = useState('3')
  const [progNum, setProgNum] = useState('')
  const [toolRough, setToolRough] = useState('1')
  const [toolFinish, setToolFinish] = useState('2')
  const [spindleMode, setSpindleMode] = useState('G96')
  const [speed, setSpeed] = useState('')
  const [speedFinish, setSpeedFinish] = useState('')
  const [maxRpm, setMaxRpm] = useState('')
  const [feed, setFeed] = useState('')
  const [feedFinish, setFeedFinish] = useState('')
  const [workOffset, setWorkOffset] = useState('G54')
  const [safeX, setSafeX] = useState('2')
  const [safeZ, setSafeZ] = useState('2')

  // the machine type is remembered in this browser, so the user answers only once
  useEffect(() => {
    try {
      const m = localStorage.getItem('ms_machine')
      if (m === 'rear' || m === 'front' || m === 'other') setMachine(m)
    } catch {}
  }, [])
  function pickMachine(m: 'rear' | 'front' | 'other') {
    setMachine(m)
    try { localStorage.setItem('ms_machine', m) } catch {}
    if (m === 'rear') { setComp('g42'); setToolType('3') }
    if (m === 'front') { setComp('g41'); setToolType('3') }
  }

  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)))
  const insertAfter = (i: number) => rows.length < 40 && setRows([...rows.slice(0, i + 1), blankRow(), ...rows.slice(i + 1)])
  const remove = (i: number) => rows.length > 2 && setRows(rows.filter((_, k) => k !== i))
  const move = (i: number, dir: 1 | -1) => {
    const j = i + dir
    if (i < 1 || j < 1 || j >= rows.length) return
    const next = [...rows]; [next[i], next[j]] = [next[j], next[i]]
    setRows(next)
  }

  const pts = useMemo(() => completePrefix(rows), [rows])
  const res = useMemo(() => buildProfile(pts), [pts])
  const stockN = parseFloat(stock)

  const warnings: string[] = []
  if (pts.length >= 2 && !res.ok) warnings.push(res.error)
  if (!isNaN(stockN)) {
    const k = pts.findIndex(p => p.x > stockN + 1e-6)
    if (k >= 0) warnings.push(`Point ${k + 1}: X ${fmt(pts[k].x)} is larger than the stock diameter ${fmt(stockN)}`)
  }

  const complete = rows.every((r, i) => r.x !== '' && r.z !== '' && (i === 0 || r.type === 'line' || r.r !== ''))
  const ready = complete && rows.length >= 2 && !!stock && !!depth && !!progNum && !!feed && !!speed
    && (spindleMode === 'G97' || !!maxRpm) && (!useFinish || !!feedFinish)

  const num = (val: string, set: (v: string) => void, ph = '') => (
    <input style={input} type="number" step="any" value={val} placeholder={ph} onKeyDown={blockE} onChange={e => set(e.target.value)} />
  )
  const field = (l: string, el: React.ReactNode) => <div><label style={label}>{l}</label>{el}</div>
  const small = { ...input, padding: '9px 10px' } as const

  // everything the user typed, so a program can be saved and loaded again
  const snapshot = {
    v: 1, rows, stock, depth, retract, allowX, allowZ, useFinish, comp, machine, noseR, toolType,
    progNum, toolRough, toolFinish, spindleMode, speed, speedFinish, maxRpm, feed, feedFinish, workOffset, safeX, safeZ,
  }

  function applyData(raw: unknown) {
    const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const str = (k: string, def: string) => (typeof d[k] === 'string' ? (d[k] as string) : typeof d[k] === 'number' ? String(d[k]) : def)
    const inList = <T extends string>(v: unknown, list: readonly T[], def: T): T => (list.includes(v as T) ? (v as T) : def)
    let r: Row[] = [blankRow(), blankRow()]
    if (Array.isArray(d.rows) && d.rows.length >= 2 && d.rows.length <= 40) {
      r = d.rows.map((x: unknown) => {
        const o = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>
        return {
          type: inList(o.type, ['line', 'g02', 'g03'] as const, 'line'),
          x: typeof o.x === 'string' ? o.x : '', z: typeof o.z === 'string' ? o.z : '', r: typeof o.r === 'string' ? o.r : '',
        }
      })
    }
    setRows(r)
    setStock(str('stock', '')); setDepth(str('depth', '')); setRetract(str('retract', '0.5'))
    setAllowX(str('allowX', '0.4')); setAllowZ(str('allowZ', '0.1'))
    setUseFinish(d.useFinish === false ? false : true)
    setComp(inList(d.comp, ['none', 'g41', 'g42'] as const, 'none'))
    setMachine(inList(d.machine, ['', 'rear', 'front', 'other'] as const, ''))
    setNoseR(str('noseR', '0.4')); setToolType(str('toolType', '3'))
    setProgNum(str('progNum', '')); setToolRough(str('toolRough', '1')); setToolFinish(str('toolFinish', '2'))
    setSpindleMode(inList(d.spindleMode, ['G96', 'G97'] as const, 'G96'))
    setSpeed(str('speed', '')); setSpeedFinish(str('speedFinish', '')); setMaxRpm(str('maxRpm', ''))
    setFeed(str('feed', '')); setFeedFinish(str('feedFinish', ''))
    setWorkOffset(inList(d.workOffset, ['G54', 'G55', 'G56', 'G57', 'G58', 'G59'] as const, 'G54'))
    setSafeX(str('safeX', '2')); setSafeZ(str('safeZ', '2'))
  }

  // Generate: if the program has changes that are not saved, ask first so nothing is forgotten
  function handleGenerate() {
    const st = saveRef.current?.state()
    if (st && st.available && (!st.hasCurrent || st.dirty)) {
      setGateName(st.name || '')
      setGateErr(null)
      setGate({ hasCurrent: st.hasCurrent, name: st.name })
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
    setGate(null)
    runGenerate()
  }

  function runGenerate() {
    onGenerate({
      points: JSON.stringify(rows.map((r, i) => ({ type: i === 0 ? 'line' : r.type, x: r.x, z: r.z, r: r.type === 'line' ? '' : r.r }))),
      stock, depth, retract, allowX, allowZ,
      useFinish: useFinish ? '1' : '0', comp, noseR, tipNo: toolType, progNum, toolRough, toolFinish,
      spindleMode, speed, speedFinish, maxRpm, feed, feedFinish, workOffset, safeX, safeZ,
    })
  }

  const ib = { background: 'transparent', border: '1px solid #3a3733', color: '#ccc', borderRadius: 6, width: 30, height: 30, cursor: 'pointer', fontSize: 13 } as const
  const seg = { border: '1px solid #3a3733', borderLeft: `4px solid ${ORANGE}`, borderRadius: 10, padding: 12, marginBottom: 12, background: '#222120' } as const
  const badge = { background: ORANGE, color: '#171513', borderRadius: '50%', width: 24, height: 24, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, flex: '0 0 auto' } as const

  const TYPES: { t: SegType; name: string; tip: string }[] = [
    { t: 'line', name: 'Line G01', tip: 'Straight line (cylinder, taper, face, chamfer)' },
    { t: 'g02', name: 'Arc G02 ↻', tip: 'Clockwise arc' },
    { t: 'g03', name: 'Arc G03 ↺', tip: 'Counter-clockwise arc' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`
        .g71-pin{position:sticky;top:8px;z-index:5;background:#2b2a28;padding:0 0 12px;margin-bottom:6px}
        @media (max-width: 900px){.g71-pin{position:static}}
      `}</style>

      <LangSwitch />
      <SavedPrograms ref={saveRef} cycleCode="G71" snapshot={snapshot} onLoad={applyData} onNew={() => applyData({})} />

      <div style={card}>
        <h3 style={{ color: '#fff', margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>Rough Turning profile (G71)</h3>
        <p style={{ color: '#999', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>
          <Bi en="Give the start point and then the end point of every segment, exactly as on the drawing. X is diameter, Z is negative towards the chuck."
              hi="ड्रॉइंग के अनुसार पहले स्टार्ट पॉइंट दें, फिर हर सेगमेंट का एंड पॉइंट दें। X डायमीटर है, चक की तरफ Z माइनस में जाता है।" />
        </p>
        <h4 style={{ color: '#fff', margin: '0 0 12px', fontSize: 16 }}>Stock and roughing</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
          {field('Stock diameter', num(stock, setStock, 'e.g. 30'))}
          {field('Depth of cut (radial)', num(depth, setDepth, 'e.g. 2'))}
          {field('Retract (radial)', num(retract, setRetract))}
          {field('Finish allowance X (dia)', num(allowX, setAllowX))}
          {field('Finish allowance Z', num(allowZ, setAllowZ))}
        </div>
      </div>

      <div style={card}>
        <h4 style={{ color: '#fff', margin: '0 0 12px', fontSize: 16 }}>Build the profile (from the face to the chuck)</h4>

        <div className={pinSketch ? 'g71-pin' : undefined} style={pinSketch ? undefined : { marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', margin: '0 0 8px' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Live sketch</span>
            <span style={{ flex: 1 }} />
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: '#ddd', fontSize: 12.5, cursor: 'pointer' }}>
              <input type="checkbox" checked={showPasses} onChange={e => setShowPasses(e.target.checked)} /> show roughing passes
            </label>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center', color: '#ddd', fontSize: 12.5, cursor: 'pointer' }}>
              <input type="checkbox" checked={pinSketch} onChange={e => setPinSketch(e.target.checked)} /> keep sketch in view
            </label>
          </div>
          <Sketch pts={pts} res={res} stock={stockN} depth={parseFloat(depth)} allowX={parseFloat(allowX)} passes={showPasses} compact={pinSketch} />
          {warnings.length > 0 && (
            <div style={{ color: '#ff8a8a', fontSize: 13, margin: '8px 0 0' }}>
              {warnings.map((w, i) => <div key={i}>{w}</div>)}
            </div>
          )}
        </div>

        {rows.map((r, i) => {
          const s = res.ok && i >= 1 ? res.segs[i - 1] : undefined
          const arc = i > 0 && r.type !== 'line'
          return (
            <div key={i} data-seg={i} style={seg}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={badge}>{i + 1}</span>
                <b style={{ color: '#fff', fontSize: 14 }}>{i === 0 ? 'Start point' : 'Next point'}</b>
                <span style={{ color: '#888', fontSize: 12 }}>{i === 0 ? t('(usually on the face, Z0)', '(आमतौर पर फेस पर, Z0)') : ''}</span>
                <span style={{ flex: 1 }} />
                {i > 0 && (
                  <>
                    <button style={ib} title="Move up" aria-label="Move up" onClick={() => move(i, -1)} disabled={i < 2}>↑</button>
                    <button style={ib} title="Move down" aria-label="Move down" onClick={() => move(i, 1)} disabled={i >= rows.length - 1}>↓</button>
                  </>
                )}
                <button style={ib} title="Add a point below" aria-label="Add a point below" onClick={() => insertAfter(i)}>＋</button>
                {i > 0 && (
                  <button style={{ ...ib, color: rows.length > 2 ? '#ff8a8a' : '#555' }} title="Remove" aria-label="Remove point" onClick={() => remove(i)} disabled={rows.length <= 2}>✕</button>
                )}
              </div>

              {i > 0 && (
                <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  {TYPES.map(t => (
                    <button key={t.t} title={t.tip} onClick={() => setRow(i, { type: t.t })}
                      style={{ flex: '1 1 110px', padding: 9, borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: r.type === t.t ? ORANGE : '#1c1b19', color: r.type === t.t ? '#fff' : '#bbb' }}>
                      {t.name}
                    </button>
                  ))}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: arc ? '1fr 1fr 1fr' : '1fr 1fr', gap: 10 }}>
                <div><label style={{ ...label, fontSize: 12 }}>{i === 0 ? 'X start (dia)' : 'X end (dia)'}</label>
                  <input style={small} type="number" step="any" value={r.x} onKeyDown={blockE} onChange={e => setRow(i, { x: e.target.value })} /></div>
                <div><label style={{ ...label, fontSize: 12 }}>{i === 0 ? 'Z start' : 'Z end'}</label>
                  <input style={small} type="number" step="any" value={r.z} onKeyDown={blockE} onChange={e => setRow(i, { z: e.target.value })} /></div>
                {arc && (
                  <div><label style={{ ...label, fontSize: 12 }}>Radius R</label>
                    <input style={small} type="number" step="any" min="0" value={r.r} onKeyDown={blockE} onChange={e => setRow(i, { r: e.target.value })} /></div>
                )}
              </div>

              {s && s.kind === 'line' && (
                <div style={{ color: '#9ad7b0', fontSize: 12, marginTop: 8 }}>
                  {t(`Angle ${fmt(s.angle)}° to the Z axis · length ${fmt(s.len)}`, `एंगल ${fmt(s.angle)}° (Z अक्ष से) · लंबाई ${fmt(s.len)}`)}
                </div>
              )}
              {s && s.kind === 'arc' && (
                <div style={{ color: '#9ad7b0', fontSize: 12, marginTop: 8 }}>
                  {s.ccw ? 'G03' : 'G02'} · {t(`sweep ${fmt(s.sweep)}° · centre X${fmt(s.cx)} Z${fmt(s.cz)}`, `स्वीप ${fmt(s.sweep)}° · सेंटर X${fmt(s.cx)} Z${fmt(s.cz)}`)}
                </div>
              )}
            </div>
          )
        })}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '6px 0 12px' }}>
          <button onClick={() => rows.length < 40 && setRows([...rows, blankRow()])}
            style={{ background: 'transparent', color: ORANGE, border: `1px solid ${ORANGE}`, borderRadius: 8, padding: '9px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>＋ Add point</button>
          <button onClick={() => { setRows(EXAMPLE); setStock('30'); setDepth(d => d || '2') }}
            style={{ background: 'transparent', color: '#bbb', border: '1px solid #3a3733', borderRadius: 8, padding: '9px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Load example</button>
        </div>
        <p style={{ color: '#888', fontSize: 12, margin: 0, lineHeight: 1.5 }}>
          <Bi en="Every segment starts where the one before it ended. A chamfer is simply a line between its two end points, so any angle works. For an arc give its end point, R and the direction: an outside (convex) corner is G03 and an inside (concave) corner is G02. Diameter must not get smaller towards the chuck and Z must keep going towards the chuck (G71 Type I). Grooves are cut with the OD Groove cycle."
              hi="हर सेगमेंट वहीं से शुरू होता है जहाँ पिछला खत्म हुआ। चैम्फर बस उसके दो एंड पॉइंट के बीच की लाइन है, इसलिए कोई भी एंगल बन सकता है। आर्क के लिए उसका एंड पॉइंट, R और दिशा दें: बाहरी (कॉन्वेक्स) कोना G03 और अंदर का (कॉन्केव) कोना G02 है। चक की तरफ डायमीटर छोटा नहीं होना चाहिए और Z लगातार चक की तरफ ही जाना चाहिए (G71 टाइप I)। ग्रूव के लिए OD Groove साइकिल इस्तेमाल करें।" />
        </p>
      </div>

      <div style={card}>
        <h4 style={{ color: '#fff', margin: '0 0 12px', fontSize: 16 }}>Finishing</h4>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#ddd', fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
          <input type="checkbox" checked={useFinish} onChange={e => { setUseFinish(e.target.checked); if (!e.target.checked) setComp('none') }} />
          Add G70 finish pass
        </label>
        {useFinish && (
          <>
            <MachinePicker machine={machine} comp={comp} onMachine={pickMachine} onComp={setComp} />
            {comp !== 'none' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                  {field(t('Nose radius', 'नोज़ रेडियस'), num(noseR, setNoseR))}
                  <div>
                    <label style={label}>{t('Tool type', 'टूल टाइप')}</label>
                    <ToolTypePicker value={toolType} onChange={setToolType} />
                  </div>
                </div>
                <p style={{ color: '#9ad7b0', fontSize: 12.5, margin: '10px 0 0', lineHeight: 1.5 }}>
                  <Bi en="The program will have a comment telling the operator to enter this nose radius and tool type in the finish tool offset."
                      hi="प्रोग्राम में एक कमेंट होगा जो ऑपरेटर को बताएगा कि फिनिश टूल ऑफसेट में यह नोज़ रेडियस और टूल टाइप डालें।" hiColor="#9ad7b0" />
                </p>
                <p style={{ color: '#8a8782', fontSize: 12, margin: '8px 0 0', lineHeight: 1.5 }}>
                  <span style={{ color: '#ff7a7a' }}>●</span> {t('programmed tip (P)', 'प्रोग्राम किया गया टिप (P)')} &nbsp; <span style={{ color: '#7aa7ff' }}>●</span> {t('centre of the nose radius (C)', 'नोज़ रेडियस का सेंटर (C)')}
                </p>
              </>
            )}
          </>
        )}
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
          {field('Roughing Tool No (T)', num(toolRough, setToolRough))}
          {useFinish && field('Finishing Tool No (T)', num(toolFinish, setToolFinish))}
          {field(spindleMode === 'G96' ? 'Rough Surface Speed (m/min)' : 'Rough Speed (RPM)', num(speed, setSpeed))}
          {useFinish && field(spindleMode === 'G96' ? 'Finish Surface Speed (optional)' : 'Finish Speed (optional)', num(speedFinish, setSpeedFinish, 'same as rough'))}
          {spindleMode === 'G96' && field('Max Spindle RPM (G50)', num(maxRpm, setMaxRpm, 'e.g. 2500'))}
          {field('Rough Feed (mm/rev)', num(feed, setFeed))}
          {useFinish && field('Finish Feed (mm/rev)', num(feedFinish, setFeedFinish))}
          <div>
            <label style={label}>Work Offset</label>
            <select style={input} value={workOffset} onChange={e => setWorkOffset(e.target.value)}>
              {['G54', 'G55', 'G56', 'G57', 'G58', 'G59'].map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>{field('Safe X', num(safeX, setSafeX))}</div>
            <div style={{ flex: 1 }}>{field('Safe Z', num(safeZ, setSafeZ))}</div>
          </div>
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
