import 'server-only'
import { CycleResult, fail, num } from './common'
import { FONT, ALLOWED_REGEX } from './engrave-font'

const LIMITS = {
  progMax: 7999,
  textMax: 60,
  heightMin: 0.5,
  heightMax: 200,
  spacingMax: 50,
  posMax: 1000,
  feedMax: 5000,
  rpmMin: 50,
  rpmMax: 15000,
}
const OFFSETS = ['G54', 'G55', 'G56', 'G57', 'G58', 'G59']

export function millingEngrave(v: Record<string, unknown>): CycleResult {
  const progNum = num(v.progNum)
  const text = typeof v.text === 'string' ? v.text : ''
  const startX = num(v.startX)
  const startY = num(v.startY)
  const charHeight = num(v.charHeight)
  const charSpacing = num(v.charSpacing)
  const depth = num(v.depth)
  const rlevel = num(v.retractlevel)
  const safeZ = num(v.safeZ)
  const feed = num(v.feed)
  const plungeFeed = num(v.plungeFeed)
  const rpm = num(v.rpm)
  const workOffset = String(v.workOffset)

  if (!Number.isInteger(progNum) || progNum < 1 || progNum > LIMITS.progMax)
    return fail(`Program number must be a whole number between 0001 and ${LIMITS.progMax}`)
  if (!text || text.trim().length === 0) return fail('Enter text to engrave')
  if (text.length > LIMITS.textMax) return fail(`Text must be ${LIMITS.textMax} characters or fewer`)
  if (!ALLOWED_REGEX.test(text)) return fail('Text can only contain A-Z, a-z, 0-9, . , - / ( ) and space')
  if (!Number.isFinite(startX) || Math.abs(startX) > LIMITS.posMax) return fail(`Start X must be within \u00b1${LIMITS.posMax} mm`)
  if (!Number.isFinite(startY) || Math.abs(startY) > LIMITS.posMax) return fail(`Start Y must be within \u00b1${LIMITS.posMax} mm`)
  if (!Number.isFinite(charHeight) || charHeight < LIMITS.heightMin || charHeight > LIMITS.heightMax)
    return fail(`Char height must be between ${LIMITS.heightMin} and ${LIMITS.heightMax} mm`)
  if (!Number.isFinite(charSpacing) || charSpacing < 0 || charSpacing > LIMITS.spacingMax)
    return fail(`Char spacing must be between 0 and ${LIMITS.spacingMax} mm`)
  if (!Number.isFinite(depth) || depth >= 0) return fail('Depth must be a negative value (below Z0)')
  if (!Number.isFinite(rlevel) || rlevel < 0) return fail('Retract level (R) must be Z0 or above')
  if (rlevel <= depth) return fail('Retract level must be greater than the engraving depth')
  if (!Number.isFinite(safeZ) || safeZ <= rlevel) return fail('Safe Z must be above the retract level')
  if (!Number.isFinite(feed) || feed <= 0 || feed > LIMITS.feedMax) return fail(`Cutting feed must be greater than 0 and up to ${LIMITS.feedMax}`)
  if (!Number.isFinite(plungeFeed) || plungeFeed <= 0 || plungeFeed > LIMITS.feedMax) return fail(`Plunge feed must be greater than 0 and up to ${LIMITS.feedMax}`)
  if (!Number.isInteger(rpm) || rpm < LIMITS.rpmMin || rpm > LIMITS.rpmMax) return fail(`RPM must be a whole number between ${LIMITS.rpmMin} and ${LIMITS.rpmMax}`)
  if (!OFFSETS.includes(workOffset)) return fail('Invalid work offset')

  const scale = charHeight / 7
  let cursorX = startX
  type Item = { ch: string; strokes: number[][][] }
  const layout: Item[] = []

  for (const ch of text) {
    const glyph = FONT[ch]
    if (!glyph) {
      cursorX += (3 + charSpacing) * scale
      continue
    }
    const realStrokes = glyph.s.map(stroke => stroke.map(pt => [cursorX + pt[0] * scale, startY + pt[1] * scale]))
    layout.push({ ch, strokes: realStrokes })
    cursorX += (glyph.w + charSpacing) * scale
  }

  const endX = cursorX - charSpacing * scale
  const programName = 'O' + String(progNum).padStart(4, '0')

  const out: string[] = [
    '%',
    `${programName};`,
    '(TEXT ENGRAVING CYCLE);',
    `(TEXT: ${text});`,
    '(Powered by MACHINEST);',
    '(SUPPORT-7988277215);',
    '',
    'G21 G90 G40 G49 G80 G94;',
    'G17;',
    'G91 G28 Z0;',
    'G90;',
    'T01 M06;',
    '',
    `G90 ${workOffset} G00 X${startX.toFixed(3)} Y${startY.toFixed(3)};`,
    `S${rpm} M03;`,
    `G43 H01 Z${safeZ.toFixed(3)} M08;`,
    `G00 Z${rlevel.toFixed(3)};`,
    '',
  ]

  for (const item of layout) {
    out.push(`(CHAR: ${item.ch === ' ' ? 'SPACE' : item.ch});`)
    for (const stroke of item.strokes) {
      if (stroke.length === 0) continue
      const p0 = stroke[0]
      out.push(`G00 X${p0[0].toFixed(3)} Y${p0[1].toFixed(3)};`)
      out.push(`G01 Z${depth.toFixed(3)} F${plungeFeed.toFixed(1)};`)
      for (let i = 1; i < stroke.length; i++) {
        out.push(`G01 X${stroke[i][0].toFixed(3)} Y${stroke[i][1].toFixed(3)} F${feed.toFixed(1)};`)
      }
      out.push(`G00 Z${rlevel.toFixed(3)};`)
    }
    out.push('')
  }

  out.push(
    `G00 Z${safeZ.toFixed(3)} M09;`,
    'M05;',
    'G91 G28 Z0;',
    'G90;',
    'M30;',
    '%'
  )

  const svg = buildEngraveSvg(layout, startX, startY, endX, charHeight, text)

  return { ok: true, gcode: out.join('\n'), svg, programName }
}

function buildEngraveSvg(
  layout: { ch: string; strokes: number[][][] }[],
  startX: number, startY: number, endX: number, charHeight: number, text: string
): string {
  let minX = startX, maxX = endX
  let minY = startY, maxY = startY + charHeight

  for (const item of layout) {
    for (const stroke of item.strokes) {
      for (const pt of stroke) {
        if (pt[0] < minX) minX = pt[0]
        if (pt[0] > maxX) maxX = pt[0]
        if (pt[1] < minY) minY = pt[1]
        if (pt[1] > maxY) maxY = pt[1]
      }
    }
  }

  const W = 900, H = 400, padding = 50
  const contentW = Math.max(maxX - minX, 1)
  const contentH = Math.max(maxY - minY, 1)
  const scale = Math.min((W - padding * 2) / contentW, (H - padding * 2 - 40) / contentH)

  const mapX = (x: number) => padding + (x - minX) * scale
  const mapY = (y: number) => (H - padding) - (y - minY) * scale

  const o: string[] = []
  o.push(`<line x1="${mapX(minX).toFixed(1)}" y1="${mapY(startY).toFixed(1)}" x2="${mapX(maxX).toFixed(1)}" y2="${mapY(startY).toFixed(1)}" stroke="#8a8782" stroke-width="1" stroke-dasharray="5 5"/>`)
  o.push(`<circle cx="${mapX(startX).toFixed(1)}" cy="${mapY(startY).toFixed(1)}" r="5" fill="#ff5252"/>`)

  for (const item of layout) {
    for (const stroke of item.strokes) {
      if (stroke.length === 0) continue
      const d = stroke.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${mapX(pt[0]).toFixed(1)} ${mapY(pt[1]).toFixed(1)}`).join(' ')
      o.push(`<path d="${d}" fill="none" stroke="#2fbf71" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`)
    }
  }

  const safeText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  o.push(`<text x="20" y="25" fill="#e8e6e3" font-size="16" font-weight="bold" font-family="Arial, sans-serif">TEXT : "${safeText}"</text>`)
  o.push(`<text x="20" y="42" fill="#bdbab5" font-size="12" font-family="Arial, sans-serif">CHAR HEIGHT : ${charHeight.toFixed(2)} mm &#183; LENGTH : ${(endX - startX).toFixed(2)} mm &#183; CHARS : ${text.length}</text>`)

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" xmlns="http://www.w3.org/2000/svg" role="img">${o.join('')}</svg>`
}