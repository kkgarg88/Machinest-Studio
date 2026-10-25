'use client'
import { useMemo, useState } from 'react'
import { buildProfile, sampleProfile, ProfilePoint, Corner } from '@/lib/cycles/g71-geometry'

const label = { fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600, display: 'block' } as const
const input = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 12px', fontSize: 14 } as const
const cellInput = { ...input, padding: '8px 8px', fontSize: 14, textAlign: 'center' } as const
const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 24 } as const
const ORANGE = '#F0801E'

type Row = { x: string; z: string; corner: Corner; size: string }
const EXAMPLE: Row[] = [
  { x: '12', z: '0', corner: 'sharp', size: '' },
  { x: '20', z: '-10', corner: 'sharp', size: '' },
  { x: '20', z: '-25', corner: 'radius', size: '2' },
  { x: '28', z: '-25', corner: 'sharp', size: '' },
  { x: '28', z: '-40', corner: 'chamfer', size: '1' },
  { x: '30', z: '-40', corner: 'sharp', size: '' },
  { x: '30', z: '-50', corner: 'sharp', size: '' },
]

function Preview({ rows, stock }: { rows: Row[]; stock: string }) {
  const parsed = useMemo(() => {
    const pts: ProfilePoint[] = []
    for (const r of rows) {
      const x = parseFloat(r.x), z = parseFloat(r.z)
      if (isNaN(x) || isNaN(z)) return { err: '', pts: null as ProfilePoint[] | null }
      pts.push({ x, z, corner: r.corner, size: parseFloat(r.size) || 0 })
    }
    return { err: '', pts }
  }, [rows])

  const W = 640, H = 300, pad = 36
  if (!parsed.pts || parsed.pts.length < 2) {
    return <div style={{ color: '#777', fontSize: 14, padding: '40px 0', textAlign: 'center' }}>Add at least 2 points with X and Z to see the profile.</div>
  }
  const res = buildProfile(parsed.pts)
  const st = parseFloat(stock)
  const maxX = Math.max(...parsed.pts.map(p => p.x), isNaN(st) ? 0 : st)
  const zs = parsed.pts.map(p => p.z)
  const zMax = Math.max(...zs), zMin = Math.min(...zs)
  const zSpan = Math.max(zMax - zMin, 1), rSpan = Math.max(maxX / 2, 1)
  const k = Math.min((W - 2 * pad) / zSpan, (H - 2 * pad) / rSpan)
  const ox = pad + ((W - 2 * pad) - zSpan * k) / 2
  const oy = H - pad
  const sx = (z: number) => ox + (z - zMin) * k
  const sy = (r: number) => oy - r * k

  let path = ''
  if (res.ok) {
    const sp = sampleProfile(res.start, res.segs)
    path = sp.map((p, i) => `${i ? 'L' : 'M'}${sx(p.z).toFixed(1)},${sy(p.r).toFixed(1)}`).join(' ')
  } else {
    path = parsed.pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.z).toFixed(1)},${sy(p.x / 2).toFixed(1)}`).join(' ')
  }
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', background: '#1c1b19', borderRadius: 10, border: '1px solid #3a3733' }}>
        {!isNaN(st) && st > 0 && (
          <rect x={sx(zMin)} y={sy(st / 2)} width={zSpan * k} height={(st / 2) * k} fill="rgba(240,128,30,.07)" stroke="#8a8782" strokeDasharray="5 4" />
        )}
        <line x1={pad - 10} y1={oy} x2={W - pad + 10} y2={oy} stroke="#6a655f" strokeDasharray="14 4 3 4" />
        <path d={path} fill="none" stroke={res.ok ? ORANGE : '#ff6b6b'} strokeWidth="2.6" strokeLinejoin="round" />
        {parsed.pts.map((p, i) => (
          <g key={i}>
            <circle cx={sx(p.z)} cy={sy(p.x / 2)} r="4.5" fill="#fff" stroke="#111" />
            <text x={sx(p.z) + 7} y={sy(p.x / 2) - 7} fill="#ddd" fontSize="12" fontWeight="700">{i + 1}</text>
          </g>
        ))}
        <text x={W - pad} y={18} fill="#8a8782" fontSize="12" textAnchor="end">Z-  towards chuck  ◄</text>
        <text x={pad - 10} y={18} fill="#8a8782" fontSize="12">dashed = stock</text>
      </svg>
      {!res.ok && <p style={{ color: '#ff6b6b', fontSize: 13, margin: '10px 0 0' }}>{res.error}</p>}
    </div>
  )
}

export default function G71Tool({ onGenerate, busy, error }: {
  onGenerate: (values: Record<string, string>) => void
  busy: boolean
  error: string
}) {
  const [rows, setRows] = useState<Row[]>([
    { x: '', z: '', corner: 'sharp', size: '' },
    { x: '', z: '', corner: 'sharp', size: '' },
  ])
  const [stock, setStock] = useState('')
  const [depth, setDepth] = useState('')
  const [retract, setRetract] = useState('0.5')
  const [allowX, setAllowX] = useState('0.4')
  const [allowZ, setAllowZ] = useState('0.1')
  const [useFinish, setUseFinish] = useState(true)
  const [comp, setComp] = useState<'none' | 'g42'>('none')
  const [noseR, setNoseR] = useState('0.4')
  const [tipNo, setTipNo] = useState('3')
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

  const setRow = (i: number, patch: Partial<Row>) => setRows(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)))
  const filled = rows.every(r => r.x !== '' && r.z !== '')
  const ready = filled && rows.length >= 2 && !!stock && !!depth && !!progNum && !!feed && !!speed && (spindleMode === 'G97' || !!maxRpm) && (!useFinish || !!feedFinish)

  const num = (val: string, set: (v: string) => void, ph = '') => (
    <input style={input} type="number" step="any" value={val} placeholder={ph}
      onKeyDown={e => { if (e.key === 'e' || e.key === 'E') e.preventDefault() }}
      onChange={e => set(e.target.value)} />
  )
  const field = (l: string, el: React.ReactNode) => <div><label style={label}>{l}</label>{el}</div>

  function handleGenerate() {
    onGenerate({
      points: JSON.stringify(rows), stock, depth, retract, allowX, allowZ,
      useFinish: useFinish ? '1' : '0', comp, noseR, tipNo, progNum, toolRough, toolFinish,
      spindleMode, speed, speedFinish, maxRpm, feed, feedFinish, workOffset, safeX, safeZ,
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={card}>
        <h3 style={{ color: '#fff', margin: '0 0 4px', fontSize: 20, fontWeight: 800 }}>Rough Turning profile (G71)</h3>
        <p style={{ color: '#999', fontSize: 13, margin: '0 0 16px' }}>
          Enter the finished profile point by point, from the face (Z0 side) towards the chuck. X is diameter, Z is negative towards the chuck.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
          {field('Stock diameter', num(stock, setStock, 'e.g. 30'))}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 440 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 1.3fr 1fr 34px', gap: 8, marginBottom: 6, color: '#999', fontSize: 12, fontWeight: 700 }}>
              <span>#</span><span>X (dia)</span><span>Z</span><span>Corner at this point</span><span>Size</span><span />
            </div>
            {rows.map((r, i) => {
              const middle = i > 0 && i < rows.length - 1
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 1.3fr 1fr 34px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <span style={{ color: ORANGE, fontWeight: 800 }}>{i + 1}</span>
                  <input style={cellInput} type="number" step="any" value={r.x} onChange={e => setRow(i, { x: e.target.value })} onKeyDown={e => { if (e.key === 'e' || e.key === 'E') e.preventDefault() }} />
                  <input style={cellInput} type="number" step="any" value={r.z} onChange={e => setRow(i, { z: e.target.value })} onKeyDown={e => { if (e.key === 'e' || e.key === 'E') e.preventDefault() }} />
                  {middle ? (
                    <select style={{ ...cellInput, textAlign: 'left' }} value={r.corner} onChange={e => setRow(i, { corner: e.target.value as Corner })}>
                      <option value="sharp">Sharp</option>
                      <option value="chamfer">Chamfer C</option>
                      <option value="radius">Radius R</option>
                    </select>
                  ) : <span style={{ color: '#666', fontSize: 12 }}>{i === 0 ? 'start' : 'end'}</span>}
                  {middle && r.corner !== 'sharp'
                    ? <input style={cellInput} type="number" step="any" value={r.size} onChange={e => setRow(i, { size: e.target.value })} />
                    : <span />}
                  <button onClick={() => rows.length > 2 && setRows(rows.filter((_, k) => k !== i))} disabled={rows.length <= 2}
                    style={{ background: 'transparent', border: '1px solid #3a3733', borderRadius: 6, color: rows.length > 2 ? '#ff8a8a' : '#555', cursor: rows.length > 2 ? 'pointer' : 'not-allowed', height: 36 }} aria-label="Remove point">✕</button>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', margin: '6px 0 16px' }}>
          <button onClick={() => rows.length < 40 && setRows([...rows, { x: '', z: '', corner: 'sharp', size: '' }])}
            style={{ background: 'transparent', color: ORANGE, border: `1px solid ${ORANGE}`, borderRadius: 6, padding: '8px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>+ Add point</button>
          <button onClick={() => { setRows(EXAMPLE); setStock('30') }}
            style={{ background: 'transparent', color: '#bbb', border: '1px solid #3a3733', borderRadius: 6, padding: '8px 16px', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Load example</button>
        </div>
        <Preview rows={rows} stock={stock} />
        <p style={{ color: '#888', fontSize: 12, margin: '10px 0 0' }}>
          Diameter must not get smaller towards the chuck, and Z must keep going towards the chuck (no undercuts). The first and last point cannot have a chamfer or radius.
        </p>
      </div>

      <div style={card}>
        <h4 style={{ color: '#fff', margin: '0 0 14px', fontSize: 16 }}>Roughing</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {field('Depth of cut (radial)', num(depth, setDepth, 'e.g. 2'))}
          {field('Retract (radial)', num(retract, setRetract))}
          {field('Finish allowance X (diameter)', num(allowX, setAllowX))}
          {field('Finish allowance Z', num(allowZ, setAllowZ))}
        </div>

        <h4 style={{ color: '#fff', margin: '22px 0 12px', fontSize: 16 }}>Finishing</h4>
        <label style={{ display: 'flex', gap: 10, alignItems: 'center', color: '#ddd', fontSize: 14, cursor: 'pointer', marginBottom: 12 }}>
          <input type="checkbox" checked={useFinish} onChange={e => { setUseFinish(e.target.checked); if (!e.target.checked) setComp('none') }} />
          Add G70 finish pass
        </label>
        {useFinish && (
          <>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {([['none', 'No nose radius compensation'], ['g42', 'Use G42 (nose radius compensation)']] as const).map(([k, t]) => (
                <button key={k} onClick={() => setComp(k)}
                  style={{ flex: '1 1 200px', padding: 11, borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: comp === k ? ORANGE : '#1c1b19', color: comp === k ? '#fff' : '#bbb' }}>{t}</button>
              ))}
            </div>
            {comp === 'g42' && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {field('Nose radius', num(noseR, setNoseR))}
                  {field('Tool tip number', num(tipNo, setTipNo))}
                </div>
                <p style={{ color: '#9ad7b0', fontSize: 12.5, margin: '10px 0 0' }}>
                  The program will have a comment telling the operator to enter this nose radius and tool tip number in the finish tool offset.
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
    </div>
  )
}
