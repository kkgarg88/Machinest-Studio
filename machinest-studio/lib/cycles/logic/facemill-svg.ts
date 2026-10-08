import 'server-only'
import { INK, MUTED, GRAY, BLUE, ORANGE, GREEN, px, dim, line, txt, head } from './svg-utils'

function sideView(offsetX: number, depth: number, rlevel: number, safeZ: number, depthPerPass: number, numPasses: number): string {
  const o: string[] = []
  const axisX = offsetX + 110, y0 = 90, top = 20, bottom = 260
  const dAbs = Math.abs(depth)
  const k = Math.min((y0 - top) / safeZ, (bottom - y0) / dAbs)
  const ySafe = y0 - safeZ * k
  const yR = y0 - rlevel * k
  const yD = y0 + dAbs * k

  o.push(txt(offsetX, 16, 'SIDE VIEW', INK, { size: 14 }))
  o.push(`<rect x="${axisX - 70}" y="${y0}" width="140" height="${bottom - y0}" fill="#3a3733" stroke="#8a8782" stroke-width="1.2"/>`)
  o.push(`<rect x="${axisX - 70}" y="${y0}" width="140" height="${px(yD - y0)}" fill="#1c1b19" stroke="#8a8782" stroke-dasharray="3 2"/>`)

  for (let i = 1; i < numPasses; i++) {
    const yp = y0 + Math.min(i * depthPerPass, dAbs) * k
    o.push(line(axisX - 70, yp, axisX + 70, yp, GREEN, '3 2'))
  }
  o.push(line(axisX - 70, ySafe, axisX + 70, ySafe, MUTED, '3 3'))
  o.push(line(axisX - 70, yR, axisX + 70, yR, MUTED, '3 3'))

  const colSafe = axisX - 110, colR = axisX - 90, colD = axisX + 90
  o.push(dim(colSafe, ySafe, colSafe, y0, GRAY))
  o.push(txt(colSafe - 8, (ySafe + y0) / 2, `SAFE Z: ${safeZ.toFixed(2)}`, GRAY, { size: 10.5, anchor: 'middle', rotate: true }))
  o.push(dim(colR, yR, colR, y0, BLUE))
  o.push(txt(colR - 8, (yR + y0) / 2, `R: ${rlevel.toFixed(2)}`, BLUE, { size: 10.5, anchor: 'middle', rotate: true }))
  o.push(dim(colD, y0, colD, yD, ORANGE))
  o.push(txt(colD + 14, (y0 + yD) / 2, `DEPTH: ${depth.toFixed(2)}`, ORANGE, { size: 10.5, anchor: 'middle', rotate: true }))
  o.push(txt(axisX - 68, y0 - 6, 'Z0 (surface)', INK, { bold: false, size: 10.5 }))

  return o.join('')
}

export function buildFaceMillRectSvg(s: {
  stockX: number; stockY: number; originCorner: string; pattern: string
  depth: number; rlevel: number; safeZ: number; depthPerPass: number
  numRoughPasses: number; numRows: number; stepoverDist: number
}): string {
  const o: string[] = []
  o.push(line(450, 0, 450, 280, '#4a4744', '4 4'))

  const padL = 30, padT = 30, maxW = 340, maxH = 180
  const k = Math.min(maxW / s.stockX, maxH / s.stockY)
  const rw = s.stockX * k, rh = s.stockY * k
  const rx = padL, ry = padT

  o.push(txt(15, 16, 'TOP VIEW', INK, { size: 14 }))
  o.push(`<rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="none" stroke="${BLUE}" stroke-width="2"/>`)

  const cornerX = s.originCorner.includes('R') ? rx + rw : rx
  const cornerY = s.originCorner.includes('B') ? ry + rh : ry
  o.push(`<circle cx="${px(cornerX)}" cy="${px(cornerY)}" r="5" fill="${ORANGE}"/>`)
  o.push(txt(cornerX + 8, cornerY - 8, 'Origin', ORANGE, { size: 11 }))

  const rows = Math.min(s.numRows, 6)
  for (let i = 0; i < rows; i++) {
    const y = ry + (rh * i) / Math.max(rows - 1, 1)
    const dir = s.pattern === 'UNI' || i % 2 === 0 ? [rx + 4, rx + rw - 4] : [rx + rw - 4, rx + 4]
    o.push(line(dir[0], y, dir[1], y, GREEN))
  }

  o.push(dim(rx, ry + rh + 20, rx + rw, ry + rh + 20, BLUE))
  o.push(txt(rx + rw / 2, ry + rh + 34, `LENGTH (X): ${s.stockX.toFixed(2)}`, BLUE, { size: 11, anchor: 'middle' }))
  o.push(dim(rx - 16, ry, rx - 16, ry + rh, BLUE))
  o.push(txt(rx - 24, ry + rh / 2, `WIDTH (Y): ${s.stockY.toFixed(2)}`, BLUE, { size: 11, anchor: 'middle', rotate: true }))

  o.push(txt(15, 240, `Rows: ${s.numRows}  \u00b7  Stepover: ${s.stepoverDist.toFixed(2)} mm  \u00b7  Rough passes: ${s.numRoughPasses}`, '#ddd', { size: 11, bold: false }))

  o.push(sideView(470, s.depth, s.rlevel, s.safeZ, s.depthPerPass, s.numRoughPasses))

  return `<svg viewBox="0 0 900 280" width="100%" xmlns="http://www.w3.org/2000/svg" role="img">${o.join('')}</svg>`
}

export function buildFaceMillRoundSvg(s: {
  diameter: number; toolpathStyle: string
  depth: number; rlevel: number; safeZ: number; depthPerPass: number
  numRoughPasses: number; stepoverDist: number; numRings: number
}): string {
  const o: string[] = []
  o.push(line(450, 0, 450, 280, '#4a4744', '4 4'))

  const cx = 200, cy = 120, maxR = 90
  const k = maxR / (s.diameter / 2)

  o.push(txt(15, 16, 'TOP VIEW', INK, { size: 14 }))
  o.push(`<circle cx="${cx}" cy="${cy}" r="${(s.diameter / 2) * k}" fill="none" stroke="${BLUE}" stroke-width="2"/>`)
  o.push(`<circle cx="${cx}" cy="${cy}" r="4" fill="${ORANGE}"/>`)
  o.push(txt(cx + 8, cy - 8, 'Center', ORANGE, { size: 11 }))

  if (s.toolpathStyle === 'SPIRAL') {
    const rings = Math.min(s.numRings, 5)
    for (let i = 1; i <= rings; i++) {
      const r = ((s.diameter / 2) * i) / rings
      o.push(`<circle cx="${cx}" cy="${cy}" r="${(r * k).toFixed(1)}" fill="none" stroke="${GREEN}" stroke-width="1.3" stroke-dasharray="4 2"/>`)
    }
  } else {
    const rows = Math.min(s.numRings, 5)
    const R = (s.diameter / 2) * k
    for (let i = 0; i < rows; i++) {
      const y = cy - R + (2 * R * i) / Math.max(rows - 1, 1)
      const half = Math.sqrt(Math.max(R * R - (y - cy) * (y - cy), 0))
      o.push(line(cx - half, y, cx + half, y, GREEN))
    }
  }

  o.push(dim(cx - (s.diameter / 2) * k, cy + (s.diameter / 2) * k + 20, cx + (s.diameter / 2) * k, cy + (s.diameter / 2) * k + 20, BLUE))
  o.push(txt(cx, cy + (s.diameter / 2) * k + 34, `DIA \u2300: ${s.diameter.toFixed(2)}`, BLUE, { size: 11, anchor: 'middle' }))

  o.push(txt(15, 240, `Style: ${s.toolpathStyle === 'SPIRAL' ? 'Spiral' : 'Raster'}  \u00b7  Stepover: ${s.stepoverDist.toFixed(2)} mm  \u00b7  Rough passes: ${s.numRoughPasses}`, '#ddd', { size: 11, bold: false }))

  o.push(sideView(470, s.depth, s.rlevel, s.safeZ, s.depthPerPass, s.numRoughPasses))

  return `<svg viewBox="0 0 900 280" width="100%" xmlns="http://www.w3.org/2000/svg" role="img">${o.join('')}</svg>`
}