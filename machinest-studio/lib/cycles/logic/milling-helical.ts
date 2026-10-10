import 'server-only'
import { CycleResult, fail, num } from './common'
import { buildHelicalSvg } from './helical-svg'

const LIMITS = {
  progMax: 7999, diaMax: 500, feedMax: 5000, rpmMin: 50, rpmMax: 15000,
  toolNoMax: 200, maxPasses: 500, zMax: 1000,
}

export function millingHelical(v: Record<string, unknown>): CycleResult {
  const mode = String(v.mode)
  const progNum = num(v.progNum)
  const dia = num(v.dia)
  const toolDia = num(v.toolDia)
  const toolNo = num(v.toolNo)
  const dNo = num(v.dNo)
  const rpm = num(v.rpm)
  const feedXY = num(v.feedXY)
  const feedZ = num(v.feedZ)
  const startZ = num(v.startZ)
  const endZ = num(v.endZ)
  const stepZ = num(v.stepZ)
  const safeZ = num(v.safeZ)

  if (!['1', '2'].includes(mode)) return fail('Invalid mode')
  if (!Number.isInteger(progNum) || progNum < 1 || progNum > LIMITS.progMax)
    return fail(`Program number must be a whole number between 0001 and ${LIMITS.progMax}`)
  if (!Number.isFinite(dia) || dia <= 0 || dia > LIMITS.diaMax)
    return fail(`Diameter must be between 0 and ${LIMITS.diaMax} mm`)
  if (!Number.isFinite(toolDia) || toolDia <= 0 || toolDia > LIMITS.diaMax)
    return fail(`Tool diameter must be between 0 and ${LIMITS.diaMax} mm`)
  if (!Number.isInteger(toolNo) || toolNo < 1 || toolNo > LIMITS.toolNoMax)
    return fail(`Tool number must be a whole number between 1 and ${LIMITS.toolNoMax}`)
  if (!Number.isInteger(dNo) || dNo < 1 || dNo > LIMITS.toolNoMax)
    return fail(`D number must be a whole number between 1 and ${LIMITS.toolNoMax}`)
  if (!Number.isInteger(rpm) || rpm < LIMITS.rpmMin || rpm > LIMITS.rpmMax)
    return fail(`RPM must be a whole number between ${LIMITS.rpmMin} and ${LIMITS.rpmMax}`)
  if (!Number.isFinite(feedXY) || feedXY <= 0 || feedXY > LIMITS.feedMax)
    return fail(`Feed XY must be greater than 0 and up to ${LIMITS.feedMax}`)
  if (!Number.isFinite(feedZ) || feedZ <= 0 || feedZ > LIMITS.feedMax)
    return fail(`Feed Z must be greater than 0 and up to ${LIMITS.feedMax}`)
  if (!Number.isFinite(startZ) || Math.abs(startZ) > LIMITS.zMax) return fail(`Start Z must be within \u00b1${LIMITS.zMax}`)
  if (!Number.isFinite(endZ) || Math.abs(endZ) > LIMITS.zMax) return fail(`End Z must be within \u00b1${LIMITS.zMax}`)
  if (!Number.isFinite(safeZ) || Math.abs(safeZ) > LIMITS.zMax) return fail(`Safe Z must be within \u00b1${LIMITS.zMax}`)
  if (startZ <= endZ) return fail('Start Z must be greater (less negative) than End Z — cutting moves downward')
  if (!Number.isFinite(stepZ) || stepZ >= 0) return fail('Step Z must be a negative value')
  if (safeZ <= startZ) return fail('Safe Z must be above Start Z')

  const offsetRadius = mode === '1' ? (dia - toolDia) / 2 : (dia + toolDia) / 2
  if (mode === '1' && offsetRadius <= 0) return fail('Tool diameter is too large for this ID diameter')

  const totalDepth = startZ - endZ
  const numPasses = Math.ceil(Math.round((totalDepth / Math.abs(stepZ)) * 1e6) / 1e6)
  if (numPasses > LIMITS.maxPasses) return fail(`Step Z is too small for this depth (more than ${LIMITS.maxPasses} passes)`)

  const programName = 'O' + String(progNum).padStart(4, '0')

  const out: string[] = [
    '%',
    `${programName}`,
    '(HELICAL INTERPOLATION MACRO - OD/ID)',
    `(MODE: ${mode === '1' ? 'ID POCKET' : 'OD MILLING'})`,
    '(Powered by MACHINEST)',
    '(SUPPORT-7988277215)',
    '(VERIFY G41 DIRECTION AND G02 ROTATION MATCH YOUR SPINDLE/CLIMB SETUP ON SIMULATOR)',
    '',
    `#100=${mode} (1=ID 2=OD)`,
    `#101=${dia.toFixed(3)} (DIA)`,
    `#102=${toolDia.toFixed(3)} (TOOL DIA)`,
    `#103=${startZ.toFixed(3)} (START Z)`,
    `#104=${endZ.toFixed(3)} (END Z)`,
    `#105=${stepZ.toFixed(3)} (STEP Z)`,
    `#106=${feedXY.toFixed(1)} (FEED XY)`,
    `#107=${feedZ.toFixed(1)} (FEED Z)`,
    `#108=${rpm} (RPM)`,
    `#109=${safeZ.toFixed(3)} (SAFE Z)`,
    '',
    `#110=${toolNo} (TOOL NO)`,
    `#111=${dNo} (D NO)`,
    '',
    'IF[#100 EQ 1] THEN #120=[[#101-#102]/2]',
    'IF[#100 EQ 2] THEN #120=[[#101+#102]/2]',
    '',
    'G21 G17 G90 G40 G49 G80',
    'T#110 M06',
    'G54',
    'S#108 M03',
    '',
    'G00 G43 H#110 Z#109',
    'G00 X0. Y0.',
    '',
    'G01 Z#103 F#107',
    'G91 G41 D#111 X#120 F#106',
    '',
    '#130=#103',
    '',
    'WHILE[#130 GT #104]DO1',
    '#131=[#130+#105]',
    'IF[#131 LT #104] THEN #131=#104',
    '#132=[#131-#130]',
    'G02 X0. Y0. I-#120 Z#132 F#106',
    '#130=#131',
    'END1',
    '',
    'G91 G40 X-#120',
    'G90',
    'G00 Z#109 M09',
    'M05',
    'G91 G28 Z0',
    'G90 G49',
    'M30',
    '%',
  ]

  const svg = buildHelicalSvg({ mode: mode as '1' | '2', dia, toolDia, offsetRadius, startZ, endZ, stepZ, safeZ, numPasses })

  return { ok: true, gcode: out.join('\n'), svg, programName }
}