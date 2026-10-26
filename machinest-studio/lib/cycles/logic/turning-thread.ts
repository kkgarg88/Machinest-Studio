import 'server-only'
import { CycleResult, fail, num } from './common'
import { computeThread } from '../thread-motion'

const LIMITS = { progMax: 7999, rpmMax: 4000, diaMax: 500, pitchMax: 12, lengthMax: 1000 }
const OFFSETS = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59']
const CTLS = ['A', 'B', 'C']
const METHODS = ['multi', 'single']
const RUNOUT = ['groove', 'chamfer']

// Fanuc G-code systems: A = G76 / G92, B = G76 / G78, C = G78 / G21
const CODES: Record<string, { multi: string; single: string; header: string; offset: (w: string) => string }> = {
  A: { multi: 'G76', single: 'G92', header: 'G21 G99 G40;', offset: w => `${w};` },
  B: { multi: 'G76', single: 'G78', header: 'G21 G95 G40;', offset: w => `G90 ${w};` },
  C: { multi: 'G78', single: 'G21', header: 'G71 G95 G40;', offset: w => `G90 ${w};` },
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

export function turningThread(v: Record<string, unknown>): CycleResult {
  const progNum = num(v.progNum)
  const toolNo = num(v.toolNo)
  const workOffset = String(v.workOffset)
  const ctl = String(v.ctl)
  const method = String(v.method)
  const runout = String(v.runout)
  const ang = num(v.ang)
  const D = num(v.d), P = num(v.p), h = num(v.h)
  const zStart = num(v.zStart), L = num(v.len)
  const d1 = num(v.d1), dmin = num(v.dmin)
  const fin = opt(v.fin)
  const m = opt(v.m)
  const rpm = num(v.rpm)
  const maxFeed = num(v.maxFeed)

  if (!Number.isInteger(progNum) || progNum < 1 || progNum > LIMITS.progMax)
    return fail(`Program number must be a whole number between 0001 and ${LIMITS.progMax}`)
  if (!Number.isInteger(toolNo) || toolNo < 1 || toolNo > 99) return fail('Tool number must be a whole number between 1 and 99')
  if (!OFFSETS.includes(workOffset)) return fail('Invalid work offset')
  if (!CTLS.includes(ctl)) return fail('Invalid control type')
  if (!METHODS.includes(method)) return fail('Invalid method')
  if (!RUNOUT.includes(runout)) return fail('Invalid thread end option')
  if (![60, 29, 0].includes(ang)) return fail('Invalid infeed angle')
  if (!Number.isFinite(D) || D <= 0 || D > LIMITS.diaMax) return fail(`Major diameter must be between 0 and ${LIMITS.diaMax} mm`)
  if (!Number.isFinite(P) || P < 0.1 || P > LIMITS.pitchMax) return fail(`Pitch must be between 0.1 and ${LIMITS.pitchMax} mm`)
  if (!Number.isFinite(h) || h <= 0) return fail('Thread height must be greater than 0')
  if (!Number.isFinite(zStart) || Math.abs(zStart) > 1000) return fail('Enter the Z position where the thread starts')
  if (!Number.isFinite(L) || L <= 0 || L > LIMITS.lengthMax) return fail(`Thread length must be between 0 and ${LIMITS.lengthMax} mm`)
  if (!Number.isFinite(d1) || d1 <= 0) return fail('First cut depth must be greater than 0')
  if (!Number.isFinite(dmin) || dmin <= 0) return fail('Minimum cut depth must be greater than 0')
  if (!Number.isFinite(fin) || fin < 0) return fail('Finish allowance cannot be negative')
  if (!Number.isInteger(m) || m < 0 || m > 99) return fail('Spring / finish passes must be a whole number from 0 to 99')
  if (method === 'multi' && m < 1) return fail('Multi-pass cycle needs at least 1 finish pass')
  if (!Number.isFinite(rpm) || rpm <= 0 || rpm > LIMITS.rpmMax) return fail(`Spindle speed must be greater than 0 and up to ${LIMITS.rpmMax} RPM`)
  if (!Number.isFinite(maxFeed) || maxFeed <= 0) return fail('Enter the machine maximum cutting feed (mm/min)')
  if (ctl === 'C' && method === 'multi')
    return fail('The type C multi-pass (G78) format is not confirmed yet. Use the single-pass cycle (G21) for type C')

  const calc = computeThread({ D, P, h, zStart, L, d1, dmin, fin, m, rpm, maxFeed, runout: runout as 'groove' | 'chamfer', ang })
  if (!calc.ok) return fail(calc.error)
  if (P * rpm > maxFeed) return fail(`Lead × RPM = ${Math.round(P * rpm)} mm/min is above the machine limit ${maxFeed}. Reduce the RPM`)
  if (Math.round(dmin * 1000) < 1 || Math.round(d1 * 1000) < 1) return fail('Cut depths are too small')

  const { sch, geom } = calc
  const C = CODES[ctl]
  const programName = 'O' + String(progNum).padStart(4, '0')
  const tool = String(Math.trunc(toolNo)).padStart(2, '0')

  const out: string[] = [
    '%',
    `${programName};`,
    '(THREADING - OD);',
    '(Powered by MACHINEST);',
    '(SUPPORT-7988277215);',
    `(THREAD DIA=${fn(D)} PITCH=${fn(P)} HEIGHT=${fn(h)} MINOR=${f3(geom.minor)} LENGTH=${fn(L)});`,
    `(CONTROL TYPE ${ctl} - ${method === 'multi' ? C.multi + ' MULTI-PASS CYCLE' : C.single + ' SINGLE-PASS CYCLE, ' + sch.length + ' PASSES'});`,
    '',
    C.header,
    'G28 U0 W0;',
    `T${tool}${tool};`,
    C.offset(workOffset),
    `G97 S${rpm} M03;`,
    `G00 X${f3(geom.xS)} Z${f3(geom.zS)};`,
  ]

  if (method === 'multi') {
    const m2 = String(m).padStart(2, '0'), r2 = String(geom.rr).padStart(2, '0'), a2 = String(ang).padStart(2, '0')
    out.push(
      `${C.multi} P${m2}${r2}${a2} Q${Math.round(dmin * 1000)} R${f3(fin)};`,
      `${C.multi} X${f3(geom.minor)} Z${f3(geom.zEnd)} P${Math.round(h * 1000)} Q${Math.round(d1 * 1000)} F${fn(P)};`,
    )
  } else {
    sch.forEach((s, i) => {
      const x = D - 2 * s.c
      out.push(i === 0 ? `${C.single} X${f3(x)} Z${f3(geom.zEnd)} F${fn(P)};` : `X${f3(x)};`)
    })
  }
  out.push(`G00 X${f3(geom.xS)};`, `G00 Z${f3(geom.zS)};`, 'G28 U0 W0;', 'M05;', 'M30;', '%')

  return { ok: true, gcode: out.join('\n'), svg: '', programName }
}
