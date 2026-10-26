// Shared by the Tapping logic (server) and the Tapping screen (browser animation).
// Centre-line tapping: X is always 0, only Z moves. Z is negative into the part.
import type { CentreSeg } from './drill-motion'

export type TapMethod = 'rigid' | 'sync'
export type TapInput = { D: number; lead: number; depth: number; faceZ: number; method: TapMethod; rpm: number; dwell: number; maxFeed: number }
export type TapCalc =
  | { ok: true; geom: { kind: 'tap'; D: number; lead: number; preD: number; zEnd: number; faceZ: number; zInit: number; zR: number; zS: number }; segs: CentreSeg[]; warns: string[] }
  | { ok: false; error: string }

const f3 = (n: number) => String(Number(n.toFixed(3)))

export function computeTap(i: TapInput): TapCalc {
  const bad = (error: string): TapCalc => ({ ok: false, error })
  const { D, lead, depth, faceZ, method, rpm, dwell, maxFeed } = i
  if (![D, lead, depth, faceZ, rpm].every(Number.isFinite)) return bad('Enter the tap diameter, pitch, depth and speed to see the movement')
  if (D <= 0 || D > 100) return bad('Tap diameter must be between 0 and 100 mm')
  if (lead < 0.1 || lead > 12) return bad('Pitch must be between 0.1 and 12 mm')
  if (lead >= D) return bad('Pitch must be smaller than the tap diameter')
  if (depth <= 0 || depth > 1000) return bad('Thread depth must be between 0 and 1000 mm')
  if (Math.abs(faceZ) > 1000) return bad('Face Z is not valid')
  if (rpm <= 0 || rpm > 6000) return bad('Spindle speed must be greater than 0 and up to 6000 RPM')
  if (!Number.isFinite(dwell) || dwell < 0 || dwell > 10) return bad('Dwell must be between 0 and 10 seconds')
  const warns: string[] = []
  if (Number.isFinite(maxFeed) && lead * rpm > maxFeed) warns.push(`Lead × RPM = ${Math.round(lead * rpm)} mm/min is above the machine limit ${maxFeed}. Reduce the RPM.`)

  const zEnd = faceZ - depth
  const zInit = faceZ + 5, zR = faceZ + 2, zS = faceZ + Math.max(3 * lead, 2)
  const segs: CentreSeg[] = []
  const S = (k: CentreSeg['k'], z0: number, z1: number, label: string, spin: CentreSeg['spin'] = 'M03') => segs.push({ k, z0, z1, label, spin })
  S('rapid', zInit + 6, zInit, `G00 X0 Z${f3(zInit)}`)
  if (method === 'rigid') {
    S('rapid', zInit, zR, `to R point Z${f3(zR)}`)
    S('feed', zR, zEnd, `tap in to Z${f3(zEnd)} (feed = pitch)`)
    if (dwell > 0) S('dwell', zEnd, zEnd, 'dwell, spindle reverses', 'M04')
    S('feed', zEnd, zR, 'tap out (spindle reverse)', 'M04')
    S('rapid', zR, zInit, 'return')
  } else {
    S('rapid', zInit, zS, `G00 Z${f3(zS)}`)
    S('feed', zS, zEnd, `tap in to Z${f3(zEnd)}`)
    S('dwell', zEnd, zEnd, 'spindle stop', 'M05')
    S('dwell', zEnd, zEnd, 'spindle reverse', 'M04')
    S('feed', zEnd, zS, 'tap out', 'M04')
    S('dwell', zS, zS, 'spindle stop', 'M05')
    S('rapid', zS, zInit, `G00 Z${f3(zInit)}`)
  }
  return { ok: true, geom: { kind: 'tap', D, lead, preD: D - lead, zEnd, faceZ, zInit, zR, zS }, segs, warns }
}
