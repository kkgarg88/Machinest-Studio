// Numbers of the Threading (OD) cycle. Used by the program generator (server) and by the animated preview (browser),
// so both always show the same passes.
export type ThreadInput = {
  D: number; P: number; h: number; zStart: number; L: number
  d1: number; dmin: number; fin: number; m: number; rpm: number; maxFeed: number
  runout: 'groove' | 'chamfer'; ang: number
}
export type Pass = { c: number; kind: 'rough' | 'finish' }
export type ThreadGeom = {
  D: number; P: number; h: number; minor: number; zStart: number; zEnd: number
  zS: number; xS: number; leadIn: number; cl: number; ang: number; rr: number
}
export type ThreadCalc = { ok: true; sch: Pass[]; geom: ThreadGeom; warns: string[] } | { ok: false; error: string }

export const ANGLES = [60, 29, 0]

// each pass cuts d1 x sqrt(n) deep in total, never less than dmin more than the pass before,
// until the finish allowance is left; then the finish (spring) passes at full depth
export function threadSchedule(h: number, d1: number, dmin: number, fin: number, m: number): Pass[] {
  const target = h - fin
  const out: Pass[] = []
  let cum = 0, n = 0
  while (cum < target - 1e-9 && n < 300) {
    n++
    let next = d1 * Math.sqrt(n)
    if (next - cum < dmin) next = cum + dmin
    if (next > target) next = target
    out.push({ c: next, kind: 'rough' })
    cum = next
  }
  for (let i = 0; i < m; i++) out.push({ c: h, kind: 'finish' })
  return out
}

export function computeThread(p: ThreadInput): ThreadCalc {
  const err = (error: string): ThreadCalc => ({ ok: false, error })
  const { D, P, h, zStart, L, d1, dmin, fin, m, rpm, maxFeed } = p
  if (![D, P, h, zStart, L, d1, dmin, rpm].every(Number.isFinite) || D <= 0 || P <= 0 || h <= 0 || L <= 0 || d1 <= 0 || rpm <= 0)
    return err('Enter the thread values to see the sketch')
  if (!ANGLES.includes(p.ang)) return err('Invalid infeed angle')
  const minor = D - 2 * h
  if (minor <= 0) return err('Thread height is too large: the minor diameter would be zero or negative')
  if (d1 > h) return err('First cut depth is larger than the thread height')
  if (!(fin >= 0) || fin >= h) return err('Finish allowance must be smaller than the thread height')
  if (dmin <= 0 || dmin > h) return err('Minimum cut depth must be greater than 0 and not above the thread height')
  const warns: string[] = []
  if (P * rpm > maxFeed) warns.push(`Lead × RPM = ${Math.round(P * rpm)} mm/min is above the machine limit ${maxFeed}. Reduce the RPM.`)
  const leadIn = Math.max(3 * P, (P * rpm) / 500)
  const sch = threadSchedule(h, d1, dmin, fin, m)
  if (sch.length > 80) return err('Too many passes. Increase the first cut depth or the minimum cut depth')
  const rr = p.runout === 'chamfer' ? 10 : 0
  return {
    ok: true, sch, warns,
    geom: { D, P, h, minor, zStart, zEnd: zStart - L, zS: zStart + leadIn, xS: D + 4, leadIn, cl: rr * 0.1 * P, ang: p.ang, rr },
  }
}
