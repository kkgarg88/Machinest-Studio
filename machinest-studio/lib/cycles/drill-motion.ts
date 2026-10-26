// Shared by the Drilling logic (server) and the Drilling screen (browser animation).
// Centre-line drilling: X is always 0, only Z moves. Z is negative into the part.

export type DrillMethod = 'chip' | 'full' | 'plain'
export type DrillInput = {
  D: number; depth: number; depthTo: 'full' | 'tip'; tip: number; faceZ: number
  method: DrillMethod; Q: number; e: number; rpm: number; feed: number; dwell: number
}
export type CentreSeg = { k: 'rapid' | 'feed' | 'dwell'; z0: number; z1: number; label: string; spin: 'M03' | 'M04' | 'M05' }
export type DrillCalc =
  | { ok: true; geom: { kind: 'drill'; D: number; tipLen: number; zEnd: number; faceZ: number; zInit: number; zR: number }; segs: CentreSeg[]; pecks: number }
  | { ok: false; error: string }

const f3 = (n: number) => String(Number(n.toFixed(3)))
export const CLEAR = 5 // start point above the face
export const RPOINT = 2 // R point above the face

export function computeDrill(i: DrillInput): DrillCalc {
  const bad = (error: string): DrillCalc => ({ ok: false, error })
  const { D, depth, tip, faceZ, method, Q, e, rpm, feed, dwell } = i
  if (![D, depth, tip, faceZ, rpm, feed].every(Number.isFinite)) return bad('Enter the drill diameter, depth, speed and feed to see the movement')
  if (D <= 0 || D > 100) return bad('Drill diameter must be between 0 and 100 mm')
  if (depth <= 0 || depth > 1000) return bad('Hole depth must be between 0 and 1000 mm')
  if (tip < 60 || tip > 180) return bad('Point angle must be between 60 and 180 degrees')
  if (Math.abs(faceZ) > 1000) return bad('Face Z is not valid')
  if (rpm <= 0 || rpm > 6000) return bad('Spindle speed must be greater than 0 and up to 6000 RPM')
  if (feed <= 0 || feed > 2) return bad('Feed must be greater than 0 and up to 2 mm/rev')
  if (!Number.isFinite(dwell) || dwell < 0 || dwell > 10) return bad('Dwell must be between 0 and 10 seconds')

  const tipLen = tip >= 180 ? 0 : D / 2 / Math.tan(((tip / 2) * Math.PI) / 180)
  const zEnd = faceZ - depth - (i.depthTo === 'full' ? tipLen : 0)
  const zInit = faceZ + CLEAR, zR = faceZ + RPOINT
  const segs: CentreSeg[] = []
  const S = (k: CentreSeg['k'], z0: number, z1: number, label: string) => segs.push({ k, z0, z1, label, spin: 'M03' })
  S('rapid', zInit + 6, zInit, `G00 X0 Z${f3(zInit)}`)
  let pecks = 1

  if (method === 'plain') {
    S('rapid', zInit, zR, `G00 Z${f3(zR)}`)
    S('feed', zR, zEnd, `G01 Z${f3(zEnd)}`)
    if (dwell > 0) S('dwell', zEnd, zEnd, 'dwell')
    S('rapid', zEnd, zInit, `G00 Z${f3(zInit)}`)
  } else {
    if (!Number.isFinite(Q) || Q <= 0) return bad('Peck depth must be greater than 0')
    if (Q > zR - zEnd) return bad('Peck depth is larger than the hole depth')
    if (method === 'chip' && (!Number.isFinite(e) || e < 0 || e >= Q)) return bad('Chip-break retract must be 0 or more and smaller than the peck depth')
    S('rapid', zInit, zR, `G00 Z${f3(zR)}`)
    let z = zR, n = 0
    while (z > zEnd + 1e-9) {
      n++
      if (n > 500) return bad('Too many pecks. Increase the peck depth')
      const nz = Math.max(zEnd, z - Q)
      S('feed', z, nz, `peck ${n}: Z${f3(nz)}`)
      if (nz <= zEnd + 1e-9) { z = nz; break }
      if (method === 'chip') {
        S('rapid', nz, nz + e, `retract ${f3(e)} (chip break)`)
        z = nz + e
      } else {
        S('rapid', nz, zR, 'full retract')
        S('rapid', zR, nz + 1, 'rapid down, 1 mm above the last depth')
        z = nz + 1
      }
    }
    pecks = n
    if (method === 'full' && dwell > 0) S('dwell', zEnd, zEnd, 'dwell')
    S('rapid', zEnd, method === 'chip' ? zR : zInit, 'return')
    if (method === 'chip') S('rapid', zR, zInit, `G00 Z${f3(zInit)}`)
  }
  return { ok: true, geom: { kind: 'drill', D, tipLen, zEnd, faceZ, zInit, zR }, segs, pecks }
}
