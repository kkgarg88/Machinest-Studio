'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ThreadCalc } from '@/lib/cycles/thread-motion'

const ORANGE = '#F0801E'
const fmt = (n: number) => String(Number(n.toFixed(3)))
type P = { x: number; z: number; k: string; pass: number; d: number }

// Animated side view of the tool cutting the thread pass after pass, the zoomed thread tooth with all passes, and the pass table.
export default function ThreadAnim({ calc }: { calc: ThreadCalc }) {
  const cv = useRef<HTMLCanvasElement>(null)
  const cv2 = useRef<HTMLCanvasElement>(null)
  const matRef = useRef<HTMLCanvasElement | null>(null)
  const st = useRef({ dist: 0, playing: false, erased: -1, last: 0 })
  const [playing, setPlaying] = useState(false)
  const [seek, setSeek] = useState(0)
  const [speed, setSpeed] = useState('1')
  const [pass, setPass] = useState(-1)
  const speedRef = useRef(1)
  speedRef.current = parseFloat(speed) || 1

  const built = useMemo(() => {
    if (!calc.ok) return null
    const g = calc.geom, sch = calc.sch
    const path: P[] = []
    let total = 0
    const push = (x: number, z: number, k: string, p: number) => {
      if (!path.length) { path.push({ x, z, k, pass: p, d: 0 }); return }
      const q = path[path.length - 1]
      total += Math.hypot((x - q.x) / 2, z - q.z)
      path.push({ x, z, k, pass: p, d: total })
    }
    push(g.xS, g.zS, 'G00', -1)
    sch.forEach((s, i) => {
      const x = g.D - 2 * s.c
      push(x, g.zS, 'G00', i)
      if (g.cl > 0) { push(x, g.zEnd + g.cl, 'G33', i); push(x + 2 * g.cl, g.zEnd, 'G33', i) } else push(x, g.zEnd, 'G33', i)
      push(g.xS, path[path.length - 1].z, 'G00', i)
      push(g.xS, g.zS, 'G00', i)
    })
    const zMin = g.zEnd - 4, zMax = g.zS + 3
    const rTop = g.D / 2 + 4, rBot = g.D / 2 - Math.max(g.h * 1.8, 2.8)
    const W = 900, H = 300, pad = 22
    const k = Math.min((W - 2 * pad) / (zMax - zMin), (H - 2 * pad) / (rTop - rBot))
    const ox = pad + ((W - 2 * pad) - (zMax - zMin) * k) / 2, oy = pad + ((H - 2 * pad) - (rTop - rBot) * k) / 2
    return { g, sch, path, total, W, H, zMin, zMax, rTop, rBot, X: (z: number) => ox + (z - zMin) * k, Y: (r: number) => oy + (rTop - r) * k }
  }, [calc])

  useEffect(() => {
    st.current.dist = 0; st.current.playing = false; st.current.erased = -1
    setPlaying(false); setSeek(0)
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
  const tri = (x: number, z: number): [number, number][] => {
    const r = x / 2, hgt = 3.2, hw = hgt * Math.tan(Math.PI / 6)
    return [[z, r], [z - hw, r + hgt], [z + hw, r + hgt]]
  }
  function fillMaterial(b: NonNullable<typeof built>) {
    if (!matRef.current) { matRef.current = document.createElement('canvas'); matRef.current.width = b.W; matRef.current.height = b.H }
    const m = matRef.current.getContext('2d')!
    m.globalCompositeOperation = 'source-over'; m.clearRect(0, 0, b.W, b.H)
    m.fillStyle = 'rgba(240,128,30,.20)'
    m.fillRect(b.X(b.zMin) - 2, b.Y(b.g.D / 2), b.X(b.g.zS + 2.5) - b.X(b.zMin) + 2, b.Y(b.rBot) - b.Y(b.g.D / 2))
  }
  function eraseUpTo(b: NonNullable<typeof built>, dd: number) {
    if (dd < st.current.erased || st.current.erased < 0) { fillMaterial(b); st.current.erased = 0 }
    const m = matRef.current!.getContext('2d')!
    m.globalCompositeOperation = 'destination-out'; m.fillStyle = '#000'
    for (let s = st.current.erased; s <= dd; s += 0.05) {
      const p = at(s)
      if (b.path[p.i] && b.path[p.i].k === 'G00') continue
      const t = tri(p.x, p.z)
      m.beginPath(); t.forEach((q, i) => (i ? m.lineTo(b.X(q[0]), b.Y(q[1])) : m.moveTo(b.X(q[0]), b.Y(q[1])))); m.closePath(); m.fill()
    }
    st.current.erased = dd
  }

  function drawTooth(b: NonNullable<typeof built>, passNo: number) {
    const c = cv2.current
    if (!c) return
    const c2 = c.getContext('2d')!
    const g = b.g, P = g.P, h = g.h, W = c.width, H = c.height
    c2.clearRect(0, 0, W, H)
    const k = Math.min((W - 40) / (4 * P), (H - 70) / (h * 1.5))
    const x0 = W / 2, y0 = 40
    const X = (z: number) => x0 + z * k, Y = (d: number) => y0 + d * k
    const half = Math.tan(Math.PI / 6)
    const profile = () => { c2.moveTo(0, y0); for (let n = -3; n <= 3; n++) { const zc = n * P; c2.lineTo(X(zc - h * half), y0); c2.lineTo(X(zc), Y(h)); c2.lineTo(X(zc + h * half), y0) } c2.lineTo(W, y0) }
    c2.fillStyle = 'rgba(240,128,30,.18)'; c2.beginPath(); profile(); c2.lineTo(W, H); c2.lineTo(0, H); c2.closePath(); c2.fill()
    c2.strokeStyle = '#fff'; c2.lineWidth = 2; c2.beginPath(); profile(); c2.stroke()
    const t = g.ang === 0 ? 0 : Math.tan(((g.ang === 60 ? 30 : g.ang) * Math.PI) / 180)
    const firstFinish = b.sch.findIndex(q => q.kind === 'finish')
    b.sch.forEach((s, i) => {
      if (i > passNo) return
      const zc = g.ang === 0 ? 0 : (s.c - h) * t
      c2.strokeStyle = i === passNo ? '#FFB34D' : 'rgba(255,179,77,.35)'; c2.lineWidth = i === passNo ? 2.4 : 1
      c2.beginPath(); c2.moveTo(X(zc - s.c * half), y0); c2.lineTo(X(zc), Y(s.c)); c2.lineTo(X(zc + s.c * half), y0); c2.stroke()
      if (s.kind === 'rough' || i === firstFinish) { c2.fillStyle = i === passNo ? '#FFB34D' : '#aaa'; c2.font = '11px Segoe UI, sans-serif'; c2.fillText(String(i + 1), X(zc) - 3, Y(s.c) + 13) }
    })
    c2.fillStyle = '#8a8782'; c2.font = '12px Segoe UI, sans-serif'; c2.textAlign = 'left'
    c2.fillText('major diameter (thread top)', 10, y0 - 8)
    c2.fillText(`h = ${fmt(h)}  ·  pitch ${fmt(P)}`, 10, H - 10)
    c2.textAlign = 'right'
    c2.fillText(g.ang === 0 ? 'radial infeed: the tool goes straight down' : 'flank infeed: the tool slides along one flank', W - 10, H - 10)
    c2.textAlign = 'left'
  }

  function draw() {
    const c = cv.current
    if (!c || !built) return
    const ctx = c.getContext('2d')!
    const b = built, g = b.g
    ctx.clearRect(0, 0, b.W, b.H)
    eraseUpTo(b, st.current.dist)
    ctx.drawImage(matRef.current!, 0, 0)
    ctx.lineWidth = 1
    ctx.strokeStyle = '#8a8782'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(b.X(b.zMin), b.Y(g.D / 2)); ctx.lineTo(b.X(g.zS + 2.5), b.Y(g.D / 2)); ctx.stroke()
    ctx.strokeStyle = '#7aa7ff'; ctx.beginPath(); ctx.moveTo(b.X(g.zEnd), b.Y(b.rTop)); ctx.lineTo(b.X(g.zEnd), b.Y(b.rBot)); ctx.stroke()
    ctx.strokeStyle = '#9ad7b0'; ctx.beginPath(); ctx.moveTo(b.X(g.zStart), b.Y(b.rTop)); ctx.lineTo(b.X(g.zStart), b.Y(b.rBot)); ctx.stroke()
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(b.X(b.zMin), b.Y(g.minor / 2)); ctx.lineTo(b.X(g.zS + 2.5), b.Y(g.minor / 2)); ctx.stroke(); ctx.setLineDash([])
    ctx.font = '12px Segoe UI, sans-serif'
    ctx.fillStyle = '#7aa7ff'; ctx.fillText('thread end Z' + fmt(g.zEnd), b.X(g.zEnd) + 4, b.Y(b.rBot) - 6)
    ctx.fillStyle = '#9ad7b0'; ctx.fillText('thread start Z' + fmt(g.zStart), b.X(g.zStart) - 100, b.Y(b.rBot) - 6)
    ctx.fillStyle = '#8a8782'; ctx.fillText('◄ chuck', b.X(b.zMin) + 4, 14); ctx.textAlign = 'right'; ctx.fillText('start point ►', b.X(g.zS + 2.5) - 4, 14); ctx.textAlign = 'left'
    ctx.fillText('minor dia ' + fmt(g.minor), b.X(g.zStart + 2.2), b.Y(g.minor / 2) + 14)
    const cur = at(st.current.dist)
    ctx.lineWidth = 1.2
    for (let i = 1; i <= cur.i && i < b.path.length; i++) {
      const a = b.path[i - 1], q = b.path[i], e = i === cur.i ? cur : q
      ctx.strokeStyle = q.k === 'G00' ? 'rgba(255,179,77,.4)' : ORANGE; ctx.setLineDash(q.k === 'G00' ? [5, 4] : [])
      ctx.beginPath(); ctx.moveTo(b.X(a.z), b.Y(a.x / 2)); ctx.lineTo(b.X(e.z), b.Y(e.x / 2)); ctx.stroke()
    }
    ctx.setLineDash([])
    const t = tri(cur.x, cur.z)
    ctx.fillStyle = 'rgba(122,167,255,.45)'; ctx.strokeStyle = '#7aa7ff'
    ctx.beginPath(); t.forEach((q, i) => (i ? ctx.lineTo(b.X(q[0]), b.Y(q[1])) : ctx.moveTo(b.X(q[0]), b.Y(q[1])))); ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(b.X(cur.z), b.Y(cur.x / 2), 3.5, 0, 7); ctx.fill()
    const passNo = b.path[Math.min(cur.i, b.path.length - 1)].pass
    drawTooth(b, passNo)
    setPass(passNo)
  }

  useEffect(() => {
    let raf = 0
    const loop = (t: number) => {
      const s = st.current
      if (s.playing && built) {
        const dt = Math.min(0.05, (t - s.last) / 1000)
        const cur = at(s.dist), seg = built.path[Math.min(cur.i, built.path.length - 1)]
        s.dist = Math.min(built.total, s.dist + (seg.k === 'G00' ? 40 : 14) * speedRef.current * dt)
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
        {calc.ok ? '' : calc.error}
      </div>
    )
  }
  const btn = { background: ORANGE, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 16px', fontWeight: 700, cursor: 'pointer' } as const
  const cs = { width: '100%', display: 'block', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 10 } as const
  const th = { color: '#999', fontWeight: 600, borderBottom: '1px solid #3a3733', padding: '4px 8px', textAlign: 'right' } as const
  return (
    <div>
      <canvas ref={cv} width={built.W} height={built.H} style={cs} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 10 }}>
        <button type="button" style={btn} onClick={() => {
          const s = st.current
          if (s.dist >= built.total) { s.dist = 0; s.erased = -1 }
          s.playing = !s.playing; setPlaying(s.playing)
        }}>{playing ? '❚❚ Pause' : '▶ Play'}</button>
        <button type="button" style={{ ...btn, background: '#1c1b19', color: '#ccc' }} onClick={() => { const s = st.current; s.playing = false; s.dist = 0; s.erased = -1; setPlaying(false); setSeek(0); draw() }}>⟲ Reset</button>
        <input type="range" min={0} max={1000} value={seek} style={{ flex: '1 1 160px', padding: 0 }}
          onChange={e => { const s = st.current; s.playing = false; setPlaying(false); setSeek(+e.target.value); s.dist = (built.total * +e.target.value) / 1000; draw() }} />
        <label style={{ color: '#ccc', fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>Speed
          <select value={speed} onChange={e => setSpeed(e.target.value)} style={{ background: '#1c1b19', color: '#fff', border: '1px solid #3a3733', borderRadius: 6, padding: '3px 6px' }}>
            {['0.5', '1', '2', '4'].map(v => <option key={v}>{v}</option>)}
          </select>
        </label>
      </div>
      <div style={{ color: ORANGE, fontFamily: 'Consolas, monospace', fontSize: 13, marginTop: 8, minHeight: 18 }}>
        {pass < 0 ? 'Start point' : `Pass ${pass + 1} of ${built.sch.length} – X${fmt(built.g.D - 2 * built.sch[pass].c)} (${built.sch[pass].kind})`}
      </div>

      <h4 style={{ color: '#fff', margin: '16px 0 8px', fontSize: 14 }}>Thread tooth – all passes stacked</h4>
      <canvas ref={cv2} width={900} height={300} style={cs} />
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, marginTop: 8 }}>
        <thead><tr><th style={th}>Pass</th><th style={th}>Depth (radial)</th><th style={th}>Increment</th><th style={th}>X (dia)</th><th style={th}>Type</th></tr></thead>
        <tbody>
          {built.sch.map((s, i) => (
            <tr key={i} style={{ background: i === pass ? 'rgba(240,128,30,.25)' : 'transparent', color: i === pass ? '#fff' : '#ccc' }}>
              {[i + 1, fmt(s.c), fmt(s.c - (i ? built.sch[i - 1].c : 0)), (built.g.D - 2 * s.c).toFixed(3), s.kind].map((v, j) => (
                <td key={j} style={{ borderBottom: '1px solid #3a3733', padding: '4px 8px', textAlign: 'right' }}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
