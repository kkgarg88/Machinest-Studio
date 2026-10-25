import 'server-only'
import { CycleResult, fail, num } from './common'
import { buildProfile, ProfilePoint, Corner, Seg } from '../g71-geometry'

const LIMITS = { progMax: 7999, feedMax: 5, rpmMax: 4000, diaMax: 500, maxPoints: 40 }
const OFFSETS = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59']
const SPINDLE = ['G96', 'G97']
const COMP = ['none', 'g42']
const EPS = 1e-6

const f3 = (n: number) => {
  const s = n.toFixed(3)
  return s === '-0.000' ? '0.000' : s
}
function opt(v: unknown): number {
  if (v === undefined || v === null || String(v).trim() === '') return 0
  return num(v)
}
const tcode = (n: number) => { const t = String(Math.trunc(n)).padStart(2, '0'); return `T${t}${t}` }

export function turningG71(v: Record<string, unknown>): CycleResult {
  const progNum = num(v.progNum)
  const toolRough = num(v.toolRough)
  const useFinish = String(v.useFinish) === '1'
  const toolFinishRaw = opt(v.toolFinish)
  const workOffset = String(v.workOffset)
  const spindleMode = String(v.spindleMode)
  const speed = num(v.speed)
  const speedFinishRaw = opt(v.speedFinish)
  const maxRpm = num(v.maxRpm)
  const feed = num(v.feed)
  const feedFinishRaw = opt(v.feedFinish)
  const safeX = num(v.safeX)
  const safeZ = num(v.safeZ)
  const stock = num(v.stock)
  const depth = num(v.depth)
  const retract = num(v.retract)
  const allowX = num(v.allowX) // finish allowance on diameter
  const allowZ = num(v.allowZ)
  const comp = String(v.comp)
  const noseR = opt(v.noseR)
  const tipNo = opt(v.tipNo)

  if (!Number.isInteger(progNum) || progNum < 1 || progNum > LIMITS.progMax)
    return fail(`Program number must be a whole number between 0001 and ${LIMITS.progMax}`)
  if (!Number.isInteger(toolRough) || toolRough < 1 || toolRough > 99) return fail('Roughing tool number must be between 1 and 99')
  if (!OFFSETS.includes(workOffset)) return fail('Invalid work offset')
  if (!SPINDLE.includes(spindleMode)) return fail('Invalid spindle mode')
  if (!Number.isFinite(speed) || speed <= 0 || speed > LIMITS.rpmMax) return fail(`Speed must be greater than 0 and up to ${LIMITS.rpmMax}`)
  if (!Number.isFinite(speedFinishRaw) || speedFinishRaw < 0 || speedFinishRaw > LIMITS.rpmMax) return fail(`Finish speed must be up to ${LIMITS.rpmMax}`)
  if (spindleMode === 'G96' && (!Number.isFinite(maxRpm) || maxRpm <= 0 || maxRpm > LIMITS.rpmMax))
    return fail('Max Spindle RPM (for G50) is required when using G96')
  if (!Number.isFinite(feed) || feed <= 0 || feed > LIMITS.feedMax) return fail(`Rough feed must be greater than 0 and up to ${LIMITS.feedMax} mm/rev`)
  if (!Number.isFinite(feedFinishRaw) || feedFinishRaw < 0 || feedFinishRaw > LIMITS.feedMax) return fail(`Finish feed must be up to ${LIMITS.feedMax} mm/rev`)
  if (!Number.isFinite(safeX) || safeX <= 0) return fail('Safe X clearance must be greater than 0')
  if (!Number.isFinite(safeZ) || safeZ <= 0) return fail('Safe Z clearance must be greater than 0')
  if (!Number.isFinite(stock) || stock <= 0 || stock > LIMITS.diaMax) return fail(`Stock diameter must be between 0 and ${LIMITS.diaMax} mm`)
  if (!Number.isFinite(depth) || depth <= 0) return fail('Depth of cut must be greater than 0')
  if (depth > stock / 2) return fail('Depth of cut is larger than the stock radius')
  if (!Number.isFinite(retract) || retract < 0) return fail('Retract cannot be negative')
  if (!Number.isFinite(allowX) || allowX < 0 || !Number.isFinite(allowZ) || allowZ < 0) return fail('Finish allowance cannot be negative')
  if (!COMP.includes(comp)) return fail('Invalid compensation option')
  if (!Number.isFinite(noseR) || noseR < 0 || noseR > 3.2) return fail('Nose radius must be between 0 and 3.2 mm')
  if (!Number.isFinite(tipNo) || tipNo < 0 || tipNo > 9 || !Number.isInteger(tipNo)) return fail('Tool tip number must be a whole number from 0 to 9')

  const usesComp = comp === 'g42'
  if (usesComp && !useFinish) return fail('G42 works only in the finish pass. Turn on the G70 finish pass or switch compensation off')
  if (usesComp && noseR <= 0) return fail('Enter the nose radius when using G42')
  if (useFinish) {
    if (!Number.isFinite(toolFinishRaw) || toolFinishRaw < 0 || toolFinishRaw > 99 || !Number.isInteger(toolFinishRaw)) return fail('Finish tool number must be between 1 and 99')
  }
  const toolFinish = toolFinishRaw > 0 ? toolFinishRaw : toolRough
  const speedFinish = speedFinishRaw > 0 ? speedFinishRaw : speed
  const feedFinish = feedFinishRaw > 0 ? feedFinishRaw : feed
  if (useFinish && feedFinishRaw <= 0) return fail('Enter the finish feed for the G70 finish pass')

  // ----- profile points -----
  let raw: unknown
  try { raw = JSON.parse(String(v.points)) } catch { return fail('Profile points are not valid') }
  if (!Array.isArray(raw)) return fail('Profile points are not valid')
  if (raw.length < 2) return fail('Add at least 2 profile points')
  if (raw.length > LIMITS.maxPoints) return fail(`Maximum ${LIMITS.maxPoints} profile points`)

  const pts: ProfilePoint[] = []
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i] as Record<string, unknown>
    const x = num(r?.x), z = num(r?.z)
    const corner = String(r?.corner ?? 'sharp') as Corner
    const size = opt(r?.size)
    if (!Number.isFinite(x) || !Number.isFinite(z)) return fail(`Point ${i + 1}: X and Z are required`)
    if (!['sharp', 'chamfer', 'radius'].includes(corner)) return fail(`Point ${i + 1}: invalid corner type`)
    if (x < 0) return fail(`Point ${i + 1}: X cannot be negative`)
    if (x > stock + EPS) return fail(`Point ${i + 1}: X ${x} is larger than the stock diameter ${stock}`)
    if (!Number.isFinite(size) || size < 0) return fail(`Point ${i + 1}: chamfer / radius size cannot be negative`)
    if ((i === 0 || i === raw.length - 1) && corner !== 'sharp') return fail(`Point ${i + 1}: the first and last point cannot have a chamfer or radius`)
    pts.push({ x, z, corner, size })
  }

  // Type I rules: diameter never decreases and Z never increases along the profile
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].z > pts[i - 1].z + EPS)
      return fail(`Point ${i + 1}: Z moves back towards the face. G71 Type I needs Z to keep going towards the chuck`)
    if (pts[i].x < pts[i - 1].x - EPS)
      return fail(`Point ${i + 1}: diameter gets smaller towards the chuck. That is an undercut and G71 Type I cannot rough it`)
  }

  const prof = buildProfile(pts)
  if (!prof.ok) return fail(prof.error)
  if (usesComp && noseR > 0) {
    for (const k of prof.concave) {
      if (pts[k - 1].corner === 'radius' && pts[k - 1].size < noseR - EPS)
        return fail(`Point ${k}: inside radius ${pts[k - 1].size} is smaller than the nose radius ${noseR}`)
    }
  }

  const z0 = pts[0].z
  const startZ = z0 + safeZ
  const clearX = stock + 2 * safeX
  const startX = stock + 1
  const programName = 'O' + String(progNum).padStart(4, '0')
  const sRough = spindleMode === 'G96' ? `G50 S${maxRpm};\nG96 S${speed} M03;` : `G97 S${speed} M03;`
  const sFinish = spindleMode === 'G96' ? `G96 S${speedFinish} M03;` : `G97 S${speedFinish} M03;`

  // ----- profile blocks -----
  const blocks: string[] = []
  let nn = 10
  const N = () => { const s = `N${nn}`; nn += 10; return s }
  const first = N()
  blocks.push(`${first} G00 ${usesComp ? 'G42 ' : ''}X${f3(pts[0].x)};`)
  blocks.push(`${N()} G01 Z${f3(z0)} F${f3(feedFinish)};`)
  let cx = pts[0].x, cz = z0
  for (const s of prof.segs as Seg[]) {
    const dx = Math.abs(s.x - cx) > EPS, dz = Math.abs(s.z - cz) > EPS
    if (!dx && !dz) continue
    if (s.kind === 'line') {
      blocks.push(`${N()} G01${dx ? ` X${f3(s.x)}` : ''}${dz ? ` Z${f3(s.z)}` : ''};`)
    } else {
      blocks.push(`${N()} ${s.ccw ? 'G03' : 'G02'} X${f3(s.x)} Z${f3(s.z)} R${f3(s.r)};`)
    }
    cx = s.x; cz = s.z
  }
  if (usesComp) {
    const lead = Math.max(stock, cx) + 2 * Math.max(1, noseR * 1.5)
    blocks.push(`${N()} G01 G40 X${f3(lead)};`)
  }
  const lastN = `N${nn - 10}`

  const out: string[] = [
    '%',
    `${programName};`,
    '(G71 ROUGH TURNING - OD);',
    '(Powered by MACHINEST);',
    '(SUPPORT-7988277215);',
    `(STOCK DIA=${f3(stock)}  POINTS=${pts.length}  DEPTH=${f3(depth)}  ALLOWANCE X=${f3(allowX)} Z=${f3(allowZ)});`,
  ]
  if (usesComp) {
    out.push(
      '(NOSE RADIUS COMPENSATION G42 IS USED IN THE FINISH PASS G70);',
      `(IN OFFSET ${tcode(toolFinish)} ENTER NOSE R = ${f3(noseR)} AND TOOL TIP NO. = ${tipNo > 0 ? tipNo : 3});`,
    )
  } else {
    out.push('(NO NOSE RADIUS COMPENSATION - PROFILE PROGRAMMED AS GIVEN);')
  }
  out.push(
    '',
    'G21 G99 G40;',
    'G28 U0 W0;',
    `${tcode(toolRough)};`,
    `G90 ${workOffset};`,
    sRough,
    `G00 X${f3(clearX)} Z${f3(startZ)};`,
    `G00 X${f3(startX)};`,
    '(ROUGHING);',
    `G71 U${f3(depth)} R${f3(retract)};`,
    `G71 P${first.slice(1)} Q${lastN.slice(1)} U${f3(allowX)} W${f3(allowZ)} F${f3(feed)};`,
    ...blocks,
  )

  if (useFinish) {
    out.push('(FINISHING);', 'G28 U0 W0;')
    if (toolFinish !== toolRough) out.push(`${tcode(toolFinish)};`)
    out.push(sFinish)
    out.push(`G00 X${f3(clearX)} Z${f3(startZ)};`, `G00 X${f3(startX)};`, `G70 P${first.slice(1)} Q${lastN.slice(1)};`)
  }
  out.push(`G00 X${f3(clearX)};`, `G00 Z${f3(safeZ)};`, 'G28 U0 W0;', 'M05;', 'M30;', '%')

  return { ok: true, gcode: out.join('\n'), svg: '', programName }
}
