import 'server-only'
import { INK, MUTED, GRAY, BLUE, ORANGE, GREEN, px, head, dim, line, txt } from './svg-utils'

const PURPLE = '#b197fc'
const PASS = '#51cf66'

type S = {
  xr: number
  yr: number
  step: number
  n: number
  chordErr: number
  cutterDia: number
  rhoMin: number
  depth: number
  doc: number
  nPass: number
  safeZ: number
  rlevel: number
}

export function buildEllipseSvg(s: S): string {
  const o: string[] = []
  o.push(line(445, 0, 445, 460, '#4a4744', '4 4'))

  /* ---------- TOP VIEW ---------- */
  const cx = 222, cy = 230
  const k = Math.min(150 / s.xr, 125 / s.yr)
  const rx = s.xr * k
  const ry = s.yr * k

  o.push(txt(15, 28, 'TOP VIEW', INK, { size: 15 }))
  o.push(txt(15, 50, `Step : ${s.step}\u00B0  (${s.n} segments)`, BLUE, { size: 13 }))
  o.push(txt(15, 68, `Chord error : ~${s.chordErr.toFixed(4)} mm`, MUTED, { size: 12, bold: false }))

  o.push(line(cx - rx - 12, cy, cx + rx + 12, cy, MUTED, '3 3'))
  o.push(line(cx, cy - ry - 12, cx, cy + ry + 12, MUTED, '3 3'))
  o.push(`<ellipse cx="${cx}" cy="${cy}" rx="${px(rx)}" ry="${px(ry)}" fill="none" stroke="${BLUE}" stroke-width="2.5"/>`)
  o.push(`<circle cx="${cx}" cy="${cy}" r="4" fill="#ff5252"/>`)

  // tool at the start point (inside the wall)
  const tr = (s.cutterDia / 2) * k
  o.push(`<circle cx="${px(cx + rx - tr)}" cy="${cy}" r="${px(tr)}" fill="none" stroke="${ORANGE}" stroke-width="1.5" stroke-dasharray="4 3"/>`)

  // start point
  o.push(`<circle cx="${px(cx + rx)}" cy="${cy}" r="6" fill="${GREEN}" stroke="#111"/>`)
  o.push(txt(cx + rx, cy + 24, 'START (0\u00B0)', GREEN, { size: 12, anchor: 'end' }))

  // direction arrow (CCW)
  const t = Math.PI / 3
  const ax = cx + rx * Math.cos(t)
  const ay = cy - ry * Math.sin(t)
  o.push(head(ax, ay, Math.atan2(-ry * Math.cos(t), -rx * Math.sin(t)), ORANGE))
  o.push(txt(ax + 10, ay - 8, 'CCW - climb (G41)', ORANGE, { size: 12 }))

  // X radius dimension (below)
  const dimY = cy + ry + 34
  o.push(line(cx, cy + ry, cx, dimY, MUTED))
  o.push(line(cx + rx, cy, cx + rx, dimY, MUTED))
  o.push(dim(cx, dimY, cx + rx, dimY, BLUE))
  o.push(txt(cx + rx / 2, dimY - 8, `X RADIUS : ${s.xr.toFixed(3)}`, BLUE, { size: 12, anchor: 'middle' }))

  // Y radius dimension (left)
  const dimX = cx - rx - 34
  o.push(line(cx - rx, cy, dimX, cy, MUTED))
  o.push(line(cx, cy - ry, dimX, cy - ry, MUTED))
  o.push(dim(dimX, cy, dimX, cy - ry, BLUE))
  o.push(txt(dimX - 8, cy - ry / 2, `Y RADIUS : ${s.yr.toFixed(3)}`, BLUE, { size: 12, anchor: 'middle', rotate: true }))

  o.push(txt(15, 415, `Tool \u2300 : ${s.cutterDia.toFixed(3)}`, INK, { size: 13 }))
  o.push(txt(15, 435, `Min curve radius : ${s.rhoMin.toFixed(3)}`, MUTED, { size: 12, bold: false }))

  /* ---------- SIDE VIEW (section) ---------- */
  o.push(txt(465, 28, 'SIDE VIEW (SECTION)', INK, { size: 15 }))
  o.push(txt(465, 45, `${s.nPass} pass(es) x ${s.doc.toFixed(3)} deep`, MUTED, { size: 12, bold: false }))

  const axisX = 700, y0 = 190, top = 68, bottom = 380
  const dAbs = Math.abs(s.depth)
  const k2 = Math.min((y0 - top) / s.safeZ, (bottom - y0) / dAbs)
  const ySafe = y0 - s.safeZ * k2
  const yR = y0 - s.rlevel * k2
  const yD = y0 + dAbs * k2

  o.push(`<rect x="${axisX - 90}" y="${y0}" width="180" height="${bottom - y0}" fill="#3a3733" stroke="#8a8782" stroke-width="1.5"/>`)
  o.push(`<rect x="${axisX - 45}" y="${y0}" width="90" height="${px(yD - y0)}" fill="#1c1b19" stroke="#8a8782"/>`)

  if (s.nPass <= 40) {
    for (let i = 1; i < s.nPass; i++) {
      const yp = y0 + i * s.doc * k2
      o.push(line(axisX - 45, yp, axisX + 45, yp, PASS, '3 2'))
    }
  }

  o.push(line(axisX - 90, ySafe, axisX + 90, ySafe, MUTED, '3 3'))
  o.push(line(axisX - 90, yR, axisX + 90, yR, MUTED, '3 3'))

  const colSafe = axisX - 170, colR = axisX - 140, colD = axisX + 120, colQ = axisX + 150
  const yQ = y0 + Math.min(s.doc, dAbs) * k2
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
  o.push(txt(colQ + 14, (y0 + yQ) / 2, `DOC : ${s.doc.toFixed(3)}`, PURPLE, { anchor: 'middle', rotate: true }))

  o.push(txt(axisX - 88, y0 - 8, 'Z0 (SURFACE)', INK, { bold: false }))
  o.push(txt(axisX - 88, bottom + 22, `No. of Passes : ${s.nPass}`, PASS, { size: 12 }))

  return `<svg viewBox="0 0 900 460" width="100%" xmlns="http://www.w3.org/2000/svg" role="img">${o.join('')}</svg>`
}