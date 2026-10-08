'use client'
import { useState } from 'react'

const label = { fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600, display: 'block' }
const input = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 12px', fontSize: 14 }

export default function RadiusTool({ onGenerate, busy, error }: {
  onGenerate: (values: Record<string, string>) => void
  busy: boolean
  error: string
}) {
  const [caseType, setCaseType] = useState<'1' | '2'>('1')
  const [progNum, setProgNum] = useState('')
  const [od, setOd] = useState('')
  const [r, setR] = useState('')
  const [nose, setNose] = useState('0.4')
  const [feed, setFeed] = useState('')
  const [speed, setSpeed] = useState('')
  const [maxRpm, setMaxRpm] = useState('')
  const [spindleMode, setSpindleMode] = useState('G96')
  const [workOffset, setWorkOffset] = useState('G54')
  const [safeX, setSafeX] = useState('3')
  const [safeZ, setSafeZ] = useState('5')

  const ready = !!od && !!r && !!progNum && !!feed && !!speed && caseType === '1' && (spindleMode === 'G97' || !!maxRpm)

  function handleGenerate() {
    onGenerate({ caseType, progNum, od, r, nose, feed, speed, maxRpm, spindleMode, workOffset, safeX, safeZ })
  }

  return (
    <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 24 }}>
      <h4 style={{ color: '#fff', margin: '0 0 4px', fontSize: 16 }}>Radius Only (OD)</h4>
      <p style={{ color: '#999', fontSize: 12, marginBottom: 16 }}>Tangent 90° corner radius. Enter OD and R — nose radius is compensated automatically.</p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <button
          onClick={() => setCaseType('1')}
          style={{ flex: 1, padding: 10, borderRadius: 6, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: caseType === '1' ? '#F0801E' : '#1c1b19', color: '#fff' }}
        >
          Case I — Concave
        </button>
        <button
          onClick={() => setCaseType('2')}
          style={{ flex: 1, padding: 10, borderRadius: 6, border: 'none', cursor: 'not-allowed', fontWeight: 700, fontSize: 13, background: '#1c1b19', color: '#777', opacity: 0.6 }}
          disabled
        >
          Case II — Convex (coming soon)
        </button>
      </div>

      <svg viewBox="0 0 500 220" style={{ width: '100%', maxWidth: 420, marginBottom: 16 }}>
        <line x1="20" y1="70" x2="200" y2="70" stroke="#bdbab5" strokeWidth="2" />
        <text x="25" y="55" fill="#ddd" fontSize="13" fontWeight="bold">OD</text>
        <path d="M 200 70 A 40 40 0 0 1 240 110" fill="none" stroke="#F0801E" strokeWidth="3" />
        <line x1="240" y1="110" x2="240" y2="210" stroke="#bdbab5" strokeWidth="2" />
        <text x="248" y="190" fill="#ddd" fontSize="13" fontWeight="bold">Face Z=0</text>
      </svg>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 10 }}>
        <div>
          <label style={label}>OD</label>
          <input style={input} type="number" value={od} onChange={e => setOd(e.target.value)} placeholder="e.g. 50" />
        </div>
        <div>
          <label style={label}>R (design radius)</label>
          <input style={input} type="number" value={r} onChange={e => setR(e.target.value)} placeholder="e.g. 3" />
        </div>
        <div>
          <label style={label}>Nose Radius</label>
          <input style={input} type="number" value={nose} onChange={e => setNose(e.target.value)} />
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
          <label style={label}>{spindleMode === 'G96' ? 'Surface Speed (m/min)' : 'Speed (RPM)'}</label>
          <input style={input} type="number" value={speed} onChange={e => setSpeed(e.target.value)} />
        </div>
        {spindleMode === 'G96' && (
          <div>
            <label style={label}>Max Spindle RPM (G50)</label>
            <input style={input} type="number" value={maxRpm} onChange={e => setMaxRpm(e.target.value)} placeholder="e.g. 2000" />
          </div>
        )}
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