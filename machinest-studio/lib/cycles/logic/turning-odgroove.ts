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

export function turningOdGroove(v: Record<string, unknown>): CycleResult {
  const progNum = num(v.progNum)
  const toolNo = num(v.toolNo)
  const workOffset = String(v.workOffset)
  const spindleMode = String(v.spindleMode)
  const speed = num(v.speed)
  const maxRpm = num(v.maxRpm)
  const feed = num(v.feed)
  const finishFeedRaw = opt(v.finishFeed)
  const safeX = num(v.safeX)
  const safeZ = num(v.safeZ)

  const A = num(v.a) // groove diameter
  const B = num(v.b) // distance from Z0 to the groove wall nearest Z0
  const W = num(v.w) // groove width
  const D = num(v.d) // raw material diameter
  const Wt = num(v.insertW) // insert width

  const edgeType = String(v.edgeType)
  const methodIn = String(v.method)
  const cL = opt(v.cL), cR = opt(v.cR)
  const rtL = opt(v.rtL), rtR = opt(v.rtR)
  const rbL0 = opt(v.rbL), rbR0 = opt(v.rbR)
  const fDia0 = opt(v.fDia), fFace0 = opt(v.fFace)
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
  if (!Number.isFinite(safeX) || safeX <= 0) return fail('Safe X clearance must be greater than 0')
  if (!Number.isFinite(safeZ) || safeZ <= 0) return fail('Safe Z clearance must be greater than 0')

  if (!Number.isFinite(D) || D <= 0 || D > LIMITS.diaMax) return fail(`R.M. diameter (D) must be between 0 and ${LIMITS.diaMax} mm`)
  if (!Number.isFinite(A) || A <= 0) return fail('Groove diameter (A) must be greater than 0')
  if (A >= D) return fail('Groove diameter (A) must be smaller than the R.M. diameter (D)')
  if (!Number.isFinite(B) || B <= 0) return fail('Distance from Z0 (B) must be greater than 0')
  if (!Number.isFinite(W) || W <= 0) return fail('Groove width (W) must be greater than 0')
  if (!Number.isFinite(Wt) || Wt <= 0) return fail('Insert width must be greater than 0')
  if (Wt > W + EPS) return fail('Insert width cannot be wider than the groove width')
  if (!EDGE_TYPES.includes(edgeType)) return fail('Invalid edge type')
  if (!METHODS.includes(methodIn)) return fail('Invalid cutting method')
  if (!Number.isFinite(peck) || peck <= 0) return fail('Peck depth must be greater than 0')
  if (!Number.isFinite(retract) || retract < 0) return fail('Peck retract cannot be negative')
  if (!Number.isFinite(dwell) || dwell < 0 || dwell > 10) return fail('Dwell must be between 0 and 10 seconds')

  for (const n of [cL, cR, rtL, rtR, rbL0, rbR0, fDia0, fFace0]) {
    if (!Number.isFinite(n) || n < 0) return fail('Chamfer, radius and finish values cannot be negative')
  }

  // which edge values are active for the chosen type
  const topKind: 'none' | 'chamfer' | 'radius' = edgeType === '1' || edgeType === '2' ? 'chamfer' : edgeType === '3' ? 'radius' : 'none'
  const sL = topKind === 'chamfer' ? cL : topKind === 'radius' ? rtL : 0 // top edge size, left
  const sR = topKind === 'chamfer' ? cR : topKind === 'radius' ? rtR : 0 // top edge size, right
  const rbL = edgeType === '2' || edgeType === '3' ? rbL0 : 0
  const rbR = edgeType === '2' || edgeType === '3' ? rbR0 : 0

  const h = (D - A) / 2 // groove depth (radial)
  const singlePlunge = Math.abs(W - Wt) < EPS
  const method = singlePlunge ? 'plunge' : methodIn
  const hasEdge = sL > 0 || sR > 0 || rbL > 0 || rbR > 0

  if (singlePlunge && hasEdge)
    return fail('Chamfer or radius cannot be cut when the insert is as wide as the groove. Use a narrower insert.')
  if (sR > B + EPS) return fail('Right top chamfer/radius is larger than B (distance from Z0)')
  if (sL + rbL > h + EPS) return fail('Left top edge plus left bottom radius is deeper than the groove depth (D - A) / 2')
  if (sR + rbR > h + EPS) return fail('Right top edge plus right bottom radius is deeper than the groove depth (D - A) / 2')
  if (rbL + rbR > W + EPS) return fail('Left and right bottom radius together are wider than the groove width')
  if ((rbL > 0 || rbR > 0) && rbL + rbR + Wt > W + EPS)
    return fail('Insert is too wide to cut both bottom radii. Groove width must be at least insert width + both bottom radii')
  if (method === 'plunge' && (rbL > 0 || rbR > 0))
    return fail('Bottom radius needs "Plunge + Turn" so the corners are left for the finish pass')

  const fDia = method === 'plungeturn' ? fDia0 : 0
  const fFace = method === 'plungeturn' ? fFace0 : 0
  const bottomX = A + 2 * fDia
  if (bottomX >= D) return fail('Finish allowance on groove diameter is larger than the groove depth')
  if (method === 'plungeturn' && W - Wt - 2 * fFace < -EPS)
    return fail('Groove is too narrow for this insert with the finish allowance on both faces')

  // ---------- positions (tool point = LEFT corner of the insert) ----------
  const zRightWall = -B - Wt // tool left corner when insert touches right wall
  const zLeftWall = -(B + W) // tool left corner when insert touches left wall

  let positions: number[]
  if (singlePlunge) {
    positions = [zLeftWall]
  } else if (method === 'plunge') {
    const S = W - Wt
    const n = Math.max(1, Math.ceil(S / (MAX_STEP * Wt) - 1e-9))
    positions = Array.from({ length: n + 1 }, (_, i) => zRightWall - (i * S) / n) // right to left
  } else {
    const hi = zRightWall - fFace
    const lo = zLeftWall + fFace
    const S = hi - lo
    const centre = (hi + lo) / 2
    if (S < 1e-6) {
      positions = [centre]
    } else {
      const k = Math.max(1, Math.ceil(S / 2 / (MAX_STEP * Wt) - 1e-9))
      const step = S / (2 * k)
      positions = [centre]
      for (let j = k; j >= -k; j--) if (j !== 0) positions.push(centre + j * step) // centre first, then right to left
    }
  }

  // peck targets (diameter values)
  const targets: number[] = []
  for (let t = D - 2 * peck; t > bottomX + EPS; t -= 2 * peck) targets.push(t)
  targets.push(bottomX)

  const clearX = D + 2 * safeX
  const apX = D + 1 // approach: 0.5 mm per side above the OD
  const programName = 'O' + String(progNum).padStart(4, '0')
  const tool = String(Math.trunc(toolNo)).padStart(2, '0')
  const sBlock = spindleMode === 'G96' ? `G50 S${maxRpm};\nG96 S${speed} M03;` : `G97 S${speed} M03;`

  const out: string[] = [
    '%',
    `${programName};`,
    '(OD GROOVE - TURNING);',
    '(Powered by MACHINEST);',
    '(SUPPORT-7988277215);',
    `(D=${f3(D)} A=${f3(A)} B=${f3(B)} W=${f3(W)} INSERT=${f3(Wt)});`,
    `(${method === 'plunge' ? 'PLUNGE ONLY' : 'PLUNGE + TURN'} - TOOL POINT = LEFT CORNER);`,
    '',
    'G21 G99 G40;',
    'G28 U0 W0;',
    `T${tool}${tool};`,
    `G90 ${workOffset};`,
    sBlock,
    `G00 X${f3(clearX)} Z${f3(safeZ)};`,
  ]

  // ---------- rough plunges ----------
  out.push('(ROUGH PLUNGES);')
  positions.forEach((z, i) => {
    out.push(`(PLUNGE ${i + 1} OF ${positions.length});`)
    out.push(`G00 Z${f3(z)};`)
    out.push(`G00 X${f3(apX)};`)
    targets.forEach((t, k) => {
      out.push(`G01 X${f3(t)} F${f3(feed)};`)
      if (k < targets.length - 1 && retract > 0) {
        out.push(`G00 X${f3(t + 2 * retract)};`)
        out.push(`G00 X${f3(t + 0.2)};`)
      }
    })
    if (dwell > 0) out.push(`G04 X${dwell.toFixed(1)};`)
    out.push(`G00 X${f3(apX)};`)
  })

  // ---------- edge / finish pass ----------
  const needContour = method === 'plungeturn' || hasEdge
  const L = (z: number) => z // left-corner features
  const Rz = (z: number) => z - Wt // right-corner features -> left-corner Z

  if (needContour && method === 'plungeturn') {
    out.push('(FINISH PASS - RIGHT WALL, DOWN, GROOVE DIA, LEFT WALL);')
    // right wall features (right corner path)
    out.push(`G00 Z${f3(Rz(-(B - sR)))};`)
    out.push(`G01 X${f3(D)} F${f3(finishFeed)};`)
    if (sR > 0) {
      if (topKind === 'chamfer') out.push(`G01 X${f3(D - 2 * sR)} Z${f3(Rz(-B))};`)
      else out.push(`G03 X${f3(D - 2 * sR)} Z${f3(Rz(-B))} R${f3(sR)};`)
    }
    out.push(`G01 X${f3(A + 2 * rbR)};`)
    if (rbR > 0) out.push(`G02 X${f3(A)} Z${f3(Rz(-B - rbR))} R${f3(rbR)};`)
    // bottom pass to the left
    out.push(`G01 Z${f3(L(zLeftWall + rbL))};`)
    if (rbL > 0) out.push(`G02 X${f3(A + 2 * rbL)} Z${f3(L(zLeftWall))} R${f3(rbL)};`)
    // left wall up
    if (sL > 0) {
      out.push(`G01 X${f3(D - 2 * sL)};`)
      if (topKind === 'chamfer') out.push(`G01 X${f3(D)} Z${f3(L(zLeftWall - sL))};`)
      else out.push(`G03 X${f3(D)} Z${f3(L(zLeftWall - sL))} R${f3(sL)};`)
    } else {
      out.push(`G01 X${f3(D)};`)
    }
    out.push(`G00 X${f3(clearX)};`)
  } else if (needContour) {
    // plunge only: edge chamfer / radius cut in the final pass
    if (sR > 0) {
      out.push('(EDGE PASS - RIGHT);')
      out.push(`G00 Z${f3(Rz(-(B - sR)))};`)
      out.push(`G01 X${f3(D)} F${f3(finishFeed)};`)
      if (topKind === 'chamfer') out.push(`G01 X${f3(D - 2 * sR)} Z${f3(Rz(-B))};`)
      else out.push(`G03 X${f3(D - 2 * sR)} Z${f3(Rz(-B))} R${f3(sR)};`)
      out.push(`G00 X${f3(apX)};`)
    }
    if (sL > 0) {
      out.push('(EDGE PASS - LEFT);')
      out.push(`G00 Z${f3(L(zLeftWall))};`)
      out.push(`G01 X${f3(D - 2 * sL)} F${f3(finishFeed)};`)
      if (topKind === 'chamfer') out.push(`G01 X${f3(D)} Z${f3(L(zLeftWall - sL))};`)
      else out.push(`G03 X${f3(D)} Z${f3(L(zLeftWall - sL))} R${f3(sL)};`)
    }
    out.push(`G00 X${f3(clearX)};`)
  } else {
    out.push(`G00 X${f3(clearX)};`)
  }

  out.push(`G00 Z${f3(safeZ)};`, 'G28 U0 W0;', 'M05;', 'M30;', '%')

  return { ok: true, gcode: out.join('\n'), svg: '', programName }
}
