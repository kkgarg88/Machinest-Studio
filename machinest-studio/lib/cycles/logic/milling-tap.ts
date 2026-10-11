import 'server-only'
import { CycleResult, fail, num } from './common'
import { buildPeckSvg } from './peck-svg'

const LIMITS = { progMax: 7999, rpmMin: 50, rpmMax: 6000, pitchMax: 6, maxPecks: 200 }
const OFFSETS = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59']
const MODES = ['G98', 'G99']
const DIRECTIONS = ['RH', 'LH']
const TAP_TYPES = ['continuous', 'peck']

export function millingTap(v: Record<string, unknown>): CycleResult {
  const direction = String(v.direction)
  const tapType = String(v.tapType)
  const progNum = num(v.progNum)
  const radius = num(v.radius)
  const holes = num(v.holes)
  const startAngle = num(v.startAngle)
  const depth = num(v.depth)
  const pitch = num(v.pitch)
  const peckDepth = num(v.peckDepth)
  const rlevel = num(v.retractlevel)
  const safeZ = num(v.safeZ)
  const rpm = num(v.rpm)
  const workOffset = String(v.workOffset)
  const retractMode = String(v.retractMode)

  if (!DIRECTIONS.includes(direction)) return fail('Invalid thread direction')
  if (!TAP_TYPES.includes(tapType)) return fail('Invalid tapping type')
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
  if (!Number.isFinite(pitch) || pitch <= 0 || pitch > LIMITS.pitchMax)
    return fail(`Pitch must be greater than 0 and up to ${LIMITS.pitchMax} mm`)
  if (!Number.isFinite(rlevel) || rlevel < 0)
    return fail('Retract level (R) must be Z0 or above')
  if (!Number.isFinite(safeZ) || safeZ <= rlevel)
    return fail('Safe Z must be above the retract level')
  if (!Number.isInteger(rpm) || rpm < LIMITS.rpmMin || rpm > LIMITS.rpmMax)
    return fail(`RPM must be a whole number between ${LIMITS.rpmMin} and ${LIMITS.rpmMax}`)
  if (!OFFSETS.includes(workOffset)) return fail('Invalid work offset')
  if (!MODES.includes(retractMode)) return fail('Invalid retract mode')

  let numPecks = 1
  if (tapType === 'peck') {
    if (!Number.isFinite(peckDepth) || peckDepth <= 0)
      return fail('Peck depth (Q) must be greater than 0')
    if (peckDepth > Math.abs(depth))
      return fail(`Peck depth (Q) cannot be greater than the total tapping depth (${depth.toFixed(3)})`)
    numPecks = Math.ceil(Math.round((Math.abs(depth) / peckDepth) * 1e6) / 1e6)
    if (numPecks > LIMITS.maxPecks)
      return fail(`Peck depth is too small for this depth (more than ${LIMITS.maxPecks} pecks)`)
  }

  const feed = rpm * pitch // rigid tap: feed MUST equal RPM x pitch, synchronized

  const angleStep = 360 / holes
  const programName = 'O' + String(progNum).padStart(4, '0')
  const tapCode = direction === 'RH' ? 'G84' : 'G74'
  const startSpindle = direction === 'RH' ? 'M03' : 'M04'
  const cycleName = `${tapCode} Rigid Tapping (${direction === 'RH' ? 'Right-Hand' : 'Left-Hand'}${tapType === 'peck' ? ', Peck' : ''})`

  const out: string[] = [
    '%',
    `${programName};`,
    `(${cycleName});`,
    '(Powered by MACHINEST);',
    '(SUPPORT-7988277215);',
    `(PITCH=${pitch.toFixed(3)} RPM=${rpm} FEED=RPM x PITCH=${feed.toFixed(1)});`,
  ]
  if (tapType === 'peck') {
    out.push('(PECK TAP USES G84/G74 WITH Q - VERIFY THIS SYNTAX IS SUPPORTED ON YOUR CONTROL);')
  }
  out.push(
    '',
    'G21 G90 G40 G49 G80 G94;',
    'G17;',
    'G91 G28 Z0;',
    'G90;',
    'T01 M06;',
    '',
    `G90 ${workOffset} G00 X0 Y0;`,
    `S${rpm} ${startSpindle};`,
    `G43 H01 Z${safeZ.toFixed(3)} M08;`,
    '',
    '(CHECK G16 POLAR PARAMETERS);',
    'G16;'
  )

  const qPart = tapType === 'peck' ? ` Q${peckDepth.toFixed(3)}` : ''
  out.push(
    `${tapCode} ${retractMode} X${radius.toFixed(3)} Y${startAngle.toFixed(3)} R${rlevel.toFixed(3)} Z${depth.toFixed(3)}${qPart} F${feed.toFixed(1)};`
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

  const svg = buildPeckSvg({
    cycleType: tapCode, radius, holes, startAngle, safeZ, rlevel, depth,
    peckDepth: tapType === 'peck' ? peckDepth : Math.abs(depth),
    numPecks,
  })

  return { ok: true, gcode: out.join('\n'), svg, programName }
}