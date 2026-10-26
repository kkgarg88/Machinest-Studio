import 'server-only'
import { CycleResult, fail, num } from './common'
import { computeTap, TapMethod } from '../tap-motion'

const LIMITS = { progMax: 7999, rpmMax: 6000 }
const OFFSETS = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59']
const CTLS = ['A', 'B', 'C']
const METHODS = ['rigid', 'sync']

// rigid = canned tapping cycle with M29, sync = pitch-synchronised thread cutting block with spindle reversal
const CODES: Record<string, { rigid: string; sync: string; header: string; offset: (w: string) => string }> = {
  A: { rigid: 'G84', sync: 'G32', header: 'G21 G99 G40;', offset: w => `${w};` },
  B: { rigid: 'G84', sync: 'G32', header: 'G21 G95 G40;', offset: w => `G90 ${w};` },
  C: { rigid: 'G84', sync: 'G33', header: 'G71 G95 G40;', offset: w => `G90 ${w};` },
}

function opt(v: unknown): number {
  if (v === undefined || v === null || String(v).trim() === '') return 0
  return num(v)
}
const f3 = (n: number) => {
  const s = n.toFixed(3)
  return s === '-0.000' ? '0.000' : s
}
const fn = (n: number) => String(Number(n.toFixed(4)))

export function turningTap(v: Record<string, unknown>): CycleResult {
  const progNum = num(v.progNum)
  const toolNo = num(v.toolNo)
  const workOffset = String(v.workOffset)
  const ctl = String(v.ctl)
  const method = String(v.method)
  const D = num(v.d), lead = num(v.p), depth = num(v.depth), faceZ = num(v.faceZ)
  const rpm = num(v.rpm), maxFeed = num(v.maxFeed), dwell = opt(v.dwell)
  const cool = String(v.coolant) === '1'

  if (!Number.isInteger(progNum) || progNum < 1 || progNum > LIMITS.progMax)
    return fail(`Program number must be a whole number between 0001 and ${LIMITS.progMax}`)
  if (!Number.isInteger(toolNo) || toolNo < 1 || toolNo > 99) return fail('Tool number must be a whole number between 1 and 99')
  if (!OFFSETS.includes(workOffset)) return fail('Invalid work offset')
  if (!CTLS.includes(ctl)) return fail('Invalid control type')
  if (!METHODS.includes(method)) return fail('Invalid method')
  if (!Number.isFinite(maxFeed) || maxFeed <= 0) return fail('Enter the machine maximum cutting feed (mm/min)')

  const calc = computeTap({ D, lead, depth, faceZ, method: method as TapMethod, rpm, dwell, maxFeed })
  if (!calc.ok) return fail(calc.error)
  if (lead * rpm > maxFeed) return fail(`Lead × RPM = ${Math.round(lead * rpm)} mm/min is above the machine limit ${maxFeed}. Reduce the RPM`)

  const { geom } = calc
  const C = CODES[ctl]
  const programName = 'O' + String(progNum).padStart(4, '0')
  const tool = String(Math.trunc(toolNo)).padStart(2, '0')
  const title = method === 'rigid' ? `${C.rigid} RIGID TAPPING` : `${C.sync} TAPPING, SPINDLE REVERSAL`

  const out: string[] = [
    '%',
    `${programName};`,
    '(TAPPING - ON CENTRE);',
    '(Powered by MACHINEST);',
    '(SUPPORT-7988277215);',
    `(TAP M${fn(D)} X ${fn(lead)}  DEPTH=${fn(depth)}  PRE-DRILL DIA ${fn(geom.preD)});`,
    `(CONTROL TYPE ${ctl} - ${title});`,
    '',
    C.header,
    'G28 U0 W0;',
    `T${tool}${tool};`,
    C.offset(workOffset),
  ]
  if (method === 'rigid') {
    if (cool) out.push('M08;')
    out.push(
      `G00 X0 Z${f3(geom.zInit)};`,
      `M29 S${rpm};`,
      `${C.rigid} Z${f3(geom.zEnd)} R${f3(geom.zR - geom.zInit)}${dwell > 0 ? ' P' + Math.round(dwell * 1000) : ''} F${fn(lead)};`,
      'G80;',
    )
  } else {
    out.push(`G97 S${rpm} M03;`)
    if (cool) out.push('M08;')
    out.push(
      `G00 X0 Z${f3(geom.zInit)};`,
      `G00 Z${f3(geom.zS)};`,
      `${C.sync} Z${f3(geom.zEnd)} F${fn(lead)};`,
      'M05;',
      'M04;',
      `${C.sync} Z${f3(geom.zS)} F${fn(lead)};`,
      'M05;',
      `G00 Z${f3(geom.zInit)};`,
    )
  }
  if (cool) out.push('M09;')
  out.push('G28 U0 W0;', 'M05;', 'M30;', '%')

  return { ok: true, gcode: out.join('\n'), svg: '', programName }
}
