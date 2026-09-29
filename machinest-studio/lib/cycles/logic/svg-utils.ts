import 'server-only'

export const INK = '#e8e6e3'
export const MUTED = '#8a8782'
export const GRAY = '#bdbab5'
export const BLUE = '#4dabf7'
export const ORANGE = '#F0801E'
export const GREEN = '#2fbf71'

export const px = (n: number) => n.toFixed(1)

export function head(x: number, y: number, ang: number, color: string) {
  const s = 7
  const ax = x - s * Math.cos(ang - Math.PI / 7)
  const ay = y - s * Math.sin(ang - Math.PI / 7)
  const bx = x - s * Math.cos(ang + Math.PI / 7)
  const by = y - s * Math.sin(ang + Math.PI / 7)
  return `<polygon points="${px(x)},${px(y)} ${px(ax)},${px(ay)} ${px(bx)},${px(by)}" fill="${color}"/>`
}

export function dim(x1: number, y1: number, x2: number, y2: number, color: string) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  return (
    `<line x1="${px(x1)}" y1="${px(y1)}" x2="${px(x2)}" y2="${px(y2)}" stroke="${color}" stroke-width="1.5"/>` +
    head(x1, y1, a + Math.PI, color) +
    head(x2, y2, a, color)
  )
}

export function line(x1: number, y1: number, x2: number, y2: number, color: string, dash = '') {
  return `<line x1="${px(x1)}" y1="${px(y1)}" x2="${px(x2)}" y2="${px(y2)}" stroke="${color}" stroke-width="1"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
}

export function txt(
  x: number, y: number, s: string, color: string,
  o: { size?: number; bold?: boolean; anchor?: string; rotate?: boolean } = {}
) {
  const { size = 12, bold = true, anchor = 'start', rotate = false } = o
  const tr = rotate ? ` transform="rotate(-90 ${px(x)} ${px(y)})"` : ''
  return `<text x="${px(x)}" y="${px(y)}" fill="${color}" font-size="${size}" font-weight="${bold ? 700 : 400}" text-anchor="${anchor}" font-family="Arial, sans-serif"${tr}>${s}</text>`
}

// PCD top view: left half of the 900x460 diagram
export function topView(s: { radius: number; holes: number; startAngle: number }): string {
  const o: string[] = []
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

  return o.join('')
}