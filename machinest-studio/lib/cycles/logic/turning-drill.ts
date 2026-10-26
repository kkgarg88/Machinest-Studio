import 'server-only'
import { CycleResult, fail, num } from './common'
import { computeDrill, DrillMethod } from '../drill-motion'

const LIMITS = { progMax: 7999, rpmMax: 6000 }
const OFFSETS = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59']
const CTLS = ['A', 'B', 'C']
const METHODS = ['chip', 'full', 'plain']

// chip = peck with chip break, full = peck with full retract
const CODES: Record<string, { chip: string; full: string; header: string; offset: (w: string) => string }> = {
  A: { chip: 'G74', full: 'G83', header: 'G21 G99 G40;', offset: w => `${w};` },
  B: { chip: 'G74', full: 'G83', header: 'G21 G95 G40;', offset: w => `G90 ${w};` },
  C: { chip: 'G76', full: 'G83', header: 'G71 G95 G40;', offset: w => `G90 ${w};` },
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

export function turningDrill(v: Record<string, unknown>): CycleResult {
  const progNum = num(v.progNum)
  const toolNo = num(v.toolNo)
  const workOffset = String(v.workOffset)
  const ctl = String(v.ctl)
  const method = String(v.method)
  const depthTo = String(v.depthTo) === 'tip' ? 'tip' : 'full'
  const D = num(v.d), depth = num(v.depth), tip = num(v.tip), faceZ = num(v.faceZ)
  const Q = opt(v.q), e = opt(v.e)
  const rpm = num(v.rpm), feed = num(v.feed), dwell = opt(v.dwell)
  const cool = String(v.coolant) === '1'

  if (!Number.isInteger(progNum) || progNum < 1 || progNum > LIMITS.progMax)
    return fail(`Program number must be a whole number between 0001 and ${LIMITS.progMax}`)
  if (!Number.isInteger(toolNo) || toolNo < 1 || toolNo > 99) return fail('Tool number must be a whole number between 1 and 99')
  if (!OFFSETS.includes(workOffset)) return fail('Invalid work offset')
  if (!CTLS.includes(ctl)) return fail('Invalid control type')
  if (!METHODS.includes(method)) return fail('Invalid method')
  if (!Number.isFinite(rpm) || rpm <= 0 || rpm > LIMITS.rpmMax) return fail(`Spindle speed must be greater than 0 and up to ${LIMITS.rpmMax} RPM`)

  const calc = computeDrill({ D, depth, depthTo, tip, faceZ, method: method as DrillMethod, Q, e, rpm, feed, dwell })
  if (!calc.ok) return fail(calc.error)

  const { geom } = calc
  const C = CODES[ctl]
  const programName = 'O' + String(progNum).padStart(4, '0')
  const tool = String(Math.trunc(toolNo)).padStart(2, '0')
  const title = method === 'chip' ? `${C.chip} PECK DRILLING, CHIP BREAK` : method === 'full' ? `${C.full} PECK DRILLING, FULL RETRACT` : 'PLAIN DRILLING, NO PECK'

  const out: string[] = [
    '%',
    `${programName};`,
    '(DRILLING - ON CENTRE);',
    '(Powered by MACHINEST);',
    '(SUPPORT-7988277215);',
    `(DRILL DIA=${fn(D)} DEPTH=${fn(depth)}${depthTo === 'full' ? ' TO FULL DIA + TIP ' + f3(geom.tipLen) : ' TO TIP'} = Z${f3(geom.zEnd)});`,
    `(CONTROL TYPE ${ctl} - ${title});`,
    '',
    C.header,
    'G28 U0 W0;',
    `T${tool}${tool};`,
    C.offset(workOffset),
    `G97 S${rpm} M03;`,
  ]
  if (cool) out.push('M08;')
  out.push(`G00 X0 Z${f3(geom.zInit)};`)

  if (method === 'plain') {
    out.push(`G00 Z${f3(geom.zR)};`, `G01 Z${f3(geom.zEnd)} F${fn(feed)};`)
    if (dwell > 0) out.push(`G04 X${dwell.toFixed(1)};`)
    out.push(`G00 Z${f3(geom.zInit)};`)
  } else if (method === 'chip') {
    out.push(
      `G00 Z${f3(geom.zR)};`,
      `${C.chip} R${fn(e)};`,
      `${C.chip} Z${f3(geom.zEnd)} Q${Math.round(Q * 1000)} F${fn(feed)};`,
      `G00 Z${f3(geom.zInit)};`,
    )
  } else {
    out.push(`${C.full} Z${f3(geom.zEnd)} R${f3(geom.zR - geom.zInit)} Q${f3(Q)}${dwell > 0 ? ' P' + Math.round(dwell * 1000) : ''} F${fn(feed)};`, 'G80;')
  }
  if (cool) out.push('M09;')
  out.push('G28 U0 W0;', 'M05;', 'M30;', '%')

  return { ok: true, gcode: out.join('\n'), svg: '', programName }
}
