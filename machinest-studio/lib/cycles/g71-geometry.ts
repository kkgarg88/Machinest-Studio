// Shared by the G71 logic (server) and the G71 screen (browser preview).
// Plane: horizontal = Z, vertical = radius (X / 2). Z is negative towards the chuck.

export type Corner = 'sharp' | 'chamfer' | 'radius'
export type ProfilePoint = { x: number; z: number; corner: Corner; size: number }

export type Seg =
  | { kind: 'line'; x: number; z: number }
  | { kind: 'arc'; x: number; z: number; r: number; ccw: boolean; cx: number; cz: number } // x = diameter, cx = centre radius*2

export type ProfileResult =
  | { ok: true; start: { x: number; z: number }; segs: Seg[]; concave: number[] } // concave = point numbers (1-based) of concave radius corners
  | { ok: false; error: string }

const EPS = 1e-6

export function buildProfile(pts: ProfilePoint[]): ProfileResult {
  const n = pts.length
  if (n < 2) return { ok: false, error: 'Add at least 2 points' }
  const P = pts.map(p => ({ z: p.z, r: p.x / 2 }))

  const u: { z: number; r: number }[] = []
  const len: number[] = []
  for (let i = 1; i < n; i++) {
    const dz = P[i].z - P[i - 1].z
    const dr = P[i].r - P[i - 1].r
    const l = Math.hypot(dz, dr)
    if (l < EPS) return { ok: false, error: `Point ${i} and point ${i + 1} are at the same position` }
    u[i] = { z: dz / l, r: dr / l }
    len[i] = l
  }

  // tangent length for each corner
  const t: number[] = new Array(n).fill(0)
  const turn: number[] = new Array(n).fill(0) // cross product sign
  for (let i = 1; i < n - 1; i++) {
    const c = pts[i].corner
    if (c === 'sharp') continue
    const size = pts[i].size
    if (!Number.isFinite(size) || size <= 0) return { ok: false, error: `Point ${i + 1}: chamfer / radius size must be greater than 0` }
    const cross = u[i].z * u[i + 1].r - u[i].r * u[i + 1].z
    const dot = u[i].z * u[i + 1].z + u[i].r * u[i + 1].r
    const phi = Math.atan2(Math.abs(cross), dot) // deflection angle
    if (phi < 1e-4) return { ok: false, error: `Point ${i + 1}: the two lines are straight, so there is no corner to ${c === 'chamfer' ? 'chamfer' : 'round'}` }
    t[i] = c === 'chamfer' ? size : size * Math.tan(phi / 2)
    turn[i] = cross
  }
  for (let i = 1; i < n; i++) {
    if (t[i - 1] + t[i] > len[i] + 1e-6) {
      const where = t[i - 1] > 0 && t[i] > 0 ? `points ${i} and ${i + 1}` : t[i] > 0 ? `point ${i + 1}` : `point ${i}`
      return { ok: false, error: `Chamfer / radius at ${where} is too large for the line between point ${i} and point ${i + 1}` }
    }
  }

  const segs: Seg[] = []
  const concave: number[] = []
  const D = (r: number) => r * 2
  for (let i = 1; i < n; i++) {
    if (t[i] > 0) {
      const a = { z: P[i].z - u[i].z * t[i], r: P[i].r - u[i].r * t[i] }
      const b = { z: P[i].z + u[i + 1].z * t[i], r: P[i].r + u[i + 1].r * t[i] }
      if (Math.hypot(a.z - (segs.length ? lastZ(segs, P[0]) : P[0].z), a.r - (segs.length ? lastR(segs, P[0]) : P[0].r)) > 1e-9)
        segs.push({ kind: 'line', x: D(a.r), z: a.z })
      if (pts[i].corner === 'chamfer') {
        segs.push({ kind: 'line', x: D(b.r), z: b.z })
      } else {
        const ccw = turn[i] > 0
        const rf = pts[i].size
        const nrm = { z: -u[i].r, r: u[i].z } // left normal
        const sgn = ccw ? 1 : -1
        const cz = a.z + nrm.z * rf * sgn
        const cr = a.r + nrm.r * rf * sgn
        segs.push({ kind: 'arc', x: D(b.r), z: b.z, r: rf, ccw, cx: D(cr), cz })
        if (!ccw) concave.push(i + 1)
      }
    } else {
      segs.push({ kind: 'line', x: D(P[i].r), z: P[i].z })
    }
  }
  return { ok: true, start: { x: pts[0].x, z: pts[0].z }, segs, concave }
}

function lastZ(segs: Seg[], p0: { z: number; r: number }) { return segs.length ? segs[segs.length - 1].z : p0.z }
function lastR(segs: Seg[], p0: { z: number; r: number }) { return segs.length ? segs[segs.length - 1].x / 2 : p0.r }

// points for drawing (arcs sampled)
export function sampleProfile(start: { x: number; z: number }, segs: Seg[]): { z: number; r: number }[] {
  const out = [{ z: start.z, r: start.x / 2 }]
  let cz = start.z, cr = start.x / 2
  for (const s of segs) {
    if (s.kind === 'line') {
      out.push({ z: s.z, r: s.x / 2 })
    } else {
      const ox = s.cz, or = s.cx / 2
      const a0 = Math.atan2(cr - or, cz - ox)
      let a1 = Math.atan2(s.x / 2 - or, s.z - ox)
      if (s.ccw) { while (a1 < a0) a1 += Math.PI * 2 } else { while (a1 > a0) a1 -= Math.PI * 2 }
      const steps = 16
      for (let k = 1; k <= steps; k++) {
        const a = a0 + ((a1 - a0) * k) / steps
        out.push({ z: ox + s.r * Math.cos(a), r: or + s.r * Math.sin(a) })
      }
    }
    cz = s.z; cr = s.x / 2
  }
  return out
}
