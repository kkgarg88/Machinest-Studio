// Tool movement of the Face Groove cycle, for the animated preview in the browser.
// It follows the same rules as lib/cycles/logic/turning-facegroove.ts (the program generator).
export type FgInput = {
  faceZ: number; di: number; w: number; h: number; insertW: number
  edge: 'plain' | '1' | '2' | '3'; method: 'plunge' | 'plungeturn'
  cI: number; cO: number; rtI: number; rtO: number; rbI: number; rbO: number
  fDepth: number; fWall: number; peck: number; retract: number; safeZ: number
}
export type FgMove = { k: 'G00' | 'G01' | 'G02' | 'G03'; x: number; z: number; R?: number; text: string }
export type FgGeom = { Di: number; Do: number; H: number; faceZ: number; zB: number; sI: number; sO: number; rbI: number; rbO: number; topKind: 'none' | 'chamfer' | 'radius'; Wt: number }
export type FgMotion = { ok: true; moves: FgMove[]; start: { x: number; z: number }; geom: FgGeom } | { ok: false; error: string }

const E = 1e-9
const MAX_STEP = 0.9
const f3 = (n: number) => { const s = n.toFixed(3); return s === '-0.000' ? '0.000' : s }
const pos = (n: number) => (isFinite(n) && n > 0 ? n : 0)

export function faceGrooveMotion(p: FgInput): FgMotion {
  const err = (error: string): FgMotion => ({ ok: false, error })
  const { faceZ, di: Di, w: W, h: H, insertW: Wt } = p
  if (![faceZ, Di, W, H, Wt, p.peck].every(isFinite)) return err('Enter the groove values to see the sketch')
  if (Di <= 0 || W <= 0 || H <= 0 || Wt <= 0 || p.peck <= 0) return err('Enter the groove values to see the sketch')
  if (Wt > W + E) return err('Insert width cannot be wider than the groove width')
  const Do = Di + 2 * W
  const topKind = p.edge === '1' || p.edge === '2' ? 'chamfer' : p.edge === '3' ? 'radius' : 'none'
  const sI = topKind === 'chamfer' ? pos(p.cI) : topKind === 'radius' ? pos(p.rtI) : 0
  const sO = topKind === 'chamfer' ? pos(p.cO) : topKind === 'radius' ? pos(p.rtO) : 0
  const rbI = p.edge === '2' || p.edge === '3' ? pos(p.rbI) : 0
  const rbO = p.edge === '2' || p.edge === '3' ? pos(p.rbO) : 0
  const single = Math.abs(W - Wt) < E
  const method = single ? 'plunge' : p.method
  const hasEdge = sI > 0 || sO > 0 || rbI > 0 || rbO > 0
  if (single && hasEdge) return err('Chamfer or radius cannot be cut when the insert is as wide as the groove')
  if (sI > Di / 2 + E || sI + rbI > H + E || sO + rbO > H + E) return err('Chamfer / radius is too large for this groove')
  if (rbI + rbO > W + E || ((rbI > 0 || rbO > 0) && rbI + rbO + Wt > W + E)) return err('Bottom radius does not fit in the groove width')
  if (method === 'plunge' && (rbI > 0 || rbO > 0)) return err('Bottom radius needs Plunge + Turn')
  const fDepth = method === 'plungeturn' ? pos(p.fDepth) : 0
  const fWall = method === 'plungeturn' ? pos(p.fWall) : 0
  if (fDepth >= H) return err('Finish allowance on the bottom is larger than the groove depth')
  if (method === 'plungeturn' && W - Wt - 2 * fWall < -E) return err('Groove is too narrow for this insert with the finish allowance')

  const zB = faceZ - H
  const bottomZ = zB + fDepth
  const Ri = (x: number) => x + 2 * Wt
  const xTouch = Di + 2 * Wt
  let positions: number[]
  if (single) positions = [Do]
  else if (method === 'plunge') {
    const S = Do - xTouch
    const n = Math.max(1, Math.ceil(S / 2 / (MAX_STEP * Wt) - 1e-9))
    positions = Array.from({ length: n + 1 }, (_, i) => xTouch + (i * S) / n)
  } else {
    const lo = xTouch + 2 * fWall, hi = Do - 2 * fWall, S = hi - lo, c = (lo + hi) / 2
    if (S < 1e-6) positions = [c]
    else {
      const k = Math.max(1, Math.ceil(S / 4 / (MAX_STEP * Wt) - 1e-9))
      const step = S / (2 * k)
      positions = [c]
      for (let j = -k; j <= k; j++) if (j !== 0) positions.push(c + j * step)
    }
  }
  const targets: number[] = []
  for (let t = faceZ - p.peck; t > bottomZ + E; t -= p.peck) targets.push(t)
  targets.push(bottomZ)

  const apZ = faceZ + 0.5, safeTop = faceZ + (p.safeZ > 0 ? p.safeZ : 2)
  const moves: FgMove[] = []
  const retract = pos(p.retract)
  const add = (k: FgMove['k'], x: number, z: number, text: string, R?: number) => moves.push({ k, x, z, R, text })
  const start = { x: positions[0], z: safeTop }

  positions.forEach(x => {
    add('G00', x, apZ, `G00 X${f3(x)} Z${f3(apZ)}`)
    targets.forEach((t, k) => {
      add('G01', x, t, `G01 Z${f3(t)}`)
      if (k < targets.length - 1 && retract > 0) {
        add('G00', x, t + retract, `G00 Z${f3(t + retract)}`)
        add('G00', x, t + 0.1, `G00 Z${f3(t + 0.1)}`)
      }
    })
    add('G00', x, apZ, `G00 Z${f3(apZ)}`)
  })
  const top = (x: number, z: number, size: number) => {
    if (topKind === 'chamfer') add('G01', x, z, `G01 X${f3(x)} Z${f3(z)}`)
    else add('G03', x, z, `G03 X${f3(x)} Z${f3(z)} R${f3(size)}`, size)
  }
  if (method === 'plungeturn') {
    add('G00', Ri(Di - 2 * sI), apZ, `G00 X${f3(Ri(Di - 2 * sI))}`)
    add('G01', Ri(Di - 2 * sI), faceZ, `G01 Z${f3(faceZ)}`)
    if (sI > 0) top(Ri(Di), faceZ - sI, sI)
    add('G01', Ri(Di), zB + rbI, `G01 Z${f3(zB + rbI)}`)
    if (rbI > 0) add('G02', Ri(Di + 2 * rbI), zB, `G02 X${f3(Ri(Di + 2 * rbI))} Z${f3(zB)} R${f3(rbI)}`, rbI)
    add('G01', Do - 2 * rbO, zB, `G01 X${f3(Do - 2 * rbO)}`)
    if (rbO > 0) add('G02', Do, zB + rbO, `G02 X${f3(Do)} Z${f3(zB + rbO)} R${f3(rbO)}`, rbO)
    if (sO > 0) { add('G01', Do, faceZ - sO, `G01 Z${f3(faceZ - sO)}`); top(Do + 2 * sO, faceZ, sO) }
    else add('G01', Do, faceZ, `G01 Z${f3(faceZ)}`)
  } else if (hasEdge) {
    if (sI > 0) {
      add('G00', Ri(Di - 2 * sI), apZ, `G00 X${f3(Ri(Di - 2 * sI))}`)
      add('G01', Ri(Di - 2 * sI), faceZ, `G01 Z${f3(faceZ)}`)
      top(Ri(Di), faceZ - sI, sI)
      add('G00', Ri(Di), apZ, `G00 Z${f3(apZ)}`)
    }
    if (sO > 0) {
      add('G00', Do, apZ, `G00 X${f3(Do)}`)
      add('G01', Do, faceZ - sO, `G01 Z${f3(faceZ - sO)}`)
      top(Do + 2 * sO, faceZ, sO)
    }
  }
  add('G00', moves[moves.length - 1].x, safeTop, `G00 Z${f3(safeTop)}`)
  return { ok: true, moves, start, geom: { Di, Do, H, faceZ, zB, sI, sO, rbI, rbO, topKind, Wt } }
}
