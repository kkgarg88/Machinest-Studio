// Shared by the G72 logic (server) and the G72 screen (browser preview).
// Plane: horizontal = Z, vertical = radius (X / 2). Z is negative towards the chuck.
// G72 cuts parallel to X (facing) and steps in Z. The profile is entered from the OUTER
// diameter towards the centre: the diameter keeps getting smaller and Z never goes deeper again.
import { InPoint, Seg, fmt } from './g71-geometry'
export { fmt }
export type { InPoint, Seg }
export { sampleProfile } from './g71-geometry'

export type ProfileResult =
  | { ok: true; start: { x: number; z: number }; segs: Seg[]; concave: { point: number; r: number }[] }
  | { ok: false; error: string }

const EPS = 1e-6
const RAD = 180 / Math.PI

export function buildFaceProfile(pts: InPoint[]): ProfileResult {
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
    const no = i + 1

    if (d < EPS) return err(`Point ${i} and point ${no} are at the same position`)
    if (dr > EPS) return err(`Point ${no}: diameter gets bigger. For G72 the profile goes from the outer diameter towards the centre, so the diameter must keep getting smaller`)
    if (dz < -EPS) return err(`Point ${no}: Z goes deeper again. That is an undercut and G72 Type I cannot rough it`)

    const t = pts[i].type
    if (t === 'line') {
      // angle measured to the X axis (face), 0 = flat face
      segs.push({ kind: 'line', x: pts[i].x, z: pts[i].z, len: d, angle: Math.atan2(Math.abs(dz), Math.abs(dr)) * RAD })
      continue
    }

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
    const nz = -ur
    const nr = uz
    const sg = ccw ? 1 : -1
    const cz = (a.z + b.z) / 2 + nz * h * sg
    const cr = (a.r + b.r) / 2 + nr * h * sg

    let a0 = Math.atan2(a.r - cr, a.z - cz)
    let a1 = Math.atan2(b.r - cr, b.z - cz)
    if (ccw) { if (a1 < a0) a1 += Math.PI * 2 } else { if (a1 > a0) a1 -= Math.PI * 2 }

    // Type I: along the arc Z must never go deeper and the diameter must never get bigger
    const steps = 64
    let pz = a.z, pr = a.r
    for (let k = 1; k <= steps; k++) {
      const ang = a0 + ((a1 - a0) * k) / steps
      const z = cz + R * Math.cos(ang)
      const r = cr + R * Math.sin(ang)
      if (z < pz - 1e-7 || r > pr + 1e-7) {
        return err(
          `Point ${no}: this arc turns the wrong way for G72 Type I (Z would go deeper or the diameter would get bigger). ` +
          `For G72 an outside (convex) corner is G02 and an inside (concave) corner is G03, and the arc can be at most a quarter circle. Check G02 / G03 and R`
        )
      }
      pz = z; pr = r
    }

    segs.push({ kind: 'arc', x: pts[i].x, z: pts[i].z, r: R, ccw, cx: cr * 2, cz, sweep: Math.abs(a1 - a0) * RAD })
    if (ccw) concave.push({ point: no, r: R }) // G03 is the inside corner here
  }

  return { ok: true, start: { x: pts[0].x, z: pts[0].z }, segs, concave }
}
