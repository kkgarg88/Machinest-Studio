'use client'
import { useEffect, useRef, useState } from 'react'

const ORANGE = '#F0801E'
export type CentreGeom = { kind: 'drill' | 'tap'; D: number; tipLen?: number; preD?: number; lead?: number; faceZ: number; zEnd: number; zInit: number }
export type CentreSegIn = { k: 'rapid' | 'feed' | 'dwell'; z0: number; z1: number; label: string; spin: 'M03' | 'M04' | 'M05' }
type Calc = { ok: true; geom: CentreGeom; segs: CentreSegIn[] } | { ok: false; error: string }

// Side view on the centre line: tool goes into the bar, the hole (or thread) appears as the tool cuts.
export default function CentreAnim({ calc }: { calc: Calc }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const st = useRef({ t: 0, playing: false, last: 0 })
  const [playing, setPlaying] = useState(false)
  const [seek, setSeek] = useState(0)
  const [speed, setSpeed] = useState('1')
  const [info, setInfo] = useState('')
  const speedRef = useRef(1)
  speedRef.current = parseFloat(speed) || 1
  const calcRef = useRef(calc)
  calcRef.current = calc

  const durs = calc.ok ? calc.segs.map(s => { const l = Math.abs(s.z1 - s.z0); return s.k === 'dwell' ? 0.7 : s.k === 'feed' ? Math.max(0.5, l / 5) : Math.max(0.25, l / 50) }) : []
  const total = durs.reduce((a, b) => a + b, 0)
  const totalRef = useRef(0)
  totalRef.current = total

  function draw() {
    const c = cv.current
    const cc = calcRef.current
    if (!c) return
    const x = c.getContext('2d')!
    const W = c.width, H = c.height
    x.clearRect(0, 0, W, H)
    if (!cc.ok) return
    const g = cc.geom, segs = cc.segs
    const ds = segs.map(s => { const l = Math.abs(s.z1 - s.z0); return s.k === 'dwell' ? 0.7 : s.k === 'feed' ? Math.max(0.5, l / 5) : Math.max(0.25, l / 50) })
    const T = st.current.t
    const D = g.D, zT = g.zInit + 16, zB = g.zEnd - 10, Rw = Math.max(D * 1.5, 12)
    const sc = Math.min((W - 80) / (zT - zB), (H - 60) / (Rw * 2 + 10)), ox = 40, cy = H / 2
    const X = (z: number) => ox + (zT - z) * sc, Y = (r: number) => cy - r * sc
    // current tool position and deepest feed point so far
    let a = 0, cur = segs[0], zc = segs[0].z0, minZ = g.faceZ
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i]
      const f = ds[i] ? Math.min(1, Math.max(0, (T - a) / ds[i])) : 1
      if (T >= a || i === 0) { cur = s; zc = s.z0 + (s.z1 - s.z0) * f }
      if (T > a && s.k === 'feed') minZ = Math.min(minZ, s.z0 + (s.z1 - s.z0) * f)
      a += ds[i]
      if (T < a) break
    }
    // workpiece
    x.fillStyle = '#6d6a64'; x.fillRect(X(g.faceZ), Y(Rw), (g.faceZ - zB) * sc, Rw * 2 * sc)
    x.strokeStyle = '#999'; x.lineWidth = 1; x.strokeRect(X(g.faceZ), Y(Rw), (g.faceZ - zB) * sc, Rw * 2 * sc)
    const rH = g.kind === 'tap' ? (g.preD ?? D) / 2 : D / 2
    if (minZ < g.faceZ - 1e-6) {
      x.fillStyle = '#1c1b19'
      const tl = g.kind === 'drill' ? g.tipLen ?? 0 : 0
      const cyl = Math.max(minZ, minZ + tl) // end of the full-diameter part
      const stop = Math.min(g.faceZ, cyl)
      x.fillRect(X(g.faceZ), Y(rH), (g.faceZ - stop) * sc, rH * 2 * sc)
      if (tl > 0 && cyl < g.faceZ) { x.beginPath(); x.moveTo(X(stop), Y(rH)); x.lineTo(X(minZ), Y(0)); x.lineTo(X(stop), Y(-rH)); x.fill() }
      if (g.kind === 'tap' && g.lead) {
        x.strokeStyle = ORANGE; x.lineWidth = 1
        const step = Math.max(g.lead * sc, 3) / sc
        x.beginPath()
        for (let zz = g.faceZ; zz > minZ; zz -= step) for (const sg of [1, -1]) { x.moveTo(X(zz), Y(sg * rH)); x.lineTo(X(zz - g.lead / 2), Y(sg * (D / 2))) }
        x.stroke()
      }
    }
    // centre line and face line
    x.setLineDash([10, 4, 2, 4]); x.strokeStyle = '#5aa'; x.beginPath(); x.moveTo(0, cy); x.lineTo(W, cy); x.stroke(); x.setLineDash([])
    x.strokeStyle = ORANGE; x.beginPath(); x.moveTo(X(g.faceZ), Y(Rw) - 8); x.lineTo(X(g.faceZ), Y(-Rw) + 8); x.stroke()
    // tool
    const r = D / 2, tl = g.kind === 'drill' ? g.tipLen ?? 0 : 0
    x.fillStyle = '#c9c4ba'; x.beginPath(); x.moveTo(X(zc), Y(0)); x.lineTo(X(zc + tl), Y(r)); x.lineTo(X(zc + 40), Y(r)); x.lineTo(X(zc + 40), Y(-r)); x.lineTo(X(zc + tl), Y(-r)); x.closePath(); x.fill()
    x.strokeStyle = '#555'
    const rev = cur.spin === 'M04' ? -1 : 1, ph = (T * 6) % 1
    for (let k = 0; k < 8; k++) { const zz = zc + tl + ((k + rev * ph + 8) % 8) * 3; x.beginPath(); x.moveTo(X(zz), Y(r)); x.lineTo(X(zz + 2), Y(-r)); x.stroke() }
    // chuck
    x.fillStyle = '#3a3834'; x.fillRect(X(zB), Y(Rw + 6), ox + 20, (Rw + 6) * 2 * sc)
    x.font = '12px Segoe UI, sans-serif'; x.fillStyle = '#8a8782'
    x.fillText('◄ chuck', 8, 16); x.textAlign = 'right'; x.fillText('tool ►', W - 8, 16); x.textAlign = 'left'
    x.fillStyle = ORANGE; x.fillText('face Z' + String(Number(g.faceZ.toFixed(3))), X(g.faceZ) + 4, Y(Rw) - 12)
    setInfo(`${cur.label}   |   spindle ${cur.spin}   |   Z ${zc.toFixed(2)}`)
  }

  useEffect(() => {
    st.current.t = 0; st.current.playing = false
    setPlaying(false); setSeek(0)
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calc])

  useEffect(() => {
    let raf = 0
    const loop = (ts: number) => {
      const s = st.current
      if (s.playing) {
        const dt = Math.min(0.05, (ts - s.last) / 1000)
        s.t = Math.min(totalRef.current, s.t + dt * speedRef.current)
        if (s.t >= totalRef.current) { s.playing = false; setPlaying(false) }
        draw(); setSeek(totalRef.current ? Math.round((s.t / totalRef.current) * 1000) : 0)
      }
      s.last = ts; raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!calc.ok) {
    return (
      <div style={{ background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 10, color: '#777', fontSize: 14, padding: '70px 20px', textAlign: 'center' }}>
        {calc.error}
      </div>
    )
  }
  const btn = { background: ORANGE, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 700, cursor: 'pointer' } as const
  return (
    <div>
      <canvas ref={cv} width={900} height={380} style={{ width: '100%', display: 'block', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 10 }} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
        <button type="button" style={btn} onClick={() => {
          const s = st.current
          if (s.t >= total) s.t = 0
          s.playing = !s.playing; setPlaying(s.playing)
        }}>{playing ? '❚❚ Pause' : '▶ Play'}</button>
        <button type="button" style={{ ...btn, background: '#1c1b19', color: '#ccc' }} onClick={() => { const s = st.current; s.playing = false; s.t = 0; setPlaying(false); setSeek(0); draw() }}>⟲ Reset</button>
        <input type="range" min={0} max={1000} value={seek} style={{ flex: '1 1 160px', padding: 0 }}
          onChange={e => { const s = st.current; s.playing = false; setPlaying(false); setSeek(+e.target.value); s.t = (total * +e.target.value) / 1000; draw() }} />
        <label style={{ color: '#ccc', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>Speed
          <select value={speed} onChange={e => setSpeed(e.target.value)} style={{ background: '#1c1b19', color: '#fff', border: '1px solid #3a3733', borderRadius: 6, padding: '3px 6px' }}>
            {['0.5', '1', '2', '4'].map(v => <option key={v}>{v}</option>)}
          </select>
        </label>
      </div>
      <div style={{ color: ORANGE, fontFamily: 'Consolas, monospace', fontSize: 13, marginTop: 8, minHeight: 18 }}>{info}</div>
    </div>
  )
}
