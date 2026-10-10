import 'server-only'

const INK = '#e8e6e3', MUTED = '#9a9691'
const BLUE = '#4dabf7', ORANGE = '#F0801E', GREEN = '#51cf66', PURPLE = '#b197fc'

const px = (n: number) => n.toFixed(1)

function head(x: number, y: number, ang: number, color: string): string {
  const s = 8
  const ax = x - s * Math.cos(ang - Math.PI / 7)
  const ay = y - s * Math.sin(ang - Math.PI / 7)
  const bx = x - s * Math.cos(ang + Math.PI / 7)
  const by = y - s * Math.sin(ang + Math.PI / 7)
  return `<polygon points="${px(x)},${px(y)} ${px(ax)},${px(ay)} ${px(bx)},${px(by)}" fill="${color}"/>`
}

function dim(x1: number, y1: number, x2: number, y2: number, color: string): string {
  const a = Math.atan2(y2 - y1, x2 - x1)
  return (
    `<line x1="${px(x1)}" y1="${px(y1)}" x2="${px(x2)}" y2="${px(y2)}" stroke="${color}" stroke-width="1.8"/>` +
    head(x1, y1, a + Math.PI, color) + head(x2, y2, a, color)
  )
}

function line(x1: number, y1: number, x2: number, y2: number, color: string, dash = '', w = 1.3): string {
  return `<line x1="${px(x1)}" y1="${px(y1)}" x2="${px(x2)}" y2="${px(y2)}" stroke="${color}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
}

function txt(x: number, y: number, s: string, color: string, o: { size?: number; bold?: boolean; anchor?: string; rotate?: boolean } = {}): string {
  const { size = 13, bold = true, anchor = 'start', rotate = false } = o
  const tr = rotate ? ` transform="rotate(-90 ${px(x)} ${px(y)})"` : ''
  return `<text x="${px(x)}" y="${px(y)}" fill="${color}" font-size="${size}" font-weight="${bold ? 700 : 400}" text-anchor="${anchor}" font-family="Arial, sans-serif"${tr}>${s}</text>`
}

export function buildHelicalSvg(s: {
  mode: '1' | '2'; dia: number; toolDia: number; offsetRadius: number
  startZ: number; endZ: number; stepZ: number; safeZ: number; numPasses: number
}): string {
  const o: string[] = []
  o.push(line(445, 0, 445, 420, '#4a4744', '4 4'))

  // ---------- TOP VIEW ----------
  const cx = 215, cy = 160
  const maxFeatureRadius = s.mode === '1' ? s.dia / 2 : s.offsetRadius + s.toolDia / 2
  const k = 130 / maxFeatureRadius

  o.push(txt(15, 28, 'TOP VIEW', INK, { size: 15 }))
  o.push(txt(15, 48, s.mode === '1' ? 'ID Pocket — boring inside a hole' : 'OD Milling — machining around a boss', MUTED, { size: 12, bold: false }))

  // feature circle (the ID or OD surface)
  o.push(`<circle cx="${px(cx)}" cy="${px(cy)}" r="${px((s.dia / 2) * k)}" fill="none" stroke="${BLUE}" stroke-width="2.5"/>`)
  // tool center path (dashed)
  o.push(`<circle cx="${px(cx)}" cy="${px(cy)}" r="${px(s.offsetRadius * k)}" fill="none" stroke="${GREEN}" stroke-width="1.6" stroke-dasharray="5 3"/>`)
  o.push(`<circle cx="${px(cx)}" cy="${px(cy)}" r="4" fill="#ff5252"/>`)

  // lead-in from center to engage point
  const engageX = cx + s.offsetRadius * k
  o.push(line(cx, cy, engageX, cy, ORANGE, '', 1.6))
  o.push(head(engageX, cy, 0, ORANGE))
  o.push(`<circle cx="${px(engageX)}" cy="${px(cy)}" r="4" fill="${ORANGE}"/>`)

  o.push(dim(cx, cy + (s.dia / 2) * k + 26, engageX, cy + (s.dia / 2) * k + 26, BLUE))
  o.push(txt(cx + ((engageX - cx) / 2), cy + (s.dia / 2) * k + 42, `TOOL CENTER R: ${s.offsetRadius.toFixed(3)}`, GREEN, { size: 11, anchor: 'middle' }))

  o.push(txt(15, 335, `${s.mode === '1' ? 'ID' : 'OD'} \u2300: ${s.dia.toFixed(3)} mm   \u00b7   Tool \u2300: ${s.toolDia.toFixed(3)} mm`, '#ddd', { size: 12, bold: false }))

  // ---------- SIDE VIEW (Z helical steps) ----------
  o.push(txt(465, 28, 'SIDE VIEW (HELICAL Z STEPS)', INK, { size: 15 }))

  const axisX = 700, y0t = 60, y0 = 90, bottom = 340
  const totalDepth = Math.abs(s.startZ - s.endZ)
  const kZ = Math.min((y0 - y0t) / Math.max(s.safeZ - s.startZ, 1), (bottom - y0) / Math.max(totalDepth, 1))

  const ySafe = y0 - (s.safeZ - s.startZ) * kZ
  const yStart = y0
  const yEnd = y0 + totalDepth * kZ

  o.push(`<rect x="${axisX - 70}" y="${y0}" width="140" height="${bottom - y0}" fill="#3a3733" stroke="#8a8782" stroke-width="1.3"/>`)

  if (s.numPasses <= 60) {
    for (let i = 1; i < s.numPasses; i++) {
      const yp = y0 + Math.min(i * Math.abs(s.stepZ), totalDepth) * kZ
      o.push(line(axisX - 70, yp, axisX + 70, yp, PURPLE, '3 2'))
    }
  }

  o.push(line(axisX - 70, ySafe, axisX + 70, ySafe, MUTED, '3 3'))
  o.push(txt(axisX - 68, ySafe - 6, 'Safe Z', MUTED, { size: 10.5, bold: false }))
  o.push(txt(axisX - 68, yStart - 6, 'Start Z', '#ddd', { size: 10.5, bold: false }))

  const colD = axisX + 90
  o.push(dim(colD, yStart, colD, yEnd, ORANGE))
  o.push(txt(colD + 14, (yStart + yEnd) / 2, `DEPTH: ${totalDepth.toFixed(3)}`, ORANGE, { size: 11, anchor: 'middle', rotate: true }))

  o.push(txt(465, 360, `Start Z: ${s.startZ.toFixed(3)}  \u00b7  End Z: ${s.endZ.toFixed(3)}  \u00b7  Step: ${s.stepZ.toFixed(3)}`, '#ddd', { size: 11.5, bold: false }))
  o.push(txt(465, 378, `No. of helical passes: ${s.numPasses}`, PURPLE, { size: 11.5 }))

  return `<svg viewBox="0 0 900 400" width="100%" xmlns="http://www.w3.org/2000/svg" role="img">${o.join('')}</svg>`
}