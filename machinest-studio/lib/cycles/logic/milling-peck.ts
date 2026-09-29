import 'server-only'
import { CycleResult, fail, num } from './common'
import { buildPeckSvg } from './peck-svg'

const LIMITS = { progMax: 7999, rpmMin: 50, rpmMax: 15000, feedMax: 5000, maxPecks: 1000 }
const OFFSETS = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59']
const MODES = ['G98', 'G99']
const TYPES = ['G83', 'G73']

export function millingPeck(v: Record<string, unknown>): CycleResult {
  const cycleType = String(v.cycleType)
  const progNum = num(v.progNum)
  const radius = num(v.radius)
  const holes = num(v.holes)
  const startAngle = num(v.startAngle)
  const depth = num(v.depth)
  const peckDepth = num(v.peckDepth)
  const rlevel = num(v.retractlevel)
  const safeZ = num(v.safeZ)
  const feed = num(v.feed)
  const rpm = num(v.rpm)
  const workOffset = String(v.workOffset)
  const retractMode = String(v.retractMode)

  if (!TYPES.includes(cycleType)) return fail('Invalid cycle type')
  if (!Number.isInteger(progNum) || progNum < 1 || progNum > LIMITS.progMax)
    return fail(`Program number must be a whole number between 0001 and ${LIMITS.progMax}`)
  if (!Number.isFinite(radius) || radius < 1 || radius > 1000)
    return fail('Radius must be between 1 mm and 1000 mm')
  if (!Number.isInteger(holes) || holes < 1 || holes > 50)
    return fail('Number of holes must be a whole number between 1 and 50')
  if (!Number.isFinite(startAngle) || startAngle < 0 || startAngle > 360)
    return fail('Start angle must be between 0 and 360 degrees')
  if (!Number.isFinite(depth) || depth >= 0)
    return fail('Depth must be a negative value (below Z0)')
  if (!Number.isFinite(peckDepth) || peckDepth <= 0)
    return fail('Peck depth (Q) must be greater than 0')
  if (!Number.isFinite(rlevel) || rlevel < 0)
    return fail('Retract level (R) must be Z0 or above')
  if (!Number.isFinite(safeZ) || safeZ <= rlevel)
    return fail('Safe Z must be above the retract level')
  if (!Number.isFinite(feed) || feed <= 0 || feed > LIMITS.feedMax)
    return fail(`Feed must be greater than 0 and up to ${LIMITS.feedMax}`)
  if (!Number.isInteger(rpm) || rpm < LIMITS.rpmMin || rpm > LIMITS.rpmMax)
    return fail(`RPM must be a whole number between ${LIMITS.rpmMin} and ${LIMITS.rpmMax}`)
  if (!OFFSETS.includes(workOffset)) return fail('Invalid work offset')
  if (!MODES.includes(retractMode)) return fail('Invalid retract mode')

  if (peckDepth > Math.abs(depth))
    return fail(`Peck depth (Q) cannot be greater than the total drilling depth (${depth.toFixed(3)})`)

  // rounding se 1.1 / 0.1 jaisi values 12 na ban jayein
  const numPecks = Math.ceil(Math.round((Math.abs(depth) / peckDepth) * 1e6) / 1e6)
  if (numPecks > LIMITS.maxPecks)
    return fail(`Peck depth is too small for this depth (more than ${LIMITS.maxPecks} pecks)`)

  const angleStep = 360 / holes
  const programName = 'O' + String(progNum).padStart(4, '0')
  const cycleName =
    cycleType === 'G73'
      ? 'G73 High Speed Peck Drill (Chip Break)'
      : 'G83 Deep Hole Peck Drill (Full Retract)'

  const out: string[] = []
  out.push(
    '%',
    `${programName};`,
    `(${cycleName});`,
    '(Powered by MACHINEST);',
    '(SUPPORT-7988277215);'
  )
  if (cycleType === 'G73') out.push('(G73 CHIP-BREAK RETRACT IS SET BY CONTROL PARAMETER);')
  out.push(
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
    '',
    '(CHECK G16 POLAR PARAMETERS);',
    'G16;',
    `${cycleType} ${retractMode} X${radius.toFixed(3)} Y${startAngle.toFixed(3)} R${rlevel.toFixed(3)} Z${depth.toFixed(3)} Q${peckDepth.toFixed(3)} F${feed.toFixed(1)};`
  )

  for (let i = 1; i < holes; i++) {
    out.push(`Y${((startAngle + i * angleStep) % 360).toFixed(3)};`)
  }

  out.push(
    'G80;',
    'G15;',
    '',
    `G00 Z${safeZ.toFixed(3)} M09;`,
    'M05;',
    'G91 G28 Z0;',
    'G90;',
    'M30;',
    '%'
  )

  return {
    ok: true,
    gcode: out.join('\n'),
    svg: buildPeckSvg({ cycleType, radius, holes, startAngle, safeZ, rlevel, depth, peckDepth, numPecks }),
    programName,
  }
}