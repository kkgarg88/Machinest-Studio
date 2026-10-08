import 'server-only'
import { CycleResult, fail, num } from './common'
import { buildFaceMillRectSvg, buildFaceMillRoundSvg } from './facemill-svg'

const LIMITS = { progMax: 7999, stockMax: 3000, cutterMax: 500, rpmMin: 50, rpmMax: 15000, feedMax: 5000 }
const OFFSETS = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59']
const CORNERS = ['FL', 'FR', 'BL', 'BR']

function checkCommon(v: Record<string, unknown>) {
  const progNum = num(v.progNum)
  const cutterDia = num(v.cutterDia)
  const stepoverPct = num(v.stepoverPct)
  const overtravelPct = num(v.overtravelPct)
  const depth = num(v.depth)
  const depthPerPass = num(v.depthPerPass)
  const rlevel = num(v.retractlevel)
  const safeZ = num(v.safeZ)
  const finishCut = v.finishCut === 'YES'
  const finishMargin = num(v.finishMargin)
  const finishFeed = num(v.finishFeed)
  const finishRpm = num(v.finishRpm)
  const workOffset = String(v.workOffset)
  const feed = num(v.feed)
  const plungeFeed = num(v.plungeFeed)
  const rpm = num(v.rpm)

  if (!Number.isInteger(progNum) || progNum < 1 || progNum > LIMITS.progMax)
    return fail(`Program number must be a whole number between 0001 and ${LIMITS.progMax}`)
  if (!Number.isFinite(cutterDia) || cutterDia <= 0 || cutterDia > LIMITS.cutterMax)
    return fail(`Cutter diameter must be between 0 and ${LIMITS.cutterMax} mm`)
  if (!Number.isFinite(stepoverPct) || stepoverPct <= 0 || stepoverPct > 100)
    return fail('Stepover must be between 1% and 100%')
  if (!Number.isFinite(overtravelPct) || overtravelPct < 0 || overtravelPct > 100)
    return fail('Overtravel % must be between 0 and 100')
  if (!Number.isFinite(depth) || depth >= 0) return fail('Depth of cut must be a negative value')
  if (!Number.isFinite(depthPerPass) || depthPerPass <= 0) return fail('Depth per pass must be greater than 0')
  if (!Number.isFinite(rlevel) || rlevel < 0) return fail('Retract level (R) must be Z0 or above')
  if (!Number.isFinite(safeZ)) return fail('Enter a valid Safe Z')
  if (!Number.isFinite(feed) || feed <= 0 || feed > LIMITS.feedMax) return fail(`Cutting feed must be greater than 0 and up to ${LIMITS.feedMax}`)
  if (!Number.isFinite(plungeFeed) || plungeFeed <= 0 || plungeFeed > LIMITS.feedMax) return fail(`Plunge feed must be greater than 0 and up to ${LIMITS.feedMax}`)
  if (!Number.isInteger(rpm) || rpm < LIMITS.rpmMin || rpm > LIMITS.rpmMax) return fail(`RPM must be a whole number between ${LIMITS.rpmMin} and ${LIMITS.rpmMax}`)
  if (finishCut) {
    if (!Number.isFinite(finishMargin) || finishMargin <= 0) return fail('Finish margin must be greater than 0')
    if (!Number.isFinite(finishFeed) || finishFeed <= 0 || finishFeed > LIMITS.feedMax) return fail('Finish feed must be greater than 0')
    if (!Number.isInteger(finishRpm) || finishRpm < LIMITS.rpmMin || finishRpm > LIMITS.rpmMax) return fail(`Finish RPM must be a whole number between ${LIMITS.rpmMin} and ${LIMITS.rpmMax}`)
  }
  if (!OFFSETS.includes(workOffset)) return fail('Invalid work offset')
  if (rlevel <= depth) return fail('Retract level must be greater than depth of cut')
  if (safeZ <= rlevel) return fail('Safe Z must be greater than retract level')
  if (finishCut && finishMargin >= Math.abs(depth)) return fail(`Finish margin must be smaller than the total depth of cut (${depth.toFixed(3)})`)

  const roughDepthTarget = finishCut ? Math.abs(depth) - finishMargin : Math.abs(depth)
  if (roughDepthTarget > 0 && depthPerPass > roughDepthTarget)
    return fail(`Depth per pass cannot be greater than the rough depth target (${roughDepthTarget.toFixed(3)})`)

  const roughZLevels: number[] = []
  const numRoughPasses = roughDepthTarget > 0 ? Math.ceil(roughDepthTarget / depthPerPass) : 0
  for (let i = 1; i <= numRoughPasses; i++) roughZLevels.push(-Math.min(i * depthPerPass, roughDepthTarget))

  return {
    progNum, cutterDia, stepoverPct, overtravelPct, depth, depthPerPass, rlevel, safeZ,
    finishCut, finishMargin, finishFeed, finishRpm, workOffset, feed, plungeFeed, rpm,
    roughZLevels, numRoughPasses,
  }
}

function buildRows(stockY: number, stepoverDist: number): number[] {
  const rows: number[] = []
  let y = 0
  while (y < stockY) { rows.push(y); y += stepoverDist }
  rows.push(stockY)
  return rows
}

function buildRasterLinesRect(rowsY: number[], xNear: number, xFar: number, pattern: string, feedVal: number, plungeFeedVal: number, z: number, rlevel: number): string[] {
  const lines: string[] = []
  let towardFar = true
  for (let ri = 0; ri < rowsY.length; ri++) {
    const y = rowsY[ri]
    if (pattern === 'ZIGZAG') {
      if (ri > 0) lines.push(`G01 Y${y.toFixed(3)} F${feedVal.toFixed(1)};`)
      lines.push(`G01 X${(towardFar ? xFar : xNear).toFixed(3)} F${feedVal.toFixed(1)};`)
      towardFar = !towardFar
    } else {
      if (ri > 0) {
        lines.push(`G00 Z${rlevel.toFixed(3)};`)
        lines.push(`G00 X${xNear.toFixed(3)} Y${y.toFixed(3)};`)
        lines.push(`G01 Z${z.toFixed(3)} F${plungeFeedVal.toFixed(1)};`)
      }
      lines.push(`G01 X${xFar.toFixed(3)} F${feedVal.toFixed(1)};`)
    }
  }
  return lines
}

function faceMillRect(v: Record<string, unknown>): CycleResult {
  const common = checkCommon(v)
  if ('error' in (common as any)) return common as CycleResult

  const progNum = (common as any).progNum
  const originCorner = String(v.originCorner)
  const stockX = num(v.stockX)
  const stockY = num(v.stockY)
  const pattern = String(v.pattern)

  if (!CORNERS.includes(originCorner)) return fail('Invalid origin corner')
  if (!Number.isFinite(stockX) || stockX <= 0 || stockX > LIMITS.stockMax) return fail(`Stock Length (X) must be between 0 and ${LIMITS.stockMax} mm`)
  if (!Number.isFinite(stockY) || stockY <= 0 || stockY > LIMITS.stockMax) return fail(`Stock Width (Y) must be between 0 and ${LIMITS.stockMax} mm`)
  if (!['ZIGZAG', 'UNI'].includes(pattern)) return fail('Invalid toolpath pattern')

  const c = common as any
  const signX = originCorner.includes('R') ? -1 : 1
  const signY = originCorner.includes('B') ? -1 : 1
  const overtravelMM = c.cutterDia * (c.overtravelPct / 100)
  const stepoverDist = c.cutterDia * (c.stepoverPct / 100)

  const xBoundA = 0, xBoundB = signX * stockX
  const xLowStock = Math.min(xBoundA, xBoundB), xHighStock = Math.max(xBoundA, xBoundB)
  const xLow = xLowStock - overtravelMM, xHigh = xHighStock + overtravelMM
  const xNear = signX > 0 ? xLow : xHigh
  const xFar = signX > 0 ? xHigh : xLow

  const rowsRawY = buildRows(stockY, stepoverDist)
  const rowsY = rowsRawY.map(val => signY * val)
  const startX = xNear, startY = rowsY[0]

  const programName = 'O' + String(progNum).padStart(4, '0')
  const styleName = (pattern === 'UNI' ? 'Unidirectional' : 'Zig-Zag') + ' Rectangular Face Mill'

  const out: string[] = [
    '%', `${programName};`, `(${styleName});`,
    `(STOCK X${stockX.toFixed(3)} Y${stockY.toFixed(3)});`,
    '(Powered by MACHINEST);', '(SUPPORT-7988277215);', '',
    'G21 G90 G40 G49 G80 G94;', 'G17;', 'G91 G28 Z0;', 'G90;', 'T01 M06;', '',
    `G90 ${c.workOffset} G00 X${startX.toFixed(3)} Y${startY.toFixed(3)};`,
    `S${c.rpm} M03;`, `G43 H01 Z${c.safeZ.toFixed(3)} M08;`, `G00 Z${c.rlevel.toFixed(3)};`, '',
  ]

  function emitPass(z: number, feedVal: number, plungeFeedVal: number, label: string, reposition: boolean) {
    out.push(`(${label} - Z${z.toFixed(3)});`)
    if (reposition) out.push(`G00 X${startX.toFixed(3)} Y${startY.toFixed(3)};`)
    out.push(`G01 Z${z.toFixed(3)} F${plungeFeedVal.toFixed(1)};`)
    out.push(...buildRasterLinesRect(rowsY, xNear, xFar, pattern, feedVal, plungeFeedVal, z, c.rlevel))
    out.push(`G00 Z${c.rlevel.toFixed(3)};`, '')
  }

  for (let zi = 0; zi < c.roughZLevels.length; zi++) {
    emitPass(c.roughZLevels[zi], c.feed, c.plungeFeed, `ROUGH PASS ${zi + 1} OF ${c.roughZLevels.length}`, zi > 0)
  }
  if (c.finishCut) {
    if (c.finishRpm !== c.rpm) out.push(`S${c.finishRpm} M03;`)
    emitPass(c.depth, c.finishFeed, c.plungeFeed, 'FINISH PASS', true)
  }

  out.push(`G00 Z${c.safeZ.toFixed(3)} M09;`, 'M05;', 'G91 G28 Z0;', 'G90;', 'M30;', '%')

  const svg = buildFaceMillRectSvg({
    stockX, stockY, originCorner, pattern,
    depth: c.depth, rlevel: c.rlevel, safeZ: c.safeZ, depthPerPass: c.depthPerPass,
    numRoughPasses: c.numRoughPasses, numRows: rowsY.length, stepoverDist,
  })

  return { ok: true, gcode: out.join('\n'), svg, programName }
}

function buildSpiralRadii(effectiveRadius: number, stepoverDist: number, cutterRadius: number): number[] {
  const radii: number[] = []
  const firstR = Math.min(stepoverDist, cutterRadius)
  radii.push(firstR)
  let r = stepoverDist
  while (r < effectiveRadius) {
    if (r > firstR) radii.push(r)
    r += stepoverDist
  }
  if (effectiveRadius > firstR) radii.push(effectiveRadius)
  return radii
}

function buildSpiralLines(radii: number[], feedVal: number): string[] {
  const lines: string[] = []
  for (let i = 0; i < radii.length; i++) {
    const r = radii[i]
    if (i > 0) lines.push(`G01 X${r.toFixed(3)} Y0 F${feedVal.toFixed(1)};`)
    lines.push(`G02 X${r.toFixed(3)} Y0 I${(-r).toFixed(3)} J0 F${feedVal.toFixed(1)};`)
  }
  return lines
}

function chordHalfWidth(effectiveRadius: number, y: number): number {
  return Math.sqrt(Math.max(0, effectiveRadius * effectiveRadius - y * y))
}

function buildRowsRound(maxExtent: number, stepoverDist: number): number[] {
  const rows: number[] = []
  let y = -maxExtent
  while (y < maxExtent) { rows.push(y); y += stepoverDist }
  rows.push(maxExtent)
  return rows
}

function buildRasterLinesRound(rowsY: number[], effectiveRadius: number, pattern: string, feedVal: number, plungeFeedVal: number, z: number, rlevel: number): string[] {
  const lines: string[] = []
  let towardRight = true
  for (let ri = 0; ri < rowsY.length; ri++) {
    const y = rowsY[ri]
    const chw = chordHalfWidth(effectiveRadius, y)
    const xLeft = -chw, xRight = chw
    if (pattern === 'ZIGZAG') {
      if (ri > 0) lines.push(`G01 Y${y.toFixed(3)} F${feedVal.toFixed(1)};`)
      lines.push(`G01 X${(towardRight ? xRight : xLeft).toFixed(3)} F${feedVal.toFixed(1)};`)
      towardRight = !towardRight
    } else {
      if (ri > 0) {
        lines.push(`G00 Z${rlevel.toFixed(3)};`)
        lines.push(`G00 X${xLeft.toFixed(3)} Y${y.toFixed(3)};`)
        lines.push(`G01 Z${z.toFixed(3)} F${plungeFeedVal.toFixed(1)};`)
      }
      lines.push(`G01 X${xRight.toFixed(3)} F${feedVal.toFixed(1)};`)
    }
  }
  return lines
}

function faceMillRound(v: Record<string, unknown>): CycleResult {
  const common = checkCommon(v)
  if ('error' in (common as any)) return common as CycleResult

  const c = common as any
  const progNum = c.progNum
  const diameter = num(v.diameter)
  const toolpathStyle = String(v.toolpathStyle)
  const pattern = String(v.pattern)

  if (!Number.isFinite(diameter) || diameter <= 0 || diameter > LIMITS.stockMax) return fail(`Diameter must be between 0 and ${LIMITS.stockMax} mm`)
  if (!['SPIRAL', 'RASTER'].includes(toolpathStyle)) return fail('Invalid toolpath style')
  if (toolpathStyle === 'RASTER' && !['ZIGZAG', 'UNI'].includes(pattern)) return fail('Invalid toolpath pattern')

  const overtravelMM = c.cutterDia * (c.overtravelPct / 100)
  const stepoverDist = c.cutterDia * (c.stepoverPct / 100)
  const effectiveRadius = diameter / 2 + overtravelMM
  const cutterRadius = c.cutterDia / 2

  let radii: number[] = [], rowsY: number[] = [], startX: number, startY: number

  if (toolpathStyle === 'SPIRAL') {
    radii = buildSpiralRadii(effectiveRadius, stepoverDist, cutterRadius)
    startX = radii[0]; startY = 0
  } else {
    rowsY = buildRowsRound(effectiveRadius, stepoverDist)
    startX = -chordHalfWidth(effectiveRadius, rowsY[0]); startY = rowsY[0]
  }

  const programName = 'O' + String(progNum).padStart(4, '0')
  const styleName = toolpathStyle === 'SPIRAL'
    ? 'Spiral Round Face Mill'
    : (pattern === 'UNI' ? 'Unidirectional' : 'Zig-Zag') + ' Round Face Mill (Raster)'

  const out: string[] = [
    '%', `${programName};`, `(${styleName});`, `(STOCK DIA ${diameter.toFixed(3)});`,
    '(ORIGIN: CENTER (0,0));', '(Powered by MACHINEST);', '(SUPPORT-7988277215);', '',
    'G21 G90 G40 G49 G80 G94;', 'G17;', 'G91 G28 Z0;', 'G90;', 'T01 M06;', '',
    `G90 ${c.workOffset} G00 X${startX.toFixed(3)} Y${startY.toFixed(3)};`,
    `S${c.rpm} M03;`, `G43 H01 Z${c.safeZ.toFixed(3)} M08;`, `G00 Z${c.rlevel.toFixed(3)};`, '',
  ]

  function emitPass(z: number, feedVal: number, plungeFeedVal: number, label: string, reposition: boolean) {
    out.push(`(${label} - Z${z.toFixed(3)});`)
    if (reposition) out.push(`G00 X${startX.toFixed(3)} Y${startY.toFixed(3)};`)
    out.push(`G01 Z${z.toFixed(3)} F${plungeFeedVal.toFixed(1)};`)
    const lines = toolpathStyle === 'SPIRAL'
      ? buildSpiralLines(radii, feedVal)
      : buildRasterLinesRound(rowsY, effectiveRadius, pattern, feedVal, plungeFeedVal, z, c.rlevel)
    out.push(...lines)
    out.push(`G00 Z${c.rlevel.toFixed(3)};`, '')
  }

  for (let zi = 0; zi < c.roughZLevels.length; zi++) {
    emitPass(c.roughZLevels[zi], c.feed, c.plungeFeed, `ROUGH PASS ${zi + 1} OF ${c.roughZLevels.length}`, zi > 0)
  }
  if (c.finishCut) {
    if (c.finishRpm !== c.rpm) out.push(`S${c.finishRpm} M03;`)
    emitPass(c.depth, c.finishFeed, c.plungeFeed, 'FINISH PASS', true)
  }

  out.push(`G00 Z${c.safeZ.toFixed(3)} M09;`, 'M05;', 'G91 G28 Z0;', 'G90;', 'M30;', '%')

  const svg = buildFaceMillRoundSvg({
    diameter, toolpathStyle,
    depth: c.depth, rlevel: c.rlevel, safeZ: c.safeZ, depthPerPass: c.depthPerPass,
    numRoughPasses: c.numRoughPasses, stepoverDist,
    numRings: toolpathStyle === 'SPIRAL' ? radii.length : rowsY.length,
  })

  return { ok: true, gcode: out.join('\n'), svg, programName }
}

export function millingFaceMill(v: Record<string, unknown>): CycleResult {
  const shape = String(v.shape)
  if (shape === 'rect') return faceMillRect(v)
  if (shape === 'circular') return faceMillRound(v)
  return fail('Invalid face milling shape')
}