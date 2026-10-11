'use client'
import { useState } from 'react'

const label = { fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600, display: 'block' }
const input = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 12px', fontSize: 14 }

const STANDARD_THREADS: { label: string; pitch: number }[] = [
  { label: 'M3', pitch: 0.5 }, { label: 'M4', pitch: 0.7 }, { label: 'M5', pitch: 0.8 },
  { label: 'M6', pitch: 1.0 }, { label: 'M8', pitch: 1.25 }, { label: 'M10', pitch: 1.5 },
  { label: 'M12', pitch: 1.75 }, { label: 'M14', pitch: 2.0 }, { label: 'M16', pitch: 2.0 },
  { label: 'M18', pitch: 2.5 }, { label: 'M20', pitch: 2.5 }, { label: 'M24', pitch: 3.0 },
]

export default function TappingTool({ onGenerate, busy, error }: {
  onGenerate: (values: Record<string, string>) => void
  busy: boolean
  error: string
}) {
  const [progNum, setProgNum] = useState('')
  const [radius, setRadius] = useState('')
  const [holes, setHoles] = useState('')
  const [startAngle, setStartAngle] = useState('0')
  const [depth, setDepth] = useState('')
  const [pitch, setPitch] = useState('')
  const [tapType, setTapType] = useState<'continuous' | 'peck'>('continuous')
  const [peckDepth, setPeckDepth] = useState('')
  const [direction, setDirection] = useState<'RH' | 'LH'>('RH')
  const [retractlevel, setRetractlevel] = useState('')
  const [safeZ, setSafeZ] = useState('30')
  const [workOffset, setWorkOffset] = useState('G54')
  const [retractMode, setRetractMode] = useState('G99')
  const [rpm, setRpm] = useState('')

  const feedPreview = rpm && pitch ? (Number(rpm) * Number(pitch)).toFixed(1) : null

  function ready() {
    const base = !!progNum && !!radius && !!holes && !!depth && !!pitch && !!retractlevel && !!safeZ && !!rpm
    const peckOk = tapType === 'continuous' || !!peckDepth
    return base && peckOk
  }

  function handleGenerate() {
    onGenerate({
      progNum, radius, holes, startAngle, depth, pitch, tapType, peckDepth,
      direction, retractlevel, safeZ, workOffset, retractMode, rpm,
    })
  }

  return (
    <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 24 }}>
      <h4 style={{ color: '#fff', margin: '0 0 4px', fontSize: 16 }}>Rigid Tapping (PCD)</h4>
      <p style={{ color: '#999', fontSize: 12, marginBottom: 18 }}>Feed is auto-calculated as RPM &times; Pitch to keep the tap synchronized.</p>

      <div style={{ background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 8, padding: 16, marginBottom: 20 }}>
        <label style={label}>Pitch Calculator — pick a standard thread size</label>
        <select
          style={input}
          defaultValue=""
          onChange={e => {
            const found = STANDARD_THREADS.find(t => t.label === e.target.value)
            if (found) setPitch(String(found.pitch))
          }}
        >
          <option value="" disabled>Select thread size...</option>
          {STANDARD_THREADS.map(t => (
            <option key={t.label} value={t.label}>{t.label} &mdash; pitch {t.pitch} mm</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={label}>Program No</label>
          <input style={input} type="number" value={progNum} onChange={e => setProgNum(e.target.value)} />
        </div>
        <div>
          <label style={label}>PCD Radius</label>
          <input style={input} type="number" value={radius} onChange={e => setRadius(e.target.value)} />
        </div>
        <div>
          <label style={label}>Holes</label>
          <input style={input} type="number" value={holes} onChange={e => setHoles(e.target.value)} />
        </div>
        <div>
          <label style={label}>Start Angle</label>
          <input style={input} type="number" value={startAngle} onChange={e => setStartAngle(e.target.value)} />
        </div>
        <div>
          <label style={label}>Depth (minus)</label>
          <input style={input} type="number" value={depth} onChange={e => setDepth(e.target.value)} />
        </div>
        <div>
          <label style={label}>Pitch (mm)</label>
          <input style={input} type="number" value={pitch} onChange={e => setPitch(e.target.value)} />
        </div>
        <div>
          <label style={label}>Thread Direction</label>
          <select style={input} value={direction} onChange={e => setDirection(e.target.value as 'RH' | 'LH')}>
            <option value="RH">Right-Hand (G84)</option>
            <option value="LH">Left-Hand (G74)</option>
          </select>
        </div>
        <div>
          <label style={label}>RPM</label>
          <input style={input} type="number" value={rpm} onChange={e => setRpm(e.target.value)} />
        </div>
        <div>
          <label style={label}>Tapping Type</label>
          <select style={input} value={tapType} onChange={e => setTapType(e.target.value as 'continuous' | 'peck')}>
            <option value="continuous">Continuous</option>
            <option value="peck">Peck</option>
          </select>
        </div>
        {tapType === 'peck' && (
          <div>
            <label style={label}>Peck Depth (Q)</label>
            <input style={input} type="number" value={peckDepth} onChange={e => setPeckDepth(e.target.value)} />
          </div>
        )}
        <div>
          <label style={label}>Retract Level (R)</label>
          <input style={input} type="number" value={retractlevel} onChange={e => setRetractlevel(e.target.value)} />
        </div>
        <div>
          <label style={label}>Safe Z</label>
          <input style={input} type="number" value={safeZ} onChange={e => setSafeZ(e.target.value)} />
        </div>
        <div>
          <label style={label}>Work Offset</label>
          <select style={input} value={workOffset} onChange={e => setWorkOffset(e.target.value)}>
            {['G54', 'G55', 'G56', 'G57', 'G58', 'G59'].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>Retract Mode</label>
          <select style={input} value={retractMode} onChange={e => setRetractMode(e.target.value)}>
            <option value="G99">G99 - Return to R Plane</option>
            <option value="G98">G98 - Return to Initial Z</option>
          </select>
        </div>
      </div>

      {feedPreview && (
        <p style={{ color: '#F0801E', fontSize: 13, marginTop: 14 }}>
          Calculated Feed: <b>{feedPreview} mm/min</b> (RPM {rpm} &times; Pitch {pitch})
        </p>
      )}

      <button
        onClick={handleGenerate}
        disabled={!ready() || busy}
        style={{ width: '100%', background: ready() ? '#F0801E' : '#4a4744', color: '#fff', border: 'none', borderRadius: 6, padding: 13, fontSize: 15, fontWeight: 700, cursor: ready() ? 'pointer' : 'not-allowed', marginTop: 18 }}
      >
        {busy ? 'Generating...' : 'Generate'}
      </button>
      {error && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 12 }}>{error}</p>}
    </div>
  )
}