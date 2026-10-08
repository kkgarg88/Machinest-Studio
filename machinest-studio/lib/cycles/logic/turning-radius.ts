import 'server-only'
import { CycleResult, fail, num } from './common'

const LIMITS = { progMax: 7999, feedMax: 5, rpmMax: 4000, diaMax: 500 }
const OFFSETS = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59']
const SPINDLE = ['G96', 'G97']

export function turningRadius(v: Record<string, unknown>): CycleResult {
  const caseType = String(v.caseType)
  const progNum = num(v.progNum)
  const od = num(v.od)
  const r = num(v.r)
  const nose = num(v.nose)
  const feed = num(v.feed)
  const speed = num(v.speed)
  const maxRpm = num(v.maxRpm)
  const spindleMode = String(v.spindleMode)
  const workOffset = String(v.workOffset)
  const safeX = num(v.safeX)
  const safeZ = num(v.safeZ)

  if (caseType !== '1') return fail('Case II is not available yet — coming in a later update')
  if (!Number.isInteger(progNum) || progNum < 1 || progNum > LIMITS.progMax)
    return fail(`Program number must be a whole number between 0001 and ${LIMITS.progMax}`)
  if (!Number.isFinite(od) || od <= 0 || od > LIMITS.diaMax)
    return fail(`OD must be between 0 and ${LIMITS.diaMax} mm`)
  if (!Number.isFinite(r) || r <= 0) return fail('Radius (R) must be greater than 0')
  if (!Number.isFinite(nose) || nose < 0 || nose > 3.2) return fail('Nose radius must be between 0 and 3.2 mm')
  if (!Number.isFinite(feed) || feed <= 0 || feed > LIMITS.feedMax)
    return fail(`Feed must be greater than 0 and up to ${LIMITS.feedMax} mm/rev`)
  if (!Number.isFinite(speed) || speed <= 0 || speed > LIMITS.rpmMax)
    return fail(`Speed must be greater than 0 and up to ${LIMITS.rpmMax}`)
  if (!SPINDLE.includes(spindleMode)) return fail('Invalid spindle mode')
  if (spindleMode === 'G96' && (!Number.isFinite(maxRpm) || maxRpm <= 0 || maxRpm > LIMITS.rpmMax))
    return fail('Max Spindle RPM (for G50) is required when using G96')
  if (!OFFSETS.includes(workOffset)) return fail('Invalid work offset')
  if (!Number.isFinite(safeX) || safeX <= 0) return fail('Safe X clearance must be greater than 0')
  if (!Number.isFinite(safeZ) || safeZ <= 0) return fail('Safe Z clearance must be greater than 0')

  const progR = r + nose // Case I: R + nose radius
  const startX = od - 2 * progR
  if (startX <= 0) return fail('Programmed radius is too large for this OD')

  const programName = 'O' + String(progNum).padStart(4, '0')
  const sBlock = spindleMode === 'G96'
    ? `G50 S${maxRpm};\nG96 S${speed} M03;`
    : `G97 S${speed} M03;`
  const clearX = od + 2 * safeX

  const out: string[] = [
    '%',
    `${programName};`,
    '(OD RADIUS - TURNING - CASE I CONCAVE);',
    '(Powered by MACHINEST);',
    '(SUPPORT-7988277215);',
    `(DESIGN R=${r.toFixed(3)} NOSE R=${nose.toFixed(3)} PROGRAMMED R=${progR.toFixed(3)});`,
    '(VERIFY ARC DIRECTION G02/G03 ON SIMULATOR BEFORE RUNNING);',
    '',
    'G21 G99 G40;',
    'G28 U0 W0;',
    'T0101;',
    `G90 ${workOffset};`,
    sBlock,
    `G00 X${clearX.toFixed(3)} Z${safeZ.toFixed(3)};`,
    `G00 X${startX.toFixed(3)};`,
    'G00 Z0;',
    `G02 X${od.toFixed(3)} Z-${progR.toFixed(3)} R${progR.toFixed(3)} F${feed.toFixed(3)};`,
    `G00 X${clearX.toFixed(3)};`,
    `G00 Z${safeZ.toFixed(3)};`,
    'G28 U0 W0;',
    'M05;',
    'M30;',
    '%',
  ]

  return { ok: true, gcode: out.join('\n'), svg: '', programName }
}