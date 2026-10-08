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
  const [x, setX] = useState('')
  const [y, setY] = useState('')
  const [angle1, setAngle1] = useState('')
  const [angle2, setAngle2] = useState('')
  const [noseRadius, setNoseRadius] = useState('0.4')
  const [feed, setFeed] = useState('')
  const [speed, setSpeed] = useState('')
  const [spindleMode, setSpindleMode] = useState('G96')
  const [workOffset, setWorkOffset] = useState('G54')
  const [safeX, setSafeX] = useState('3')
  const [safeZ, setSafeZ] = useState('5')
  const [maxRpm, setMaxRpm] = useState('')

  const vals = { x, y, angle1, angle2 }
  const filledKeys = Object.keys(vals).filter(k => (vals as any)[k].trim() !== '')

  function isLocked(key: string) {
    return filledKeys.length >= 2 && !filledKeys.includes(key)
  }

  // X/Y + angle1/angle2 -> backend ke a/b/angle/mode mein convert
  function resolvePayload(): { mode: string; a: string; b: string; angle: string } | null {
    if (filledKeys.length !== 2) return null

    const effAngleFromA1 = angle1 ? Number(angle1) : angle2 ? 90 - Number(angle2) : null
    const effAngleFromA2 = angle2 ? Number(angle2) : angle1 ? 90 - Number(angle1) : null

    if (x && (angle1 || angle2)) {
      return { mode: 'a_angle', a: x, b: '', angle: String(effAngleFromA1) }
    }
    if (y && (angle1 || angle2)) {
      return { mode: 'b_angle', a: '', b: y, angle: String(effAngleFromA2) }
    }
    if (x && y) {
      return { mode: 'ab', a: x, b: y, angle: '' }
    }
    return null
  }

  const payload = resolvePayload()
  const ready = !!payload && !!od && !!progNum && !!feed && !!speed && (spindleMode === 'G97' || !!maxRpm)

function handleGenerate() {
  if (!payload) return
  onGenerate({
    progNum, od, noseRadius, feed, speed, spindleMode, workOffset, safeX, safeZ, type, maxRpm,
    mode: payload.mode, a: payload.a, b: payload.b, angle: payload.angle,
  })
}

  // ---- SVG geometry: OD (chamfer goes down) vs ID (chamfer goes up, mirrored vertically) ----
  const isOd = type === 'od'

  return (
    <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 24 }}>
      <h4 style={{ color: '#fff', margin: '0 0 4px', fontSize: 16 }}>{isOd ? 'OD Chamfer' : 'ID Chamfer'}</h4>
      <p style={{ color: '#999', fontSize: 12, marginBottom: 16 }}>Fill {isOd ? 'OD' : 'ID'} (required) and any 2 of the 4 marked values below — the rest calculate automatically.</p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <label style={{ ...label, marginBottom: 0 }}>{isOd ? 'OD' : 'ID'}</label>
        <input style={{ ...input, width: 110 }} type="number" value={od} onChange={e => setOd(e.target.value)} placeholder={isOd ? 'e.g. 50' : 'e.g. 30'} />
        <span style={{ color: '#999', fontSize: 12 }}>mm</span>
      </div>

      <div style={{ position: 'relative', width: '100%', marginBottom: 18 }}>
        {isOd ? (
          <svg viewBox="0 0 600 420" style={{ width: '100%', height: 'auto', display: 'block' }}>
            <line x1="30" y1="140" x2="300" y2="140" stroke="#bdbab5" strokeWidth="2" />
            <text x="40" y="120" fill="#ddd" fontSize="14" fontWeight="bold">OD</text>
            <line x1="300" y1="140" x2="420" y2="140" stroke="#8a8782" strokeWidth="1.3" strokeDasharray="4 3" />
            <line x1="420" y1="140" x2="420" y2="260" stroke="#8a8782" strokeWidth="1.3" strokeDasharray="4 3" />
            <line x1="300" y1="140" x2="420" y2="260" stroke="#F0801E" strokeWidth="3" />
            <line x1="420" y1="260" x2="420" y2="420" stroke="#bdbab5" strokeWidth="2" />
            <text x="435" y="380" fill="#ddd" fontSize="14" fontWeight="bold">Face</text>
            <text x="435" y="400" fill="#ddd" fontSize="14" fontWeight="bold">Z=0</text>
            <line x1="300" y1="110" x2="420" y2="110" stroke="#4dabf7" strokeWidth="1.3" />
            <polygon points="300,110 308,106 308,114" fill="#4dabf7" />
            <polygon points="420,110 412,106 412,114" fill="#4dabf7" />
            <line x1="450" y1="140" x2="450" y2="260" stroke="#4dabf7" strokeWidth="1.3" />
            <polygon points="450,140 446,148 454,148" fill="#4dabf7" />
            <polygon points="450,260 446,252 454,252" fill="#4dabf7" />
            <path d="M 320 140 A 20 20 0 0 1 305.86 154.14" fill="none" stroke="#999" strokeWidth="1.3" />
            <path d="M 420 240 A 20 20 0 0 1 405.86 245.86" fill="none" stroke="#999" strokeWidth="1.3" />
            <g transform="translate(130,370)">
              <line x1="0" y1="0" x2="0" y2="-30" stroke="#888" strokeWidth="1.3" />
              <polygon points="0,-30 -4,-22 4,-22" fill="#888" />
              <line x1="0" y1="0" x2="0" y2="20" stroke="#888" strokeWidth="1.3" />
              <polygon points="0,20 -4,12 4,12" fill="#888" />
              <line x1="-30" y1="0" x2="0" y2="0" stroke="#888" strokeWidth="1.3" />
              <polygon points="-30,0 -22,-4 -22,4" fill="#888" />
              <line x1="0" y1="0" x2="30" y2="0" stroke="#888" strokeWidth="1.3" />
              <polygon points="30,0 22,-4 22,4" fill="#888" />
              <text x="4" y="-32" fill="#888" fontSize="11">X+</text>
              <text x="4" y="32" fill="#888" fontSize="11">X-</text>
              <text x="-42" y="4" fill="#888" fontSize="11">-Z</text>
              <text x="34" y="4" fill="#888" fontSize="11">Z+</text>
            </g>
          </svg>
        ) : (
          <svg viewBox="0 0 600 420" style={{ width: '100%', height: 'auto', display: 'block' }}>
            <line x1="30" y1="260" x2="300" y2="260" stroke="#bdbab5" strokeWidth="2" />
            <text x="40" y="245" fill="#ddd" fontSize="14" fontWeight="bold">ID</text>
            <line x1="300" y1="260" x2="420" y2="260" stroke="#8a8782" strokeWidth="1.3" strokeDasharray="4 3" />
            <line x1="420" y1="260" x2="420" y2="140" stroke="#8a8782" strokeWidth="1.3" strokeDasharray="4 3" />
            <line x1="300" y1="260" x2="420" y2="140" stroke="#F0801E" strokeWidth="3" />
            <line x1="420" y1="140" x2="420" y2="20" stroke="#bdbab5" strokeWidth="2" />
            <text x="430" y="55" fill="#ddd" fontSize="14" fontWeight="bold">Face</text>
            <text x="430" y="75" fill="#ddd" fontSize="14" fontWeight="bold">Z=0</text>
            <line x1="300" y1="300" x2="420" y2="300" stroke="#4dabf7" strokeWidth="1.3" />
            <polygon points="300,300 308,296 308,304" fill="#4dabf7" />
            <polygon points="420,300 412,296 412,304" fill="#4dabf7" />
            <line x1="450" y1="140" x2="450" y2="260" stroke="#4dabf7" strokeWidth="1.3" />
            <polygon points="450,140 446,148 454,148" fill="#4dabf7" />
            <polygon points="450,260 446,252 454,252" fill="#4dabf7" />
            <path d="M 320 260 A 20 20 0 0 1 314.14 245.86" fill="none" stroke="#999" strokeWidth="1.3" />
            <path d="M 420 160 A 20 20 0 0 1 405.86 154.14" fill="none" stroke="#999" strokeWidth="1.3" />
            <g transform="translate(130,370)">
              <line x1="0" y1="0" x2="0" y2="-30" stroke="#888" strokeWidth="1.3" />
              <polygon points="0,-30 -4,-22 4,-22" fill="#888" />
              <line x1="0" y1="0" x2="0" y2="20" stroke="#888" strokeWidth="1.3" />
              <polygon points="0,20 -4,12 4,12" fill="#888" />
              <line x1="-30" y1="0" x2="0" y2="0" stroke="#888" strokeWidth="1.3" />
              <polygon points="-30,0 -22,-4 -22,4" fill="#888" />
              <line x1="0" y1="0" x2="30" y2="0" stroke="#888" strokeWidth="1.3" />
              <polygon points="30,0 22,-4 22,4" fill="#888" />
              <text x="4" y="-32" fill="#888" fontSize="11">X+</text>
              <text x="4" y="32" fill="#888" fontSize="11">X-</text>
              <text x="-42" y="4" fill="#888" fontSize="11">-Z</text>
              <text x="34" y="4" fill="#888" fontSize="11">Z+</text>
            </g>
          </svg>
        )}

        {/* overlay fields */}
        <input
          type="number" placeholder="X" value={x} disabled={isLocked('x')}
          onChange={e => setX(e.target.value)}
          style={{
            position: 'absolute', width: 52, transform: 'translate(-50%,-50%)',
            left: '60%', top: isOd ? '22.6%' : '71.4%',
            background: '#1c1b19', border: `1px solid ${isLocked('x') ? '#555' : '#F0801E'}`,
            borderRadius: 4, color: '#fff', fontSize: 12, textAlign: 'center', padding: '4px 2px',
            opacity: isLocked('x') ? 0.35 : 1,
          }}
        />
        <input
          type="number" placeholder="∠1" value={angle1} disabled={isLocked('angle1')}
          onChange={e => setAngle1(e.target.value)}
          style={{
            position: 'absolute', width: 52, transform: 'translate(-50%,-50%)',
            left: '54.2%', top: isOd ? '40%' : '57.1%',
            background: '#1c1b19', border: `1px solid ${isLocked('angle1') ? '#555' : '#F0801E'}`,
            borderRadius: 4, color: '#fff', fontSize: 12, textAlign: 'center', padding: '4px 2px',
            opacity: isLocked('angle1') ? 0.35 : 1,
          }}
        />
        <input
          type="number" placeholder="∠2" value={angle2} disabled={isLocked('angle2')}
          onChange={e => setAngle2(e.target.value)}
          style={{
            position: 'absolute', width: 52, transform: 'translate(-50%,-50%)',
            left: '65.3%', top: isOd ? '56.7%' : '39.3%',
            background: '#1c1b19', border: `1px solid ${isLocked('angle2') ? '#555' : '#F0801E'}`,
            borderRadius: 4, color: '#fff', fontSize: 12, textAlign: 'center', padding: '4px 2px',
            opacity: isLocked('angle2') ? 0.35 : 1,
          }}
        />
        <input
          type="number" placeholder="Y" value={y} disabled={isLocked('y')}
          onChange={e => setY(e.target.value)}
          style={{
            position: 'absolute', width: 52, transform: 'translate(-50%,-50%)',
            left: '77.5%', top: '47.6%',
            background: '#1c1b19', border: `1px solid ${isLocked('y') ? '#555' : '#F0801E'}`,
            borderRadius: 4, color: '#fff', fontSize: 12, textAlign: 'center', padding: '4px 2px',
            opacity: isLocked('y') ? 0.35 : 1,
          }}
        />
      </div>

      <p style={{ fontSize: 12, marginBottom: 4, color: filledKeys.length === 2 ? '#2fbf71' : '#ff6b6b' }}>
        {filledKeys.length === 2 ? `✓ Ready — using: ${filledKeys.join(', ')}` : `Fill ${2 - filledKeys.length} more value(s) (X / ∠1 / ∠2 / Y)`}
      </p>
      <p style={{ color: '#888', fontSize: 11, marginBottom: 20 }}>
        X = length along {isOd ? 'OD' : 'ID'} (Z-direction) · Y = length along Face (X-direction) · ∠1 = angle at {isOd ? 'OD' : 'ID'} corner · ∠2 = angle at Face corner
      </p>

      <h4 style={{ color: '#fff', margin: '0 0 14px', fontSize: 15 }}>Machining Parameters</h4>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={label}>Program No</label>
          <input style={input} type="number" value={progNum} onChange={e => setProgNum(e.target.value)} />
        </div>
        <div>
          <label style={label}>Nose Radius (R)</label>
          <input style={input} type="number" value={noseRadius} onChange={e => setNoseRadius(e.target.value)} />
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