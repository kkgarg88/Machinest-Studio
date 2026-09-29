import 'server-only'
import { CycleResult, fail, num } from './common'
import { buildEllipseSvg } from './ellipse-svg'

const LIMITS = { progMax: 7999, rpmMin: 50, rpmMax: 15000, feedMax: 5000, stepMin: 0.1, stepMax: 10, maxPasses: 500 }
const OFFSETS = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59']

// chord aur asli ellipse ke beech ka sabse bada farak (mm)
function chordError(a: number, b: number, n: number): number {
  let max = 0
  for (let i = 0; i < n; i++) {
    const t0 = (2 * Math.PI * i) / n
    const t1 = (2 * Math.PI * (i + 1)) / n
    const tm = (t0 + t1) / 2
    const x0 = a * Math.cos(t0), y0 = b * Math.sin(t0)
    const x1 = a * Math.cos(t1), y1 = b * Math.sin(t1)
    const xm = a * Math.cos(tm), ym = b * Math.sin(tm)
    const len = Math.hypot(x1 - x0, y1 - y0)
    if (len === 0) continue
    const d = Math.abs((xm - x0) * (y1 - y0) - (ym - y0) * (x1 - x0)) / len
    if (d > max) max = d
  }
  return max
}

export function millingEllipse(v: Record<string, unknown>): CycleResult {
  const type = String(v.type)
  const progNum = num(v.progNum)
  const xr = num(v.xRadius)
  const yr = num(v.yRadius)
  const step = num(v.step)
  const depth = num(v.depth)
  const doc = num(v.depthPerPass)
  const rlevel = num(v.retractlevel)
  const safeZ = num(v.safeZ)
  const cutterDia = num(v.cutterDia)
  const plungeFeed = num(v.plungeFeed)
  const feed = num(v.feed)
  const rpm = num(v.rpm)
  const workOffset = String(v.workOffset)

  if (type !== 'ID') return fail('Only ID (inside) ellipse is available right now')
  if (!Number.isInteger(progNum) || progNum < 1 || progNum > LIMITS.progMax)
    return fail(`Program number must be a whole number between 0001 and ${LIMITS.progMax}`)
  if (!Number.isFinite(xr) || xr < 1 || xr > 1000)
    return fail('X radius must be between 1 mm and 1000 mm')
  if (!Number.isFinite(yr) || yr < 1 || yr > 1000)
    return fail('Y radius must be between 1 mm and 1000 mm')
  if (!Number.isFinite(step) || step < LIMITS.stepMin || step > LIMITS.stepMax)
    return fail(`Angle step must be between ${LIMITS.stepMin} and ${LIMITS.stepMax} degrees`)

  const n = Math.round(360 / step)
  if (Math.abs(360 / step - n) > 1e-6)
    return fail('Angle step must divide 360 exactly (for example 0.5, 1, 2, 2.5, 3, 5)')

  if (!Number.isFinite(depth) || depth >= 0)
    return fail('Depth must be a negative value (below Z0)')
  if (!Number.isFinite(doc) || doc <= 0)
    return fail('Depth per pass must be greater than 0')
  if (!Number.isFinite(rlevel) || rlevel < 0)
    return fail('Retract level (R) must be Z0 or above')
  if (!Number.isFinite(safeZ) || safeZ <= rlevel)
    return fail('Safe Z must be above the retract level')
  if (!Number.isFinite(cutterDia) || cutterDia <= 0)
    return fail('Enter a valid cutter diameter')
  if (!Number.isFinite(plungeFeed) || plungeFeed <= 0 || plungeFeed > LIMITS.feedMax)
    return fail(`Plunge feed must be greater than 0 and up to ${LIMITS.feedMax}`)
  if (!Number.isFinite(feed) || feed <= 0 || feed > LIMITS.feedMax)
    return fail(`Cutting feed must be greater than 0 and up to ${LIMITS.feedMax}`)
  if (!Number.isInteger(rpm) || rpm < LIMITS.rpmMin || rpm > LIMITS.rpmMax)
    return fail(`RPM must be a whole number between ${LIMITS.rpmMin} and ${LIMITS.rpmMax}`)
  if (!OFFSETS.includes(workOffset)) return fail('Invalid work offset')

  // ID mein cutter ka radius ellipse ke sabse chhote curve radius se chhota hona chahiye
  const rhoMin = Math.pow(Math.min(xr, yr), 2) / Math.max(xr, yr)
  if (cutterDia / 2 >= rhoMin)
    return fail(
      `Cutter is too large for this ellipse: tool dia must be smaller than ${(2 * rhoMin).toFixed(3)} mm (smallest curve radius is ${rhoMin.toFixed(3)} mm)`
    )

  const depthAbs = Math.abs(depth)
  const nPass = Math.ceil(Math.round((depthAbs / doc) * 1e6) / 1e6)
  if (nPass > LIMITS.maxPasses)
    return fail(`Depth per pass is too small for this depth (more than ${LIMITS.maxPasses} passes)`)
  const docEff = depthAbs / nPass

  const chordErr = chordError(xr, yr, n)
  const stepText = String(parseFloat((360 / n).toFixed(8)))
  const programName = 'O' + String(progNum).padStart(4, '0')

  const out: string[] = [
    '%',
    `${programName};`,
    '(ELLIPSE ID - MACRO);',
    '(Powered by MACHINEST);',
    '(SUPPORT-7988277215);',
    `(X RADIUS ${xr.toFixed(3)} - Y RADIUS ${yr.toFixed(3)});`,
    `(STEP ${stepText} DEG - ${n} SEGMENTS - CHORD ERROR APPROX ${chordErr.toFixed(4)} MM);`,
    `(TOOL DIA ${cutterDia.toFixed(3)} - CUTTER COMP D01);`,
    '(ELLIPSE CENTER X0 Y0 MUST BE OPEN - PRE-DRILLED OR ROUGHED);',
    '',
    'G21 G90 G40 G49 G80 G94;',
    'G17;',
    'G91 G28 Z0;',
    'G90;',
    'T01 M06;',
    '',
    `G90 ${workOffset} G00 X0 Y0;`,
    `S${rpm} M03;`,
    `G43 H01 Z${safeZ.toFixed(3)} M08;`,
    `G00 Z${rlevel.toFixed(3)};`,
    '',
    `#20 = ${stepText} (ANGLE STEP DEG);`,
    `#22 = ${yr.toFixed(3)} (Y RADIUS);`,
    `#23 = ${xr.toFixed(3)} (X RADIUS);`,
    `#28 = ${docEff.toFixed(6)} (DEPTH PER PASS);`,
    `#31 = ${n} (TOTAL SEGMENTS);`,
    `#32 = ${nPass} (TOTAL PASSES);`,
    '#29 = 0 (PASS COUNTER);',
    '',
    'N5 #29 = #29 + 1;',
    '#26 = 0 - [#29 * #28] (CURRENT PASS Z);',
    `G01 Z#26 F${plungeFeed.toFixed(1)};`,
    '#30 = 0 (SEGMENT COUNTER);',
    `G01 G41 X#23 D01 F${feed.toFixed(1)};`,
    'N10 #30 = #30 + 1;',
    '#21 = [#30 * #20] (ANGLE);',
    '#24 = [SIN[#21] * #22];',
    '#25 = [COS[#21] * #23];',
    'G01 X#25 Y#24;',
    'IF [#30 LT #31] GOTO 10;',
    'G40 G01 X0;',
    'IF [#29 LT #32] GOTO 5;',
    '',
    `G00 Z${safeZ.toFixed(3)} M09;`,
    'M05;',
    'G91 G28 Z0;',
    'G90;',
    'M30;',
    '%',
  ]

  return {
    ok: true,
    gcode: out.join('\n'),
    svg: buildEllipseSvg({
      xr, yr, step: parseFloat(stepText), n, chordErr, cutterDia, rhoMin,
      depth, doc: docEff, nPass, safeZ, rlevel,
    }),
    programName,
  }
}