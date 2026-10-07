import 'server-only'
import { CycleResult, fail, num } from './common'
import { buildChamferSvg } from './chamfer-svg'

const LIMITS = { progMax: 7999, feedMax: 5, rpmMax: 4000, odMax: 500 }
const OFFSETS = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59']
const MODES = ['a_angle', 'b_angle', 'ab']
const SPINDLE = ['G96', 'G97']

const toRad = (deg: number) => (deg * Math.PI) / 180

export function turningChamfer(v: Record<string, unknown>): CycleResult {
  const mode = String(v.mode)
  const progNum = num(v.progNum)
  const od = num(v.od)
  const r = num(v.noseRadius)
  const a = num(v.a)
  const b = num(v.b)
  const angle = num(v.angle)
  const feed = num(v.feed)
  const speed = num(v.speed)
  const spindleMode = String(v.spindleMode)
  const workOffset = String(v.workOffset)
  const safeX = num(v.safeX)
  const safeZ = num(v.safeZ)

  if (!MODES.includes(mode)) return fail('Invalid input mode')
  if (!Number.isInteger(progNum) || progNum < 1 || progNum > LIMITS.progMax)
    return fail(`Program number must be a whole number between 0001 and ${LIMITS.progMax}`)
  if (!Number.isFinite(od) || od <= 0 || od > LIMITS.odMax)
    return fail(`OD must be between 0 and ${LIMITS.odMax} mm`)
  if (!Number.isFinite(r) || r < 0 || r > 3.2)
    return fail('Nose radius must be between 0 and 3.2 mm')
  if (!Number.isFinite(feed) || feed <= 0 || feed > LIMITS.feedMax)
    return fail(`Feed must be greater than 0 and up to ${LIMITS.feedMax} mm/rev`)
  if (!Number.isFinite(speed) || speed <= 0 || speed > LIMITS.rpmMax)
    return fail(`Speed must be greater than 0 and up to ${LIMITS.rpmMax}`)
  if (!SPINDLE.includes(spindleMode)) return fail('Invalid spindle mode')
  if (!OFFSETS.includes(workOffset)) return fail('Invalid work offset')
  if (!Number.isFinite(safeX) || safeX <= 0) return fail('Safe X clearance must be greater than 0')
  if (!Number.isFinite(safeZ) || safeZ <= 0) return fail('Safe Z clearance must be greater than 0')

  let aEff: number, bEff: number, angleUsed: number

  if (mode === 'a_angle') {
    if (!Number.isFinite(a) || a <= 0) return fail('Length A must be greater than 0')
    if (!Number.isFinite(angle) || angle <= 0 || angle >= 90) return fail('Angle must be between 0 and 90 degrees')
    angleUsed = angle
    const extra = r * (1 - Math.tan(toRad(angle / 2)))
    aEff = a + extra
    bEff = aEff * Math.tan(toRad(angle))
  } else if (mode === 'b_angle') {
    if (!Number.isFinite(b) || b <= 0) return fail('Length B must be greater than 0')
    if (!Number.isFinite(angle) || angle <= 0 || angle >= 90) return fail('Angle must be between 0 and 90 degrees')
    angleUsed = angle
    const extra = r * (1 - Math.tan(toRad(angle / 2)))
    bEff = b + extra
    aEff = bEff * Math.tan(toRad(angle))
  } else {
    if (!Number.isFinite(a) || a <= 0) return fail('Length A must be greater than 0')
    if (!Number.isFinite(b) || b <= 0) return fail('Length B must be greater than 0')
    angleUsed = (Math.atan(b / a) * 180) / Math.PI
    const extra = r * (1 - Math.tan(toRad(angleUsed / 2)))
    aEff = a + extra
    bEff = aEff * Math.tan(toRad(angleUsed))
  }

  const startX = od - 2 * bEff
  if (startX <= 0) return fail('Chamfer B dimension is too large for this OD')
  if (aEff <= 0 || bEff <= 0) return fail('Calculated chamfer dimensions are invalid, please check inputs')

  const programName = 'O' + String(progNum).padStart(4, '0')
  const sBlock = spindleMode === 'G96' ? `G96 S${speed} M03;` : `G97 S${speed} M03;`
  const clearX = (od + 2 * safeX).toFixed(3)

  const out: string[] = [
    '%',
    `${programName};`,
    '(OD CHAMFER - TURNING);',
    '(Powered by MACHINEST);',
    '(SUPPORT-7988277215);',
    `(A=${aEff.toFixed(3)} B=${bEff.toFixed(3)} ANGLE=${angleUsed.toFixed(2)} NOSE R=${r});`,
    '',
    'G21 G99 G40;',
    'G28 U0 W0;',
    'T0101;',
    `G90 ${workOffset};`,
    sBlock,
    `G00 X${clearX} Z${safeZ.toFixed(3)};`,
    `G00 X${startX.toFixed(3)};`,
    'G00 Z0;',
    `G01 X${od.toFixed(3)} Z-${aEff.toFixed(3)} F${feed.toFixed(3)};`,
    `G00 X${clearX};`,
    `G00 Z${safeZ.toFixed(3)};`,
    'G28 U0 W0;',
    'M05;',
    'M30;',
    '%',
  ]

  return {
    ok: true,
    gcode: out.join('\n'),
    svg: buildChamferSvg({ od, startX, aEff, bEff, angleUsed, r }),
    programName,
  }
}