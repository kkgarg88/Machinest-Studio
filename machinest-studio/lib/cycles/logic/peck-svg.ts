import 'server-only'
import { INK, MUTED, GRAY, BLUE, ORANGE, px, dim, line, txt, topView } from './svg-utils'

const PURPLE = '#b197fc'
const PECK = '#51cf66'

type S = {
  cycleType: string
  radius: number
  holes: number
  startAngle: number
  safeZ: number
  rlevel: number
  depth: number
  peckDepth: number
  numPecks: number
}

/* ================= RESULT DIAGRAM (after Generate) ================= */

export function buildPeckSvg(s: S): string {
  const o: string[] = []

  o.push(line(445, 0, 445, 460, '#4a4744', '4 4'))
  o.push(topView(s))

  o.push(txt(465, 28, `SIDE VIEW (${s.cycleType} CYCLE)`, INK, { size: 15 }))
  o.push(
    txt(
      465, 45,
      s.cycleType === 'G73' ? 'Chip-break: small retract each peck' : 'Full retract to R after each peck',
      MUTED, { size: 12, bold: false }
    )
  )

  const axisX = 700, y0 = 190, top = 68, bottom = 380
  const dAbs = Math.abs(s.depth)
  const k = Math.min((y0 - top) / s.safeZ, (bottom - y0) / dAbs)
  const ySafe = y0 - s.safeZ * k
  const yR = y0 - s.rlevel * k
  const yD = y0 + dAbs * k

  o.push(`<rect x="${axisX - 90}" y="${y0}" width="180" height="${bottom - y0}" fill="#3a3733" stroke="#8a8782" stroke-width="1.5"/>`)
  o.push(`<rect x="${axisX - 14}" y="${y0}" width="28" height="${px(yD - y0)}" fill="#1c1b19" stroke="#8a8782"/>`)

  if (s.numPecks <= 60) {
    for (let i = 1; i < s.numPecks; i++) {
      const yp = y0 + Math.min(i * s.peckDepth, dAbs) * k
      o.push(line(axisX - 14, yp, axisX + 14, yp, PECK, '3 2'))
    }
  }

  o.push(line(axisX - 90, ySafe, axisX + 90, ySafe, MUTED, '3 3'))
  o.push(line(axisX - 90, yR, axisX + 90, yR, MUTED, '3 3'))

  const colSafe = axisX - 170, colR = axisX - 140, colD = axisX + 120, colQ = axisX + 150
  const yQ = y0 + Math.min(s.peckDepth, dAbs) * k
  const tick = '#5a5753'

  o.push(line(colSafe, ySafe, axisX - 90, ySafe, tick))
  o.push(line(colSafe, y0, axisX - 90, y0, tick))
  o.push(dim(colSafe, ySafe, colSafe, y0, GRAY))
  o.push(txt(colSafe - 10, (ySafe + y0) / 2, `SAFE Z : ${s.safeZ.toFixed(3)}`, GRAY, { anchor: 'middle', rotate: true }))

  o.push(line(colR, yR, axisX - 90, yR, tick))
  o.push(line(colR, y0, axisX - 90, y0, tick))
  o.push(dim(colR, yR, colR, y0, BLUE))
  o.push(txt(colR - 10, (yR + y0) / 2, `R : ${s.rlevel.toFixed(3)}`, BLUE, { anchor: 'middle', rotate: true }))

  o.push(line(colD, y0, axisX + 90, y0, tick))
  o.push(line(colD, yD, axisX + 90, yD, tick))
  o.push(dim(colD, y0, colD, yD, ORANGE))
  o.push(txt(colD + 16, (y0 + yD) / 2, `DEPTH : ${s.depth.toFixed(3)}`, ORANGE, { anchor: 'middle', rotate: true }))

  o.push(line(colQ, y0, axisX + 90, y0, tick))
  o.push(line(colQ, yQ, axisX + 90, yQ, tick))
  o.push(dim(colQ, y0, colQ, yQ, PURPLE))
  o.push(txt(colQ + 14, (y0 + yQ) / 2, `Q : ${s.peckDepth.toFixed(3)}`, PURPLE, { anchor: 'middle', rotate: true }))

  o.push(txt(axisX - 88, y0 - 8, 'Z0 (SURFACE)', INK, { bold: false }))
  o.push(txt(axisX - 88, bottom + 22, `No. of Pecks : ${s.numPecks}`, PECK, { size: 12 }))

  return `<svg viewBox="0 0 900 460" width="100%" xmlns="http://www.w3.org/2000/svg" role="img">${o.join('')}</svg>`
}

/* ================= G83 vs G73 ANIMATION (shown on page load) =================
   Fixed example numbers. Pure SVG (SMIL) animation, generated on the server. */

type Mode = 'rapid' | 'feed'
type Stop = { t: number; p: number; mode: Mode }

const CMP = { depth: 12, q: 4, r: 2, safe: 6, pecks: 3, loopSec: 5.5 }

function buildSeq(type: 'G83' | 'G73'): { p: number; mode: Mode }[] {
  const { depth, q, r, safe, pecks } = CMP
  const smallRetract = Math.max(0.3, Math.min(1.5, q * 0.25))

  const seq: { p: number; mode: Mode }[] = [
    { p: -safe, mode: 'rapid' },
    { p: -r, mode: 'rapid' },
  ]
  let prev = 0

  for (let i = 1; i <= pecks; i++) {
    const target = Math.min(i * q, depth)
    seq.push({ p: prev, mode: 'rapid' })
    seq.push({ p: target, mode: 'feed' })

    if (type === 'G83') {
      seq.push({ p: -r, mode: 'rapid' })
      prev = target
    } else if (i < pecks) {
      const rp = target - smallRetract
      seq.push({ p: rp, mode: 'rapid' })
      prev = rp
    } else {
      seq.push({ p: -r, mode: 'rapid' })
      prev = target
    }
  }
  seq.push({ p: -safe, mode: 'rapid' })
  return seq
}

function buildStops(seq: { p: number; mode: Mode }[]): Stop[] {
  const durs: number[] = []
  for (let i = 0; i < seq.length - 1; i++) {
    const delta = Math.abs(seq[i + 1].p - seq[i].p)
    const speed = seq[i + 1].mode === 'feed' ? 8 : 40
    durs.push(Math.max(delta / speed, 0.06))
  }
  const total = durs.reduce((a, b) => a + b, 0) || 1

  const stops: Stop[] = [{ t: 0, p: seq[0].p, mode: seq[0].mode }]
  let acc = 0
  for (let i = 0; i < durs.length; i++) {
    acc += durs[i]
    stops.push({ t: acc / total, p: seq[i + 1].p, mode: seq[i + 1].mode })
  }
  return stops
}

function panel(offsetX: number, title: string, subtitle: string, type: 'G83' | 'G73', accent: string): string {
  const o: string[] = []
  const axisX = offsetX + 225
  const y0 = 100
  const k = Math.min((y0 - 40) / CMP.safe, (160 - y0) / CMP.depth)
  const yR = y0 - CMP.r * k
  const yD = y0 + CMP.depth * k

  o.push(txt(offsetX + 15, 20, title, INK, { size: 14 }))
  o.push(txt(offsetX + 15, 36, subtitle, MUTED, { size: 11.5, bold: false }))

  o.push(`<rect x="${axisX - 65}" y="${y0}" width="130" height="${160 - y0}" fill="#3a3733" stroke="#8a8782" stroke-width="1.2"/>`)
  o.push(`<rect x="${axisX - 9}" y="${y0}" width="18" height="${px(yD - y0)}" fill="#1c1b19" stroke="#8a8782"/>`)

  for (let i = 1; i < CMP.pecks; i++) {
    const yp = y0 + Math.min(i * CMP.q, CMP.depth) * k
    o.push(line(axisX - 9, yp, axisX + 9, yp, '#5a5753', '2 2'))
  }
  o.push(line(axisX - 65, yR, axisX + 65, yR, MUTED, '4 3'))
  o.push(txt(axisX + 70, yR + 3, 'R', MUTED, { size: 10.5, bold: false }))

  const stops = buildStops(buildSeq(type))
  const last = stops.length - 1
  const keyTimes = stops.map((s, i) => (i === last ? '1' : s.t.toFixed(5))).join(';')
  const values = stops.map(s => `0 ${(y0 + s.p * k).toFixed(2)}`).join(';')
  const fills = stops
    .map((_, i) => (stops[Math.min(i + 1, last)].mode === 'feed' ? accent : '#9a9791'))
    .join(';')
  const dur = `${CMP.loopSec}s`

  o.push(
    `<g transform="translate(${axisX},0)"><g transform="translate(0,${(y0 + stops[0].p * k).toFixed(2)})">` +
      `<animateTransform attributeName="transform" type="translate" calcMode="linear" dur="${dur}" repeatCount="indefinite" keyTimes="${keyTimes}" values="${values}"/>` +
      `<rect x="-5" y="-26" width="10" height="26" fill="#bdbab5"/>` +
      `<polygon points="-5,0 5,0 0,9" fill="#9a9791">` +
      `<animate attributeName="fill" calcMode="discrete" dur="${dur}" repeatCount="indefinite" keyTimes="${keyTimes}" values="${fills}"/>` +
      `</polygon></g></g>`
  )

  return o.join('')
}

export function buildPeckIntroSvg(): string {
  const o: string[] = []
  o.push(line(450, 0, 450, 190, '#4a4744', '4 4'))
  o.push(panel(0, 'G83 - DEEP HOLE PECK', 'Fully retracts to R after every peck', 'G83', ORANGE))
  o.push(panel(450, 'G73 - HIGH SPEED PECK', 'Small chip-break retract, dives on', 'G73', BLUE))
  o.push(txt(885, 182, 'Illustration only. Colored = cutting feed, Gray = rapid', MUTED, { size: 11, bold: false, anchor: 'end' }))
  return `<svg viewBox="0 0 900 190" width="100%" xmlns="http://www.w3.org/2000/svg" role="img">${o.join('')}</svg>`
}