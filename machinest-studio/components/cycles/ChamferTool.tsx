'use client'
import { useState } from 'react'

const label = { fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600, display: 'block' }
const input = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 12px', fontSize: 14 }

export default function ChamferTool({ onGenerate, busy, error, type }: {
  onGenerate: (values: Record<string, string>) => void
  busy: boolean
  error: string
  type: 'od' | 'id'
}) {
  const [progNum, setProgNum] = useState('')
  const [od, setOd] = useState('')
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [angle, setAngle] = useState('')
  const [noseRadius, setNoseRadius] = useState('0.4')
  const [feed, setFeed] = useState('')
  const [speed, setSpeed] = useState('')
  const [spindleMode, setSpindleMode] = useState('G96')
  const [workOffset, setWorkOffset] = useState('G54')
  const [safeX, setSafeX] = useState('3')
  const [safeZ, setSafeZ] = useState('5')

  function filledCount() {
    return [a, b, angle].filter(v => v.trim() !== '').length
  }

  function mode(): 'a_angle' | 'b_angle' | 'ab' | '' {
    if (a && angle && !b) return 'a_angle'
    if (b && angle && !a) return 'b_angle'
    if (a && b && !angle) return 'ab'
    return ''
  }

  function handleGenerate() {
    onGenerate({ progNum, od, a, b, angle, noseRadius, mode: mode(), feed, speed, spindleMode, workOffset, safeX, safeZ, type })
  }

  const m = mode()
  const ready = filledCount() === 2 && od && progNum && feed && speed

  return (
    <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 24 }}>
      <h4 style={{ color: '#fff', margin: '0 0 4px', fontSize: 16 }}>{type === 'od' ? 'OD Chamfer' : 'ID Chamfer'}</h4>
      <p style={{ color: '#999', fontSize: 12, marginBottom: 16 }}>Fill any 2 of: A, B, Angle — the third is calculated automatically.</p>

      <svg viewBox="0 0 420 260" width="100%" style={{ maxWidth: 420, marginBottom: 10 }}>
        <line x1="30" y1="210" x2="260" y2="210" stroke="#8a8782" strokeWidth="2" />
        <line x1="260" y1="210" x2="260" y2="40" stroke="#8a8782" strokeWidth="2" />
        <line x1="260" y1="140" x2="330" y2="210" stroke="#F0801E" strokeWidth="3" />
        <text x="35" y="228" fill="#999" fontSize="12">Face (Z0)</text>
        <text x="268" y="40" fill="#999" fontSize="12">{type === 'od' ? 'OD line' : 'ID (bore) line'}</text>
        <circle cx="260" cy="210" r="4" fill="#555" />
        <text x="100" y="60" fill="#fff" fontSize="12">{type === 'od' ? 'OD →' : 'ID →'}</text>
      </svg>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={label}>{type === 'od' ? 'OD (diameter)' : 'ID (bore diameter)'}</label>
          <input style={input} type="number" value={od} onChange={e => setOd(e.target.value)} placeholder="e.g. 50" />
        </div>
        <div>
          <label style={label}>Nose Radius (R)</label>
          <input style={input} type="number" value={noseRadius} onChange={e => setNoseRadius(e.target.value)} />
        </div>
        <div>
          <label style={label}>A — length along {type === 'od' ? 'OD' : 'ID'} (Z-leg)</label>
          <input style={input} type="number" value={a} onChange={e => setA(e.target.value)} placeholder="leave blank if not known" />
        </div>
        <div>
          <label style={label}>B — length along Face (X-leg)</label>
          <input style={input} type="number" value={b} onChange={e => setB(e.target.value)} placeholder="leave blank if not known" />
        </div>
        <div>
          <label style={label}>Angle (deg)</label>
          <input style={input} type="number" value={angle} onChange={e => setAngle(e.target.value)} placeholder="leave blank if not known" />
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <span style={{ fontSize: 12, color: m ? '#2fbf71' : '#ff6b6b' }}>
            {m ? `Mode: ${m === 'a_angle' ? 'A + Angle' : m === 'b_angle' ? 'B + Angle' : 'A + B'}` : 'Fill exactly 2 fields'}
          </span>
        </div>
      </div>

      <h4 style={{ color: '#fff', margin: '20px 0 14px', fontSize: 15 }}>Machining Parameters</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={label}>Program No</label>
          <input style={input} type="number" value={progNum} onChange={e => setProgNum(e.target.value)} />
        </div>
        <div>
          <label style={label}>Spindle Mode</label>
          <select style={input} value={spindleMode} onChange={e => setSpindleMode(e.target.value)}>
            <option value="G96">G96 - Constant Surface Speed</option>
            <option value="G97">G97 - Direct RPM</option>
          </select>
        </div>
        <div>
          <label style={label}>Speed (S)</label>
          <input style={input} type="number" value={speed} onChange={e => setSpeed(e.target.value)} />
        </div>
        <div>
          <label style={label}>Feed (mm/rev)</label>
          <input style={input} type="number" value={feed} onChange={e => setFeed(e.target.value)} />
        </div>
        <div>
          <label style={label}>Work Offset</label>
          <select style={input} value={workOffset} onChange={e => setWorkOffset(e.target.value)}>
            {['G54','G55','G56','G57','G58','G59'].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={label}>Safe X</label>
            <input style={input} type="number" value={safeX} onChange={e => setSafeX(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={label}>Safe Z</label>
            <input style={input} type="number" value={safeZ} onChange={e => setSafeZ(e.target.value)} />
          </div>
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={!ready || busy}
        style={{ width: '100%', background: ready ? '#F0801E' : '#4a4744', color: '#fff', border: 'none', borderRadius: 6, padding: 13, fontSize: 15, fontWeight: 700, cursor: ready ? 'pointer' : 'not-allowed', marginTop: 18 }}
      >
        {busy ? 'Generating...' : 'Generate'}
      </button>
      {error && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 12 }}>{error}</p>}
    </div>
  )
}