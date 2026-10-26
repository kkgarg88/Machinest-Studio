import 'server-only'
import { CycleResult, fail, num } from './common'

const LIMITS = { progMax: 7999, feedMax: 5, rpmMax: 4000, diaMax: 500 }
const OFFSETS = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59']
const SPINDLE = ['G96', 'G97']
const EDGE_TYPES = ['plain', '1', '2', '3']
const METHODS = ['plunge', 'plungeturn']
const EPS = 1e-9
const MAX_STEP = 0.9 // plunge-to-plunge step is at most 90% of the insert width

// blank optional field = 0
function opt(v: unknown): number {
  if (v === undefined || v === null || String(v).trim() === '') return 0
  return num(v)
}

const f3 = (n: number) => {
  const s = n.toFixed(3)
  return s === '-0.000' ? '0.000' : s
}

// Face groove: the groove is cut into the face along Z. Tool point = OUTER corner of the insert.
// Di = inner groove diameter (wall nearest the centre), W = radial width, Do = Di + 2W.
export function turningFaceGroove(v: Record<string, unknown>): CycleResult {
  const progNum = num(v.progNum)
  const toolNo = num(v.toolNo)
  const workOffset = String(v.workOffset)
  const spindleMode = String(v.spindleMode)
  const speed = num(v.speed)
  const maxRpm = num(v.maxRpm)
  const feed = num(v.feed)
  const finishFeedRaw = opt(v.finishFeed)
  const safeZ = num(v.safeZ)

  const faceZ = num(v.faceZ)
  const Di = num(v.di)
  const W = num(v.w)
  const H = num(v.h) // groove depth
  const Wt = num(v.insertW)

  const edgeType = String(v.edgeType)
  const methodIn = String(v.method)
  const cI = opt(v.cI), cO = opt(v.cO)
  const rtI = opt(v.rtI), rtO = opt(v.rtO)
  const rbI0 = opt(v.rbI), rbO0 = opt(v.rbO)
  const fDepth0 = opt(v.fDepth), fWall0 = opt(v.fWall)
  const peck = num(v.peck)
  const retract = opt(v.retract)
  const dwell = num(v.dwell)

  if (!Number.isInteger(progNum) || progNum < 1 || progNum > LIMITS.progMax)
    return fail(`Program number must be a whole number between 0001 and ${LIMITS.progMax}`)
  if (!Number.isInteger(toolNo) || toolNo < 1 || toolNo > 99) return fail('Tool number must be a whole number between 1 and 99')
  if (!OFFSETS.includes(workOffset)) return fail('Invalid work offset')
  if (!SPINDLE.includes(spindleMode)) return fail('Invalid spindle mode')
  if (!Number.isFinite(speed) || speed <= 0 || speed > LIMITS.rpmMax)
    return fail(`Speed must be greater than 0 and up to ${LIMITS.rpmMax}`)
  if (spindleMode === 'G96' && (!Number.isFinite(maxRpm) || maxRpm <= 0 || maxRpm > LIMITS.rpmMax))
    return fail('Max Spindle RPM (for G50) is required when using G96')
  if (!Number.isFinite(feed) || feed <= 0 || feed > LIMITS.feedMax)
    return fail(`Feed must be greater than 0 and up to ${LIMITS.feedMax} mm/rev`)
  if (!Number.isFinite(finishFeedRaw) || finishFeedRaw < 0 || finishFeedRaw > LIMITS.feedMax)
    return fail(`Finish feed must be up to ${LIMITS.feedMax} mm/rev`)
  const finishFeed = finishFeedRaw > 0 ? finishFeedRaw : feed
  if (!Number.isFinite(safeZ) || safeZ <= 0) return fail('Safe Z clearance must be greater than 0')

  if (!Number.isFinite(faceZ) || Math.abs(faceZ) > 1000) return fail('Enter the Z position of the face')
  if (!Number.isFinite(Di) || Di <= 0) return fail('Inner groove diameter (Di) must be greater than 0')
  if (!Number.isFinite(W) || W <= 0) return fail('Groove width (W) must be greater than 0')
  if (Di + 2 * W > LIMITS.diaMax) return fail(`Outer groove diameter cannot be larger than ${LIMITS.diaMax} mm`)
  if (!Number.isFinite(H) || H <= 0) return fail('Groove depth must be greater than 0')
  if (!Number.isFinite(Wt) || Wt <= 0) return fail('Insert width must be greater than 0')
  if (Wt > W + EPS) return fail('Insert width cannot be wider than the groove width')
  if (!EDGE_TYPES.includes(edgeType)) return fail('Invalid edge type')
  if (!METHODS.includes(methodIn)) return fail('Invalid cutting method')
  if (!Number.isFinite(peck) || peck <= 0) return fail('Peck depth must be greater than 0')
  if (!Number.isFinite(retract) || retract < 0) return fail('Peck retract cannot be negative')
  if (!Number.isFinite(dwell) || dwell < 0 || dwell > 10) return fail('Dwell must be between 0 and 10 seconds')

  for (const n of [cI, cO, rtI, rtO, rbI0, rbO0, fDepth0, fWall0]) {
    if (!Number.isFinite(n) || n < 0) return fail('Chamfer, radius and finish values cannot be negative')
  }

  const Do = Di + 2 * W
  const topKind: 'none' | 'chamfer' | 'radius' = edgeType === '1' || edgeType === '2' ? 'chamfer' : edgeType === '3' ? 'radius' : 'none'
  const sI = topKind === 'chamfer' ? cI : topKind === 'radius' ? rtI : 0 // top edge size, inner wall
  const sO = topKind === 'chamfer' ? cO : topKind === 'radius' ? rtO : 0 // top edge size, outer wall
  const rbI = edgeType === '2' || edgeType === '3' ? rbI0 : 0
  const rbO = edgeType === '2' || edgeType === '3' ? rbO0 : 0

  const singlePlunge = Math.abs(W - Wt) < EPS
  const method = singlePlunge ? 'plunge' : methodIn
  const hasEdge = sI > 0 || sO > 0 || rbI > 0 || rbO > 0

  if (singlePlunge && hasEdge)
    return fail('Chamfer or radius cannot be cut when the insert is as wide as the groove. Use a narrower insert.')
  if (sI > Di / 2 + EPS) return fail('Inner top chamfer/radius is larger than half the inner diameter')
  if (sI + rbI > H + EPS) return fail('Inner top edge plus inner bottom radius is deeper than the groove depth')
  if (sO + rbO > H + EPS) return fail('Outer top edge plus outer bottom radius is deeper than the groove depth')
  if (rbI + rbO > W + EPS) return fail('Inner and outer bottom radius together are wider than the groove width')
  if ((rbI > 0 || rbO > 0) && rbI + rbO + Wt > W + EPS)
    return fail('Insert is too wide to cut both bottom radii. Groove width must be at least insert width + both bottom radii')
  if (method === 'plunge' && (rbI > 0 || rbO > 0))
    return fail('Bottom radius needs "Plunge + Turn" so the corners are left for the finish pass')

  const fDepth = method === 'plungeturn' ? fDepth0 : 0
  const fWall = method === 'plungeturn' ? fWall0 : 0
  if (fDepth >= H) return fail('Finish allowance on the groove bottom is larger than the groove depth')
  if (method === 'plungeturn' && W - Wt - 2 * fWall < -EPS)
    return fail('Groove is too narrow for this insert with the finish allowance on both walls')

  // ---------- positions (tool point = OUTER corner of the insert, as a diameter) ----------
  const zB = faceZ - H
  const bottomZ = zB + fDepth
  const Ri = (x: number) => x + 2 * Wt // inner-corner diameter -> tool point diameter
  const xTouch = Di + 2 * Wt // insert touching the inner wall

  let positions: number[]
  if (singlePlunge) {
    positions = [Do]
  } else if (method === 'plunge') {
    const S = Do - xTouch
    const n = Math.max(1, Math.ceil(S / 2 / (MAX_STEP * Wt) - 1e-9))
    positions = Array.from({ length: n + 1 }, (_, i) => xTouch + (i * S) / n) // inner to outer
  } else {
    const lo = xTouch + 2 * fWall
    const hi = Do - 2 * fWall
    const S = hi - lo
    const centre = (lo + hi) / 2
    if (S < 1e-6) {
      positions = [centre]
    } else {
      const k = Math.max(1, Math.ceil(S / 4 / (MAX_STEP * Wt) - 1e-9))
      const step = S / (2 * k)
      positions = [centre] // centre first, then inner to outer
      for (let j = -k; j <= k; j++) if (j !== 0) positions.push(centre + j * step)
    }
  }

  // peck targets (Z values)
  const targets: number[] = []
  for (let t = faceZ - peck; t > bottomZ + EPS; t -= peck) targets.push(t)
  targets.push(bottomZ)

  const apZ = faceZ + 0.5 // approach: 0.5 mm above the face
  const safeTop = faceZ + safeZ
  const programName = 'O' + String(progNum).padStart(4, '0')
  const tool = String(Math.trunc(toolNo)).padStart(2, '0')
  const sBlock = spindleMode === 'G96' ? `G50 S${maxRpm};\nG96 S${speed} M03;` : `G97 S${speed} M03;`

  const out: string[] = [
    '%',
    `${programName};`,
    '(FACE GROOVE - TURNING);',
    '(Powered by MACHINEST);',
    '(SUPPORT-7988277215);',
    `(DI=${f3(Di)} DO=${f3(Do)} DEPTH=${f3(H)} W=${f3(W)} INSERT=${f3(Wt)});`,
    `(${method === 'plunge' ? 'PLUNGE ONLY' : 'PLUNGE + TURN'} - TOOL POINT = OUTER CORNER);`,
    '',
    'G21 G99 G40;',
    'G28 U0 W0;',
    `T${tool}${tool};`,
    `G90 ${workOffset};`,
    sBlock,
    `G00 X${f3(positions[0])} Z${f3(safeTop)};`,
  ]

  // ---------- rough plunges ----------
  out.push('(ROUGH PLUNGES);')
  positions.forEach((x, i) => {
    out.push(`(PLUNGE ${i + 1} OF ${positions.length});`)
    out.push(`G00 X${f3(x)};`)
    out.push(`G00 Z${f3(apZ)};`)
    targets.forEach((t, k) => {
      out.push(`G01 Z${f3(t)} F${f3(feed)};`)
      if (k < targets.length - 1 && retract > 0) {
        out.push(`G00 Z${f3(t + retract)};`)
        out.push(`G00 Z${f3(t + 0.1)};`)
      }
    })
    if (dwell > 0) out.push(`G04 X${dwell.toFixed(1)};`)
    out.push(`G00 Z${f3(apZ)};`)
  })

  // ---------- edge / finish pass ----------
  const topMove = (x: number, z: number, size: number) => {
    if (topKind === 'chamfer') out.push(`G01 X${f3(x)} Z${f3(z)};`)
    else out.push(`G03 X${f3(x)} Z${f3(z)} R${f3(size)};`)
  }
  if (method === 'plungeturn') {
    out.push('(FINISH PASS - INNER WALL, BOTTOM, OUTER WALL);')
    out.push(`G00 X${f3(Ri(Di - 2 * sI))};`)
    out.push(`G01 Z${f3(faceZ)} F${f3(finishFeed)};`)
    if (sI > 0) topMove(Ri(Di), faceZ - sI, sI)
    out.push(`G01 Z${f3(zB + rbI)};`)
    if (rbI > 0) out.push(`G02 X${f3(Ri(Di + 2 * rbI))} Z${f3(zB)} R${f3(rbI)};`)
    out.push(`G01 X${f3(Do - 2 * rbO)};`)
    if (rbO > 0) out.push(`G02 X${f3(Do)} Z${f3(zB + rbO)} R${f3(rbO)};`)
    if (sO > 0) {
      out.push(`G01 Z${f3(faceZ - sO)};`)
      topMove(Do + 2 * sO, faceZ, sO)
    } else {
      out.push(`G01 Z${f3(faceZ)};`)
    }
  } else if (hasEdge) {
    if (sI > 0) {
      out.push('(EDGE PASS - INNER);')
      out.push(`G00 X${f3(Ri(Di - 2 * sI))};`)
      out.push(`G01 Z${f3(faceZ)} F${f3(finishFeed)};`)
      topMove(Ri(Di), faceZ - sI, sI)
      out.push(`G00 Z${f3(apZ)};`)
    }
    if (sO > 0) {
      out.push('(EDGE PASS - OUTER);')
      out.push(`G00 X${f3(Do)};`)
      out.push(`G01 Z${f3(faceZ - sO)} F${f3(finishFeed)};`)
      topMove(Do + 2 * sO, faceZ, sO)
    }
  }

  out.push(`G00 Z${f3(safeTop)};`, 'G28 U0 W0;', 'M05;', 'M30;', '%')

  return { ok: true, gcode: out.join('\n'), svg: '', programName }
}
