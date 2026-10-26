// Shared by the G71 logic (server) and the G71 screen (browser preview).
// Plane: horizontal = Z, vertical = radius (X / 2). Z is negative towards the chuck.
// The user gives the real start and end point of every segment, so any chamfer angle
// or radius is possible. A segment is a line (G01) or an arc (G02 clockwise / G03 counter-clockwise).

export type SegType = 'line' | 'g02' | 'g03'
export type InPoint = { x: number; z: number; type: SegType; r: number } // type and r of the first point are ignored

export type Seg =
  | { kind: 'line'; x: number; z: number; len: number; angle: number } // angle in degrees to the Z axis
  | { kind: 'arc'; x: number; z: number; r: number; ccw: boolean; cx: number; cz: number; sweep: number } // cx = centre as diameter, sweep in degrees

export type ProfileResult =
  | { ok: true; start: { x: number; z: number }; segs: Seg[]; concave: { point: number; r: number }[] } // segs[i] ends at point i + 2
  | { ok: false; error: string }

const EPS = 1e-6
const RAD = 180 / Math.PI

export const fmt = (n: number) => String(Number(n.toFixed(3)))

export function buildProfile(pts: InPoint[]): ProfileResult {
  const n = pts.length
  if (n < 2) return { ok: false, error: 'Add at least 2 points' }
  const err = (error: string): ProfileResult => ({ ok: false, error })

  const segs: Seg[] = []
  const concave: { point: number; r: number }[] = []

  for (let i = 1; i < n; i++) {
    const a = { z: pts[i - 1].z, r: pts[i - 1].x / 2 }
    const b = { z: pts[i].z, r: pts[i].x / 2 }
    const dz = b.z - a.z
    const dr = b.r - a.r
    const d = Math.hypot(dz, dr)
    const no = i + 1 // point number shown to the user

    if (d < EPS) return err(`Point ${i} and point ${no} are at the same position`)
    if (dz > EPS) return err(`Point ${no}: Z moves back towards the face. G71 Type I needs Z to keep going towards the chuck`)
    if (dr < -EPS) return err(`Point ${no}: diameter gets smaller towards the chuck. That is an undercut and G71 Type I cannot rough it`)

    const t = pts[i].type
    if (t === 'line') {
      segs.push({ kind: 'line', x: pts[i].x, z: pts[i].z, len: d, angle: Math.atan2(Math.abs(dr), Math.abs(dz)) * RAD })
      continue
    }

    // ----- arc: end point + R + direction -----
    const R = pts[i].r
    if (!Number.isFinite(R) || R <= 0) return err(`Point ${no}: enter the arc radius R (greater than 0)`)
    const half = d / 2
    if (R < half - EPS) {
      return err(`Point ${no}: R${fmt(R)} is too small. The two points are ${fmt(d)} apart, so R must be at least ${fmt(half)}`)
    }
    const h = Math.sqrt(Math.max(0, R * R - half * half))
    const ccw = t === 'g03'
    const uz = dz / d
    const ur = dr / d
    const nz = -ur // left normal of the direction of travel
    const nr = uz
    const sg = ccw ? 1 : -1 // arc up to 180 degrees: centre is on the left for G03, on the right for G02
    const cz = (a.z + b.z) / 2 + nz * h * sg
    const cr = (a.r + b.r) / 2 + nr * h * sg

    let a0 = Math.atan2(a.r - cr, a.z - cz)
    let a1 = Math.atan2(b.r - cr, b.z - cz)
    if (ccw) { if (a1 < a0) a1 += Math.PI * 2 } else { if (a1 > a0) a1 -= Math.PI * 2 }

    // Type I: along the arc Z must never go back and the diameter must never get smaller
    const steps = 64
    let pz = a.z, pr = a.r
    for (let k = 1; k <= steps; k++) {
      const ang = a0 + ((a1 - a0) * k) / steps
      const z = cz + R * Math.cos(ang)
      const r = cr + R * Math.sin(ang)
      if (z > pz + 1e-7 || r < pr - 1e-7) {
        return err(
          `Point ${no}: this arc turns the wrong way for G71 Type I (Z would go back or the diameter would get smaller). ` +
          `An outside (convex) corner is G03 and an inside (concave) corner is G02, and the arc can be at most a quarter circle. Check G02 / G03 and R`
        )
      }
      pz = z; pr = r
    }

    segs.push({ kind: 'arc', x: pts[i].x, z: pts[i].z, r: R, ccw, cx: cr * 2, cz, sweep: Math.abs(a1 - a0) * RAD })
    if (!ccw) concave.push({ point: no, r: R })
  }

  return { ok: true, start: { x: pts[0].x, z: pts[0].z }, segs, concave }
}

// points for drawing (arcs sampled): { z, r } with r = X / 2
export function sampleProfile(start: { x: number; z: number }, segs: Seg[]): { z: number; r: number }[] {
  const out = [{ z: start.z, r: start.x / 2 }]
  let cz = start.z, cr = start.x / 2
  for (const s of segs) {
    if (s.kind === 'line') {
      out.push({ z: s.z, r: s.x / 2 })
    } else {
      const oz = s.cz, or = s.cx / 2
      const a0 = Math.atan2(cr - or, cz - oz)
      const sweep = (s.sweep / RAD) * (s.ccw ? 1 : -1)
      const steps = Math.max(8, Math.ceil(s.sweep / 4))
      for (let k = 1; k <= steps; k++) {
        const a = a0 + (sweep * k) / steps
        out.push({ z: oz + s.r * Math.cos(a), r: or + s.r * Math.sin(a) })
      }
    }
    cz = s.z; cr = s.x / 2
  }
  return out
}
