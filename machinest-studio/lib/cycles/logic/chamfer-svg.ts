import 'server-only'
import { INK, MUTED, GRAY, BLUE, ORANGE, GREEN, px, dim, line, txt, head } from './svg-utils'

type S = {
  od: number
  startX: number
  aEff: number
  bEff: number
  angleUsed: number
  r: number
}

export function buildChamferSvg(s: S): string {
  const o: string[] = []

  // Scale: fit A_eff (Z) and B_eff (X) into a ~220x220 working box
  const scale = Math.min(180 / Math.max(s.aEff, 5), 180 / Math.max(s.bEff, 5))
  const originX = 260, originZ = 120 // origin = full OD corner point (A)

  // OD corner point (sharp theoretical corner, X=OD, Z=0)
  const cornerX = originX
  const cornerZ = originZ

  // Point A (on OD line, Z = -aEff)
  const ax = cornerX
  const az = cornerZ - s.aEff * scale

  // Point B (on face line, X = startX)
  const bx = cornerX - s.bEff * scale
  const bz = cornerZ

  o.push(txt(20, 26, 'CHAMFER PROFILE (Z-X plane)', INK, { size: 15 }))

  // OD line (vertical, going up = -Z direction shown upward)
  o.push(line(cornerX, 20, cornerX, cornerZ, GRAY, '3 3'))
  o.push(txt(cornerX + 10, 60, 'OD line', MUTED, { size: 11, bold: false }))

  // Face line (horizontal)
  o.push(line(40, cornerZ, cornerX, cornerZ, GRAY, '3 3'))
  o.push(txt(45, cornerZ + 18, 'Face (Z0)', MUTED, { size: 11, bold: false }))

  // Theoretical sharp corner (dashed, shows what would happen without nose-radius comp)
  o.push(line(bx, bz, cornerX, cornerZ, '#555', '2 2'))
  o.push(line(cornerX, cornerZ, ax, az, '#555', '2 2'))

  // Actual chamfer cut line (point B to point A)
  o.push(`<line x1="${px(bx)}" y1="${px(bz)}" x2="${px(ax)}" y2="${px(az)}" stroke="${ORANGE}" stroke-width="3"/>`)

  // Points
  o.push(`<circle cx="${px(ax)}" cy="${px(az)}" r="5" fill="${GREEN}" stroke="#111"/>`)
  o.push(txt(ax + 10, az, `A (X=OD, Z=-${s.aEff.toFixed(3)})`, GREEN, { size: 11 }))

  o.push(`<circle cx="${px(bx)}" cy="${px(bz)}" r="5" fill="${BLUE}" stroke="#111"/>`)
  o.push(txt(bx - 10, bz + 18, `B (X=${s.startX.toFixed(3)}, Z=0)`, BLUE, { size: 11, anchor: 'end' }))

  // tool start arrow (from B heading toward A)
  const midx = (ax + bx) / 2, midz = (az + bz) / 2
  o.push(head(midx, midz, Math.atan2(az - bz, ax - bx), ORANGE))

  // Angle label
  o.push(txt(cornerX - 50, cornerZ - 14, `${s.angleUsed.toFixed(2)}\u00B0`, '#ddd', { size: 12 }))

  // Dimension readouts
  o.push(txt(20, 220, `Effective A (with R${s.r} comp): ${s.aEff.toFixed(3)} mm`, ORANGE, { size: 12 }))
  o.push(txt(20, 238, `Effective B (with R${s.r} comp): ${s.bEff.toFixed(3)} mm`, ORANGE, { size: 12 }))
  o.push(txt(20, 256, `Start X (diameter): ${s.startX.toFixed(3)} mm`, '#ddd', { size: 12 }))
  o.push(txt(20, 274, `Final OD: ${s.od.toFixed(3)} mm`, '#ddd', { size: 12 }))

  return `<svg viewBox="0 0 520 300" width="100%" xmlns="http://www.w3.org/2000/svg" role="img">${o.join('')}</svg>`
}