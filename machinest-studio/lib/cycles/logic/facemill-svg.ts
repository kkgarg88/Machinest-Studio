import 'server-only'

const INK = '#e8e6e3', MUTED = '#8a8782', GRAY = '#bdbab5'
const BLUE = '#4dabf7', ORANGE = '#F0801E', GREEN = '#51cf66', PURPLE = '#b197fc'

const px = (n: number) => n.toFixed(1)

function head(x: number, y: number, ang: number, color: string): string {
  const s = 7
  const ax = x - s * Math.cos(ang - Math.PI / 7)
  const ay = y - s * Math.sin(ang - Math.PI / 7)
  const bx = x - s * Math.cos(ang + Math.PI / 7)
  const by = y - s * Math.sin(ang + Math.PI / 7)
  return `<polygon points="${px(x)},${px(y)} ${px(ax)},${px(ay)} ${px(bx)},${px(by)}" fill="${color}"/>`
}

function dim(x1: number, y1: number, x2: number, y2: number, color: string): string {
  const a = Math.atan2(y2 - y1, x2 - x1)
  return (
    `<line x1="${px(x1)}" y1="${px(y1)}" x2="${px(x2)}" y2="${px(y2)}" stroke="${color}" stroke-width="1.5"/>` +
    head(x1, y1, a + Math.PI, color) + head(x2, y2, a, color)
  )
}

function line(x1: number, y1: number, x2: number, y2: number, color: string, dash = '', w = 1): string {
  return `<line x1="${px(x1)}" y1="${px(y1)}" x2="${px(x2)}" y2="${px(y2)}" stroke="${color}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
}

function txt(x: number, y: number, s: string, color: string, o: { size?: number; bold?: boolean; anchor?: string; rotate?: boolean } = {}): string {
  const { size = 12, bold = true, anchor = 'start', rotate = false } = o
  const tr = rotate ? ` transform="rotate(-90 ${px(x)} ${px(y)})"` : ''
  return `<text x="${px(x)}" y="${px(y)}" fill="${color}" font-size="${size}" font-weight="${bold ? 700 : 400}" text-anchor="${anchor}" font-family="Arial, sans-serif"${tr}>${s}</text>`
}

function legendDot(x: number, y: number, color: string, label: string): string {
  return `<circle cx="${px(x)}" cy="${px(y)}" r="4" fill="${color}"/>` + txt(x + 10, y + 4, label, MUTED, { size: 11, bold: false })
}

function sideView(
  ox: number, oy: number, w: number, h: number,
  depth: number, rlevel: number, safeZ: number, depthPerPass: number,
  numRoughPasses: number, finishCut: boolean, roughDepthTarget: number, finishMargin: number
): string {
  const o: string[] = []
  o.push(txt(ox, oy, 'SIDE VIEW', INK, { size: 15 }))
  o.push(txt(ox, oy + 18, finishCut ? 'Rough passes + separate finish pass' : 'Rough passes only', MUTED, { size: 11.5, bold: false }))

  const axisX = ox + w / 2
  const top = oy + 40, y0 = oy + 110, bottom = oy + h - 10
  const dAbs = Math.abs(depth)
  const k = Math.min((y0 - top) / safeZ, (bottom - y0) / dAbs)
  const ySafe = y0 - safeZ * k
  const yR = y0 - rlevel * k
  const yDepth = y0 + dAbs * k
  const yRoughStop = y0 + roughDepthTarget * k
  const blockW = Math.min(170, w - 100)

  o.push(`<rect x="${px(axisX - blockW / 2)}" y="${px(y0)}" width="${px(blockW)}" height="${px(bottom - y0)}" fill="#3a3733" stroke="#8a8782" stroke-width="1.5"/>`)
  o.push(`<rect x="${px(axisX - blockW / 2)}" y="${px(y0)}" width="${px(blockW)}" height="${px(yDepth - y0)}" fill="#1c1b19" stroke="#8a8782" stroke-dasharray="3 2"/>`)

  for (let i = 1; i < numRoughPasses; i++) {
    const passMM = Math.min(i * depthPerPass, roughDepthTarget)
    const yPass = y0 + passMM * k
    o.push(line(axisX - blockW / 2, yPass, axisX + blockW / 2, yPass, GREEN, '3 2'))
  }
  if (finishCut) {
    o.push(line(axisX - blockW / 2, yRoughStop, axisX + blockW / 2, yRoughStop, PURPLE, '5 3', 1.5))
  }
  o.push(line(axisX - blockW / 2, ySafe, axisX + blockW / 2, ySafe, '#555', '3 3'))
  o.push(line(axisX - blockW / 2, yR, axisX + blockW / 2, yR, '#555', '3 3'))
  o.push(txt(axisX - blockW / 2, y0 - 8, 'Z0 (surface)', MUTED, { size: 11, bold: false }))
  if (finishCut) {
    o.push(txt(axisX - blockW / 2, yRoughStop - 6, 'ROUGH STOPS (FINISH MARGIN)', PURPLE, { size: 10, bold: false }))
  }

  const colSafe = axisX - blockW / 2 - 60, colR = axisX - blockW / 2 - 32
  const colDepth = axisX + blockW / 2 + 40, colDPP = axisX + blockW / 2 + 65

  o.push(dim(colSafe, ySafe, colSafe, y0, GRAY))
  o.push(txt(colSafe - 8, (ySafe + y0) / 2, `SAFE Z: ${safeZ.toFixed(2)}`, GRAY, { size: 10.5, anchor: 'middle', rotate: true }))
  o.push(dim(colR, yR, colR, y0, BLUE))
  o.push(txt(colR - 8, (yR + y0) / 2, `R: ${rlevel.toFixed(2)}`, BLUE, { size: 10.5, anchor: 'middle', rotate: true }))
  o.push(dim(colDepth, y0, colDepth, yDepth, ORANGE))
  o.push(txt(colDepth + 14, (y0 + yDepth) / 2, `DEPTH: ${depth.toFixed(2)}`, ORANGE, { size: 10.5, anchor: 'middle', rotate: true }))

  const firstPassMM = Math.min(depthPerPass, roughDepthTarget)
  const yFirstPass = y0 + firstPassMM * k
  o.push(dim(colDPP, y0, colDPP, yFirstPass, GREEN))
  o.push(txt(colDPP + 14, (y0 + yFirstPass) / 2, `PASS: ${depthPerPass.toFixed(2)}`, GREEN, { size: 10.5, anchor: 'middle', rotate: true }))

  o.push(txt(ox, oy + h + 4, `Rough passes: ${numRoughPasses}`, MUTED, { size: 11, bold: false }))
  if (finishCut) o.push(txt(ox + 150, oy + h + 4, `Finish margin: ${finishMargin.toFixed(3)} mm`, PURPLE, { size: 11, bold: false }))

  return o.join('')
}

export function buildFaceMillRectSvg(s: {
  stockX: number; stockY: number; originCorner: string; pattern: string
  depth: number; rlevel: number; safeZ: number; depthPerPass: number
  numRoughPasses: number; numRows: number; stepoverDist: number; overtravelMM: number
  finishCut: boolean; finishMargin: number; roughDepthTarget: number
}): string {
  const o: string[] = []
  o.push(line(445, 0, 445, 460, '#4a4744', '4 4'))

  o.push(txt(15, 28, 'TOP VIEW', INK, { size: 15 }))

  const padL = 70, padT = 60, maxW = 290, maxH = 180
  const k = Math.min(maxW / s.stockX, maxH / s.stockY)
  const rw = s.stockX * k, rh = s.stockY * k
  const rx = padL, ry = padT

  o.push(`<rect x="${px(rx)}" y="${px(ry)}" width="${px(rw)}" height="${px(rh)}" fill="none" stroke="${BLUE}" stroke-width="2.5"/>`)

  const cornerX = s.originCorner.includes('R') ? rx + rw : rx
  const cornerY = s.originCorner.includes('B') ? ry + rh : ry
  o.push(`<circle cx="${px(cornerX)}" cy="${px(cornerY)}" r="6" fill="${ORANGE}" stroke="#111" stroke-width="1"/>`)
  o.push(txt(cornerX + (s.originCorner.includes('R') ? -10 : 10), cornerY - 10, 'ORIGIN (0,0)', ORANGE, { size: 11, anchor: s.originCorner.includes('R') ? 'end' : 'start' }))

  const overtravelPx = s.overtravelMM * k
  const signX = s.originCorner.includes('R') ? -1 : 1
  const otX1 = cornerX, otX2 = cornerX + signX * -overtravelPx
  const otRowY = ry - 16
  o.push(dim(otX1, otRowY, otX2, otRowY, ORANGE))
  o.push(txt((otX1 + otX2) / 2, otRowY - 8, `OVERTRAVEL: ${s.overtravelMM.toFixed(2)} mm`, ORANGE, { size: 10, anchor: 'middle' }))

  const rowsToShow = Math.min(s.numRows, 7)
  for (let i = 0; i < rowsToShow; i++) {
    const y = ry + (rh * i) / Math.max(rowsToShow - 1, 1)
    const ltr = s.pattern === 'UNI' || i % 2 === 0
    o.push(line(rx + 4, y, rx + rw - 4, y, BLUE, '', 1.3))
    o.push(head(ltr ? rx + rw - 4 : rx + 4, y, ltr ? 0 : Math.PI, BLUE))
  }

  if (rowsToShow > 1) {
    const soX = rx + rw + 20
    const soY1 = ry, soY2 = ry + (rh / Math.max(rowsToShow - 1, 1))
    o.push(dim(soX, soY1, soX, soY2, GREEN))
    o.push(txt(soX + 10, (soY1 + soY2) / 2, `STEPOVER: ${s.stepoverDist.toFixed(2)} mm`, GREEN, { size: 10.5, anchor: 'middle', rotate: true }))
  }

  const dimYBottom = ry + rh + 26
  o.push(line(rx, ry + rh, rx, dimYBottom, '#555', '', 0.8))
  o.push(line(rx + rw, ry + rh, rx + rw, dimYBottom, '#555', '', 0.8))
  o.push(dim(rx, dimYBottom, rx + rw, dimYBottom, BLUE))
  o.push(txt(rx + rw / 2, dimYBottom + 16, `LENGTH (X): ${s.stockX.toFixed(2)}`, BLUE, { size: 12, anchor: 'middle' }))

  const dimXLeft = rx - 22
  o.push(dim(dimXLeft, ry, dimXLeft, ry + rh, BLUE))
  o.push(txt(dimXLeft - 12, ry + rh / 2, `WIDTH (Y): ${s.stockY.toFixed(2)}`, BLUE, { size: 12, anchor: 'middle', rotate: true }))

  o.push(txt(15, 335, `Passes (rows): ${s.numRows}`, MUTED, { size: 11, bold: false }))
  o.push(txt(15, 353, `Stepover: ${s.stepoverDist.toFixed(2)} mm`, GREEN, { size: 11, bold: false }))

  legendDot(15, 400, BLUE, 'Toolpath')
  o.push(legendDot(15, 400, BLUE, 'Toolpath'))
  o.push(legendDot(110, 400, ORANGE, 'Overtravel'))
  o.push(legendDot(230, 400, ORANGE, 'Origin'))

  o.push(sideView(470, 20, 400, 340, s.depth, s.rlevel, s.safeZ, s.depthPerPass, s.numRoughPasses, s.finishCut, s.roughDepthTarget, s.finishMargin))

  return `<svg viewBox="0 0 900 420" width="100%" xmlns="http://www.w3.org/2000/svg" role="img">${o.join('')}</svg>`
}

export function buildFaceMillRoundSvg(s: {
  diameter: number; toolpathStyle: string
  depth: number; rlevel: number; safeZ: number; depthPerPass: number
  numRoughPasses: number; stepoverDist: number; numRings: number; overtravelMM: number
  finishCut: boolean; finishMargin: number; roughDepthTarget: number
}): string {
  const o: string[] = []
  o.push(line(445, 0, 445, 460, '#4a4744', '4 4'))
  o.push(txt(15, 28, 'TOP VIEW', INK, { size: 15 }))

  const cx = 215, cy = 160, partR = 110
  const fitScale = partR / (s.diameter / 2 + s.overtravelMM)
  const partRpx = (s.diameter / 2) * fitScale
  const effRpx = (s.diameter / 2 + s.overtravelMM) * fitScale

  o.push(`<circle cx="${px(cx)}" cy="${px(cy)}" r="${px(partRpx)}" fill="none" stroke="${BLUE}" stroke-width="2.5"/>`)
  o.push(`<circle cx="${px(cx)}" cy="${px(cy)}" r="6" fill="${ORANGE}" stroke="#111" stroke-width="1"/>`)
  o.push(txt(cx + 12, cy - 14, 'ORIGIN (0,0)', ORANGE, { size: 11 }))

  o.push(dim(cx + partRpx, cy - 26, cx + effRpx, cy - 26, ORANGE))
  o.push(txt(cx + partRpx, cy - 34, `OVERTRAVEL: ${s.overtravelMM.toFixed(2)} mm`, ORANGE, { size: 10 }))

  if (s.toolpathStyle === 'SPIRAL') {
    const rings = Math.min(s.numRings, 6)
    for (let i = 1; i <= rings; i++) {
      const r = (effRpx * i) / rings
      o.push(`<circle cx="${px(cx)}" cy="${px(cy)}" r="${px(r)}" fill="none" stroke="${BLUE}" stroke-width="1.3"/>`)
    }
    const r1 = s.stepoverDist * fitScale
    const r2 = Math.min(2 * s.stepoverDist, s.diameter / 2 + s.overtravelMM) * fitScale
    o.push(dim(cx, cy + r1, cx, cy + r2, GREEN))
    o.push(txt(cx + 12, cy + (r1 + r2) / 2 + 4, `STEPOVER: ${s.stepoverDist.toFixed(2)} mm`, GREEN, { size: 10.5 }))
  } else {
    const rows = Math.min(s.numRings, 6)
    for (let i = 0; i < rows; i++) {
      const yOff = -effRpx + (2 * effRpx * i) / Math.max(rows - 1, 1)
      const half = Math.sqrt(Math.max(effRpx * effRpx - yOff * yOff, 0))
      const ltr = i % 2 === 0
      o.push(line(cx - half + 3, cy + yOff, cx + half - 3, cy + yOff, BLUE, '', 1.3))
      o.push(head(ltr ? cx + half - 3 : cx - half + 3, cy + yOff, ltr ? 0 : Math.PI, BLUE))
    }
    if (rows > 1) {
      const soX = cx + effRpx + 20
      const y0off = -effRpx, y1off = -effRpx + (2 * effRpx) / Math.max(rows - 1, 1)
      o.push(dim(soX, cy + y0off, soX, cy + y1off, GREEN))
      o.push(txt(soX + 10, cy + (y0off + y1off) / 2, `STEPOVER: ${s.stepoverDist.toFixed(2)} mm`, GREEN, { size: 10.5, anchor: 'middle', rotate: true }))
    }
  }

  const dimY = cy + partRpx + 32
  o.push(dim(cx - partRpx, dimY, cx + partRpx, dimY, BLUE))
  o.push(txt(cx, dimY + 16, `DIA \u2300 : ${s.diameter.toFixed(2)}`, BLUE, { size: 12, anchor: 'middle' }))

  o.push(txt(15, 335, `Style: ${s.toolpathStyle === 'SPIRAL' ? 'Spiral' : 'Linear Raster'}`, MUTED, { size: 11, bold: false }))
  o.push(legendDot(15, 400, BLUE, 'Toolpath'))
  o.push(legendDot(110, 400, ORANGE, 'Overtravel'))
  o.push(legendDot(230, 400, ORANGE, 'Origin'))

  o.push(sideView(470, 20, 400, 340, s.depth, s.rlevel, s.safeZ, s.depthPerPass, s.numRoughPasses, s.finishCut, s.roughDepthTarget, s.finishMargin))

  return `<svg viewBox="0 0 900 420" width="100%" xmlns="http://www.w3.org/2000/svg" role="img">${o.join('')}</svg>`
}