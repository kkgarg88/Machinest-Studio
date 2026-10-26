'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FgMotion } from '@/lib/cycles/face-groove-motion'

const ORANGE = '#F0801E'
const fmt = (n: number) => String(Number(n.toFixed(3)))
type P = { x: number; z: number; k: string; text: string; d: number }

// Animated cross-section: the face is on the right, the chuck on the left, the centre line at the bottom.
export default function FaceGrooveAnim({ motion }: { motion: FgMotion }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const matRef = useRef<HTMLCanvasElement | null>(null)
  const st = useRef({ dist: 0, playing: false, erased: 0, last: 0 })
  const [playing, setPlaying] = useState(false)
  const [seek, setSeek] = useState(0)
  const [speed, setSpeed] = useState('1')
  const [info, setInfo] = useState('')
  const speedRef = useRef(1)
  speedRef.current = parseFloat(speed) || 1

  const built = useMemo(() => {
    if (!motion.ok) return null
    const g = motion.geom
    const path: P[] = [{ x: motion.start.x, z: motion.start.z, k: 'G00', text: 'start', d: 0 }]
    let total = 0, cx = motion.start.x, cz = motion.start.z
    const push = (x: number, z: number, k: string, text: string) => {
      const p = path[path.length - 1]
      total += Math.hypot((x - p.x) / 2, z - p.z)
      path.push({ x, z, k, text, d: total })
    }
    for (const m of motion.moves) {
      if ((m.k === 'G02' || m.k === 'G03') && m.R) {
        const a = { z: cz, r: cx / 2 }, b = { z: m.z, r: m.x / 2 }
        const dz = b.z - a.z, dr = b.r - a.r, d = Math.hypot(dz, dr), half = d / 2
        const h = Math.sqrt(Math.max(0, m.R * m.R - half * half)), ccw = m.k === 'G03'
        const nz = -dr / d, nr = dz / d, sg = ccw ? 1 : -1
        const oz = (a.z + b.z) / 2 + nz * h * sg, or = (a.r + b.r) / 2 + nr * h * sg
        let a0 = Math.atan2(a.r - or, a.z - oz), a1 = Math.atan2(b.r - or, b.z - oz)
        if (ccw) { if (a1 < a0) a1 += 2 * Math.PI } else { if (a1 > a0) a1 -= 2 * Math.PI }
        for (let i = 1; i <= 24; i++) {
          const an = a0 + ((a1 - a0) * i) / 24
          push(2 * (or + m.R * Math.sin(an)), oz + m.R * Math.cos(an), m.k, m.text)
        }
      } else push(m.x, m.z, m.k, m.text)
      cx = m.x; cz = m.z
    }
    // view
    const W = 900, H = 520, pad = 26
    const rMin = Math.max(0, g.Di / 2 - 4.5), rMax = g.Do / 2 + 4.5
    const zMin = g.zB - 2.5, zMax = g.faceZ + 6.5
    const k = Math.min((W - 2 * pad) / (zMax - zMin), (H - 2 * pad) / (rMax - rMin))
    const ox = (W - (zMax - zMin) * k) / 2, oy = H - (H - (rMax - rMin) * k) / 2
    return { g, path, total, W, H, rMin, rMax, zMin, zMax, X: (z: number) => ox + (z - zMin) * k, Y: (r: number) => oy - (r - rMin) * k, k }
  }, [motion])

  // reset the animation when the groove changes
  useEffect(() => {
    st.current.dist = 0; st.current.playing = false; st.current.erased = -1
    setPlaying(false); setSeek(0); setInfo('')
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built])

  function at(dd: number) {
    const path = built!.path
    if (dd <= 0) return { x: path[0].x, z: path[0].z, i: 0 }
    for (let i = 1; i < path.length; i++) {
      if (path[i].d >= dd) {
        const a = path[i - 1], b = path[i], t = (dd - a.d) / ((b.d - a.d) || 1)
        return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, i }
      }
    }
    const l = path[path.length - 1]
    return { x: l.x, z: l.z, i: path.length - 1 }
  }

  function fillMaterial(b: NonNullable<typeof built>) {
    if (!matRef.current) { matRef.current = document.createElement('canvas'); matRef.current.width = b.W; matRef.current.height = b.H }
    const m = matRef.current.getContext('2d')!
    m.globalCompositeOperation = 'source-over'
    m.clearRect(0, 0, b.W, b.H)
    m.fillStyle = 'rgba(240,128,30,.20)'
    m.fillRect(b.X(b.zMin) - 2, b.Y(b.rMax), b.X(b.g.faceZ) - b.X(b.zMin) + 2, b.Y(b.rMin) - b.Y(b.rMax))
    m.strokeStyle = '#8a8782'; m.lineWidth = 1.5
    m.beginPath(); m.moveTo(b.X(b.g.faceZ), b.Y(b.rMax)); m.lineTo(b.X(b.g.faceZ), b.Y(b.rMin)); m.stroke()
  }
  function insertRect(b: NonNullable<typeof built>, x: number, z: number) {
    return { z0: z, z1: z + 14, r0: x / 2 - b.g.Wt, r1: x / 2 }
  }
  function eraseUpTo(b: NonNullable<typeof built>, dd: number) {
    if (dd < st.current.erased || st.current.erased < 0) { fillMaterial(b); st.current.erased = 0 }
    const m = matRef.current!.getContext('2d')!
    m.globalCompositeOperation = 'destination-out'; m.fillStyle = '#000'
    for (let s = st.current.erased; s <= dd; s += 0.12) {
      const p = at(s), q = insertRect(b, p.x, p.z)
      m.fillRect(b.X(q.z0), b.Y(q.r1), b.X(q.z1) - b.X(q.z0), b.Y(q.r0) - b.Y(q.r1))
    }
    st.current.erased = dd
  }

  function draw() {
    const c = cv.current
    if (!c || !built) return
    const ctx = c.getContext('2d')!
    const b = built, g = b.g
    ctx.clearRect(0, 0, b.W, b.H)
    eraseUpTo(b, st.current.dist)
    ctx.drawImage(matRef.current!, 0, 0)
    ctx.save(); ctx.strokeStyle = '#6a655f'; ctx.setLineDash([14, 4, 3, 4])
    if (b.rMin <= 0.01) { ctx.beginPath(); ctx.moveTo(b.X(b.zMin), b.Y(0)); ctx.lineTo(b.X(b.zMax), b.Y(0)); ctx.stroke() }
    ctx.restore()
    // finished groove outline
    const pts: [number, number][] = []
    const ri = g.Di / 2, ro = g.Do / 2, z0 = g.faceZ, zb = g.zB
    const arc = (cz: number, cr: number, rad: number, a0: number, a1: number) => { for (let i = 0; i <= 14; i++) { const a = a0 + ((a1 - a0) * i) / 14; pts.push([cz + rad * Math.cos(a), cr + rad * Math.sin(a)]) } }
    if (g.sI > 0) { pts.push([z0, ri - g.sI]); if (g.topKind === 'chamfer') pts.push([z0 - g.sI, ri]); else arc(z0 - g.sI, ri - g.sI, g.sI, 0, Math.PI / 2) } else pts.push([z0, ri])
    if (g.rbI > 0) { pts.push([zb + g.rbI, ri]); arc(zb + g.rbI, ri + g.rbI, g.rbI, -Math.PI / 2, -Math.PI) } else pts.push([zb, ri])
    if (g.rbO > 0) { pts.push([zb, ro - g.rbO]); arc(zb + g.rbO, ro - g.rbO, g.rbO, Math.PI, Math.PI / 2) } else pts.push([zb, ro])
    if (g.sO > 0) { pts.push([z0 - g.sO, ro]); if (g.topKind === 'chamfer') pts.push([z0, ro + g.sO]); else arc(z0 - g.sO, ro + g.sO, g.sO, -Math.PI / 2, 0) } else pts.push([z0, ro])
    ctx.save(); ctx.strokeStyle = '#fff'; ctx.setLineDash([2, 3]); ctx.lineWidth = 1.6
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(b.X(p[0]), b.Y(p[1])) : ctx.moveTo(b.X(p[0]), b.Y(p[1])))); ctx.stroke(); ctx.restore()
    // path trace
    const cur = at(st.current.dist)
    ctx.lineWidth = 1.3
    for (let i = 1; i <= cur.i && i < b.path.length; i++) {
      const a = b.path[i - 1], p = b.path[i], e = i === cur.i ? cur : p
      ctx.strokeStyle = p.k === 'G00' ? 'rgba(255,179,77,.55)' : ORANGE; ctx.setLineDash(p.k === 'G00' ? [5, 4] : [])
      ctx.beginPath(); ctx.moveTo(b.X(a.z), b.Y(a.x / 2)); ctx.lineTo(b.X(e.z), b.Y(e.x / 2)); ctx.stroke()
    }
    ctx.setLineDash([])
    // insert
    const q = insertRect(b, cur.x, cur.z)
    ctx.fillStyle = 'rgba(122,167,255,.35)'; ctx.strokeStyle = '#7aa7ff'; ctx.lineWidth = 1.5
    ctx.fillRect(b.X(q.z0), b.Y(q.r1), b.X(q.z1) - b.X(q.z0), b.Y(q.r0) - b.Y(q.r1)); ctx.strokeRect(b.X(q.z0), b.Y(q.r1), b.X(q.z1) - b.X(q.z0), b.Y(q.r0) - b.Y(q.r1))
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.X(cur.z), b.Y(cur.x / 2), 4.5, 0, 7); ctx.fill()
    ctx.fillStyle = '#8a8782'; ctx.font = '13px Segoe UI, sans-serif'
    ctx.fillText('◄ chuck', b.X(b.zMin) + 4, 18); ctx.textAlign = 'right'; ctx.fillText('face ►', b.X(b.zMax) - 4, 18); ctx.textAlign = 'left'
    ctx.fillText(`outer wall (Do ${fmt(g.Do)})`, b.X(z0) + 8, b.Y(ro) - 6)
    ctx.fillText(`inner wall (Di ${fmt(g.Di)})`, b.X(z0) + 8, b.Y(ri) + 16)
    const pt = b.path[Math.min(cur.i, b.path.length - 1)]
    setInfo(pt.text === 'start' ? '' : pt.text)
  }

  // animation loop
  useEffect(() => {
    let raf = 0
    const loop = (t: number) => {
      const s = st.current
      if (s.playing && built) {
        const dt = Math.min(0.05, (t - s.last) / 1000)
        const cur = at(s.dist), seg = built.path[Math.min(cur.i, built.path.length - 1)]
        s.dist = Math.min(built.total, s.dist + (seg.k === 'G00' ? 28 : 7) * speedRef.current * dt)
        if (s.dist >= built.total) { s.playing = false; setPlaying(false) }
        draw(); setSeek(built.total ? Math.round((s.dist / built.total) * 1000) : 0)
      }
      s.last = t; raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [built])

  if (!built) {
    return (
      <div style={{ background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 10, color: '#777', fontSize: 14, padding: '70px 20px', textAlign: 'center' }}>
        {motion.ok ? '' : motion.error}
      </div>
    )
  }
  const btn = { background: ORANGE, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 700, cursor: 'pointer' } as const
  return (
    <div>
      <canvas ref={cv} width={built.W} height={built.H} style={{ width: '100%', display: 'block', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 10 }} />
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: '#aaa', margin: '8px 0 0' }}>
        <span><span style={{ color: '#FFB34D' }}>- - -</span> rapid</span>
        <span><span style={{ color: ORANGE }}>━━</span> cutting move</span>
        <span style={{ color: '#fff' }}>· · · finished groove</span>
        <span style={{ color: '#fff' }}>● tool point (outer corner)</span>
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
        <button type="button" style={btn} onClick={() => {
          const s = st.current
          if (s.dist >= built.total) { s.dist = 0; s.erased = -1 }
          s.playing = !s.playing; setPlaying(s.playing)
        }}>{playing ? '❚❚ Pause' : '▶ Play'}</button>
        <button type="button" style={{ ...btn, background: '#1c1b19', color: '#ccc' }} onClick={() => { const s = st.current; s.playing = false; s.dist = 0; setPlaying(false); setSeek(0); draw() }}>⟲ Reset</button>
        <input type="range" min={0} max={1000} value={seek} style={{ flex: '1 1 160px', padding: 0 }}
          onChange={e => { const s = st.current; s.playing = false; setPlaying(false); setSeek(+e.target.value); s.dist = (built.total * +e.target.value) / 1000; draw() }} />
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
