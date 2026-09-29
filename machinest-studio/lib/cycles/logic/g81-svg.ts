import 'server-only'

type S = { radius: number; holes: number; startAngle: number; safeZ: number; rlevel: number; depth: number }

const INK = '#e8e6e3'
const MUTED = '#8a8782'
const GRAY = '#bdbab5'
const BLUE = '#4dabf7'
const ORANGE = '#F0801E'
const GREEN = '#2fbf71'

const px = (n: number) => n.toFixed(1)

function head(x: number, y: number, ang: number, color: string) {
  const s = 7
  const ax = x - s * Math.cos(ang - Math.PI / 7)
  const ay = y - s * Math.sin(ang - Math.PI / 7)
  const bx = x - s * Math.cos(ang + Math.PI / 7)
  const by = y - s * Math.sin(ang + Math.PI / 7)
  return `<polygon points="${px(x)},${px(y)} ${px(ax)},${px(ay)} ${px(bx)},${px(by)}" fill="${color}"/>`
}

function dim(x1: number, y1: number, x2: number, y2: number, color: string) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  return (
    `<line x1="${px(x1)}" y1="${px(y1)}" x2="${px(x2)}" y2="${px(y2)}" stroke="${color}" stroke-width="1.5"/>` +
    head(x1, y1, a + Math.PI, color) +
    head(x2, y2, a, color)
  )
}

function line(x1: number, y1: number, x2: number, y2: number, color: string, dash = '') {
  return `<line x1="${px(x1)}" y1="${px(y1)}" x2="${px(x2)}" y2="${px(y2)}" stroke="${color}" stroke-width="1"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
}

function txt(
  x: number, y: number, s: string, color: string,
  o: { size?: number; bold?: boolean; anchor?: string; rotate?: boolean } = {}
) {
  const { size = 12, bold = true, anchor = 'start', rotate = false } = o
  const tr = rotate ? ` transform="rotate(-90 ${px(x)} ${px(y)})"` : ''
  return `<text x="${px(x)}" y="${px(y)}" fill="${color}" font-size="${size}" font-weight="${bold ? 700 : 400}" text-anchor="${anchor}" font-family="Arial, sans-serif"${tr}>${s}</text>`
}

export function buildG81Svg(s: S): string {
  const o: string[] = []

  // divider
  o.push(line(445, 0, 445, 460, '#4a4744', '4 4'))

  // ---------- TOP VIEW ----------
  const cx = 215, cy = 185, R = 130
  o.push(txt(15, 28, 'TOP VIEW', INK, { size: 15 }))
  o.push(txt(15, 50, `Start \u2220 : ${s.startAngle.toFixed(2)}\u00B0`, BLUE, { size: 13 }))

  o.push(`<circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${BLUE}" stroke-width="2.5"/>`)
  o.push(`<circle cx="${cx}" cy="${cy}" r="4" fill="#ff5252"/>`)
  o.push(line(cx, cy, cx + R + 15, cy, MUTED, '3 3'))

  const a = (s.startAngle * Math.PI) / 180
  if (s.startAngle % 360 !== 0) {
    const ex = cx + 34 * Math.cos(a)
    const ey = cy - 34 * Math.sin(a)
    o.push(
      `<path d="M ${cx + 34} ${cy} A 34 34 0 ${s.startAngle > 180 ? 1 : 0} 0 ${px(ex)} ${px(ey)}" fill="none" stroke="${MUTED}" stroke-width="1.5"/>`
    )
  }
  const ax = cx + (R + 22) * Math.cos(a)
  const ay = cy - (R + 22) * Math.sin(a)
  o.push(line(cx, cy, ax, ay, BLUE, '5 4'))
  o.push(head(ax, ay, -a, BLUE))

  const step = 360 / s.holes
  for (let i = 0; i < s.holes; i++) {
    const ang = ((s.startAngle + i * step) * Math.PI) / 180
    const hx = cx + R * Math.cos(ang)
    const hy = cy - R * Math.sin(ang)
    o.push(`<circle cx="${px(hx)}" cy="${px(hy)}" r="7" fill="${GREEN}" stroke="#111" stroke-width="1"/>`)
  }

  const dimY = cy + R + 40
  o.push(line(cx - R, cy + R, cx - R, dimY, MUTED))
  o.push(line(cx + R, cy + R, cx + R, dimY, MUTED))
  o.push(dim(cx - R, dimY, cx + R, dimY, BLUE))
  o.push(txt(cx, dimY - 8, `PCD \u2300 : ${(s.radius * 2).toFixed(3)}`, BLUE, { size: 13, anchor: 'middle' }))
  o.push(txt(15, 415, `No. of Holes : ${s.holes}`, INK, { size: 13 }))

  // ---------- SIDE VIEW ----------
  o.push(txt(465, 28, 'SIDE VIEW (CYCLE)', INK, { size: 15 }))

  const axisX = 700, y0 = 190, top = 55, bottom = 380
  const k = Math.min((y0 - top) / s.safeZ, (bottom - y0) / Math.abs(s.depth))
  const ySafe = y0 - s.safeZ * k
  const yR = y0 - s.rlevel * k
  const yD = y0 + Math.abs(s.depth) * k

  o.push(`<rect x="${axisX - 90}" y="${y0}" width="180" height="${bottom - y0}" fill="#3a3733" stroke="#8a8782" stroke-width="1.5"/>`)
  o.push(`<rect x="${axisX - 14}" y="${px(y0)}" width="28" height="${px(yD - y0)}" fill="#1c1b19" stroke="#8a8782"/>`)
  o.push(line(axisX - 90, ySafe, axisX + 90, ySafe, MUTED, '3 3'))
  o.push(line(axisX - 90, yR, axisX + 90, yR, MUTED, '3 3'))

  const colSafe = axisX - 170, colR = axisX - 140, colD = axisX + 120

  o.push(line(colSafe, ySafe, axisX - 90, ySafe, '#5a5753'))
  o.push(line(colSafe, y0, axisX - 90, y0, '#5a5753'))
  o.push(dim(colSafe, ySafe, colSafe, y0, GRAY))
  o.push(txt(colSafe - 10, (ySafe + y0) / 2, `SAFE Z : ${s.safeZ.toFixed(3)}`, GRAY, { anchor: 'middle', rotate: true }))

  o.push(line(colR, yR, axisX - 90, yR, '#5a5753'))
  o.push(line(colR, y0, axisX - 90, y0, '#5a5753'))
  o.push(dim(colR, yR, colR, y0, BLUE))
  o.push(txt(colR - 10, (yR + y0) / 2, `R : ${s.rlevel.toFixed(3)}`, BLUE, { anchor: 'middle', rotate: true }))

  o.push(line(colD, y0, axisX + 90, y0, '#5a5753'))
  o.push(line(colD, yD, axisX + 90, yD, '#5a5753'))
  o.push(dim(colD, y0, colD, yD, ORANGE))
  o.push(txt(colD + 16, (y0 + yD) / 2, `DEPTH : ${s.depth.toFixed(3)}`, ORANGE, { anchor: 'middle', rotate: true }))

  o.push(txt(axisX - 88, y0 - 8, 'Z0 (SURFACE)', INK, { bold: false }))

  return `<svg viewBox="0 0 900 460" width="100%" xmlns="http://www.w3.org/2000/svg" role="img">${o.join('')}</svg>`
}