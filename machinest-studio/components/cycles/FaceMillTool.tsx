'use client'
import { useState } from 'react'

const label = { fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600, display: 'block' }
const input = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 12px', fontSize: 14 }
const section = { fontSize: 11, color: '#888', textTransform: 'uppercase' as const, marginTop: 16, marginBottom: 8, borderTop: '1px solid #3a3733', paddingTop: 10, letterSpacing: 0.5 }

export default function FaceMillTool({ onGenerate, busy, error }: {
  onGenerate: (values: Record<string, string>) => void
  busy: boolean
  error: string
}) {
  const [shape, setShape] = useState<'rect' | 'circular' | null>(null)

  const [progNum, setProgNum] = useState('')
  const [originCorner, setOriginCorner] = useState('FL')
  const [stockX, setStockX] = useState('')
  const [stockY, setStockY] = useState('')
  const [diameter, setDiameter] = useState('')
  const [toolpathStyle, setToolpathStyle] = useState('SPIRAL')
  const [pattern, setPattern] = useState('ZIGZAG')
  const [cutterDia, setCutterDia] = useState('')
  const [stepoverPct, setStepoverPct] = useState('70')
  const [overtravelPct, setOvertravelPct] = useState('20')
  const [depth, setDepth] = useState('')
  const [depthPerPass, setDepthPerPass] = useState('')
  const [retractlevel, setRetractlevel] = useState('')
  const [safeZ, setSafeZ] = useState('30')
  const [finishCut, setFinishCut] = useState('NO')
  const [finishMargin, setFinishMargin] = useState('')
  const [finishFeed, setFinishFeed] = useState('')
  const [finishRpm, setFinishRpm] = useState('')
  const [workOffset, setWorkOffset] = useState('G54')
  const [feed, setFeed] = useState('')
  const [plungeFeed, setPlungeFeed] = useState('')
  const [rpm, setRpm] = useState('')

  const showRasterPattern = shape === 'circular' ? toolpathStyle === 'RASTER' : true

  function ready() {
    const base = !!progNum && !!cutterDia && !!stepoverPct && !!depth && !!depthPerPass && !!retractlevel && !!safeZ && !!feed && !!plungeFeed && !!rpm
    const finishOk = finishCut === 'NO' || (!!finishMargin && !!finishFeed && !!finishRpm)
    if (shape === 'rect') return base && finishOk && !!stockX && !!stockY
    if (shape === 'circular') return base && finishOk && !!diameter
    return false
  }

  function handleGenerate() {
    onGenerate({
      shape: shape!, progNum, cutterDia, stepoverPct, overtravelPct, depth, depthPerPass,
      retractlevel, safeZ, finishCut, finishMargin, finishFeed, finishRpm, workOffset, feed, plungeFeed, rpm,
      originCorner, stockX, stockY, diameter, toolpathStyle, pattern,
    })
  }

  if (!shape) {
    return (
      <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 24 }}>
        <p style={{ color: '#999', fontSize: 14, marginBottom: 20 }}>Select stock shape</p>
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <div
            onClick={() => setShape('rect')}
            style={{ background: '#1c1b19', border: '2px solid #F0801E', borderRadius: 12, padding: 28, width: 180, textAlign: 'center', cursor: 'pointer' }}
          >
            <div style={{ fontSize: 34, marginBottom: 10 }}>▭</div>
            <div style={{ color: '#fff', fontWeight: 700 }}>Square / Rectangular</div>
          </div>
          <div
            onClick={() => setShape('circular')}
            style={{ background: '#1c1b19', border: '2px solid #F0801E', borderRadius: 12, padding: 28, width: 180, textAlign: 'center', cursor: 'pointer' }}
          >
            <div style={{ fontSize: 34, marginBottom: 10 }}>◯</div>
            <div style={{ color: '#fff', fontWeight: 700 }}>Circular</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h4 style={{ color: '#fff', margin: 0, fontSize: 16 }}>Face Milling — {shape === 'rect' ? 'Rectangular' : 'Circular'}</h4>
        <button onClick={() => setShape(null)} style={{ background: 'transparent', border: 'none', color: '#F0801E', fontSize: 12, cursor: 'pointer' }}>Change shape</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
        <div>
          <label style={label}>Program No</label>
          <input style={input} type="number" value={progNum} onChange={e => setProgNum(e.target.value)} />
        </div>

        {shape === 'rect' ? (
          <>
            <div>
              <label style={label}>Origin Corner</label>
              <select style={input} value={originCorner} onChange={e => setOriginCorner(e.target.value)}>
                <option value="FL">Front-Left</option>
                <option value="FR">Front-Right</option>
                <option value="BL">Back-Left</option>
                <option value="BR">Back-Right</option>
              </select>
            </div>
            <div>
              <label style={label}>Stock Length (X)</label>
              <input style={input} type="number" value={stockX} onChange={e => setStockX(e.target.value)} />
            </div>
            <div>
              <label style={label}>Stock Width (Y)</label>
              <input style={input} type="number" value={stockY} onChange={e => setStockY(e.target.value)} />
            </div>
          </>
        ) : (
          <>
            <div>
              <label style={label}>Diameter</label>
              <input style={input} type="number" value={diameter} onChange={e => setDiameter(e.target.value)} />
            </div>
            <div>
              <label style={label}>Toolpath Style</label>
              <select style={input} value={toolpathStyle} onChange={e => setToolpathStyle(e.target.value)}>
                <option value="SPIRAL">Spiral (outward from center)</option>
                <option value="RASTER">Linear Raster (clipped to circle)</option>
              </select>
            </div>
          </>
        )}

        {showRasterPattern && (
          <div>
            <label style={label}>Toolpath Pattern</label>
            <select style={input} value={pattern} onChange={e => setPattern(e.target.value)}>
              <option value="ZIGZAG">Zig-Zag (bidirectional)</option>
              <option value="UNI">Unidirectional (same direction)</option>
            </select>
          </div>
        )}
      </div>

      <div style={section}>Cutter / Coverage</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={label}>Cutter Diameter</label>
          <input style={input} type="number" value={cutterDia} onChange={e => setCutterDia(e.target.value)} />
        </div>
        <div>
          <label style={label}>Stepover (%)</label>
          <input style={input} type="number" value={stepoverPct} onChange={e => setStepoverPct(e.target.value)} />
        </div>
        <div>
          <label style={label}>Overtravel (% of Cutter Dia)</label>
          <input style={input} type="number" value={overtravelPct} onChange={e => setOvertravelPct(e.target.value)} />
        </div>
      </div>

      <div style={section}>Depth</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={label}>Total Depth of Cut (Minus)</label>
          <input style={input} type="number" value={depth} onChange={e => setDepth(e.target.value)} />
        </div>
        <div>
          <label style={label}>Depth Per Pass (Rough)</label>
          <input style={input} type="number" value={depthPerPass} onChange={e => setDepthPerPass(e.target.value)} />
        </div>
        <div>
          <label style={label}>Retract Level (R)</label>
          <input style={input} type="number" value={retractlevel} onChange={e => setRetractlevel(e.target.value)} />
        </div>
        <div>
          <label style={label}>Safe Z</label>
          <input style={input} type="number" value={safeZ} onChange={e => setSafeZ(e.target.value)} />
        </div>
      </div>

      <div style={section}>Finish Cut</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={label}>Finish Cut</label>
          <select style={input} value={finishCut} onChange={e => setFinishCut(e.target.value)}>
            <option value="NO">No</option>
            <option value="YES">Yes</option>
          </select>
        </div>
        {finishCut === 'YES' && (
          <>
            <div>
              <label style={label}>Finish Margin</label>
              <input style={input} type="number" value={finishMargin} onChange={e => setFinishMargin(e.target.value)} />
            </div>
            <div>
              <label style={label}>Finish Feed</label>
              <input style={input} type="number" value={finishFeed} onChange={e => setFinishFeed(e.target.value)} />
            </div>
            <div>
              <label style={label}>Finish RPM</label>
              <input style={input} type="number" value={finishRpm} onChange={e => setFinishRpm(e.target.value)} />
            </div>
          </>
        )}
      </div>

      <div style={section}>Machine Settings</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <label style={label}>Work Offset</label>
          <select style={input} value={workOffset} onChange={e => setWorkOffset(e.target.value)}>
            {['G54', 'G55', 'G56', 'G57', 'G58', 'G59'].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label style={label}>Cutting Feed (Rough)</label>
          <input style={input} type="number" value={feed} onChange={e => setFeed(e.target.value)} />
        </div>
        <div>
          <label style={label}>Plunge Feed</label>
          <input style={input} type="number" value={plungeFeed} onChange={e => setPlungeFeed(e.target.value)} />
        </div>
        <div>
          <label style={label}>RPM (Rough)</label>
          <input style={input} type="number" value={rpm} onChange={e => setRpm(e.target.value)} />
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={!ready() || busy}
        style={{ width: '100%', background: ready() ? '#F0801E' : '#4a4744', color: '#fff', border: 'none', borderRadius: 6, padding: 13, fontSize: 15, fontWeight: 700, cursor: ready() ? 'pointer' : 'not-allowed', marginTop: 20 }}
      >
        {busy ? 'Generating...' : 'Generate'}
      </button>
      {error && <p style={{ color: '#ff6b6b', fontSize: 13, marginTop: 12 }}>{error}</p>}
    </div>
  )
}