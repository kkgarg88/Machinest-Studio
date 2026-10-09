import 'server-only'

const INK = '#e8e6e3', MUTED = '#9a9691'
const BLUE = '#4dabf7', ORANGE = '#F0801E', GREEN = '#51cf66'
const TOOLPATH = '#ffd43b'

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

function txt(x: number, y: number, s: string, color: string, o: { size?: number; bold?: boolean; anchor?: string } = {}): string {
  const { size = 14, bold = true, anchor = 'start' } = o
  return `<text x="${px(x)}" y="${px(y)}" fill="${color}" font-size="${size}" font-weight="${bold ? 700 : 400}" text-anchor="${anchor}" font-family="Arial, sans-serif">${s}</text>`
}

function legendDot(x: number, y: number, color: string, label: string): string {
  return `<circle cx="${px(x)}" cy="${px(y)}" r="5" fill="${color}"/>` + txt(x + 12, y + 5, label, MUTED, { size: 13, bold: false })
}

function depthSummary(
  depth: number, rlevel: number, safeZ: number, depthPerPass: number,
  numRoughPasses: number, finishCut: boolean, finishMargin: number
): string {
  const parts = [
    `Depth: ${depth.toFixed(2)} mm`,
    `${numRoughPasses} rough pass${numRoughPasses === 1 ? '' : 'es'} @ ${depthPerPass.toFixed(2)} mm`,
    finishCut ? `+ finish (${finishMargin.toFixed(3)} mm margin)` : '(no finish pass)',
    `Retract R: ${rlevel.toFixed(2)}`,
    `Safe Z: ${safeZ.toFixed(2)}`,
  ]
  return parts.join('   \u00b7   ')
}

export function buildFaceMillRectSvg(s: {
  stockX: number; stockY: number; originCorner: string; pattern: string
  depth: number; rlevel: number; safeZ: number; depthPerPass: number
  numRoughPasses: number; numRows: number; stepoverDist: number; overtravelMM: number
  finishCut: boolean; finishMargin: number
}): string {
  const o: string[] = []
  o.push(txt(30, 36, 'TOP VIEW', INK, { size: 18 }))
  o.push(txt(30, 56, '(Back = away from operator, Front = toward operator)', MUTED, { size: 12, bold: false }))

  const areaX = 150, areaY = 80, areaW = 560, areaH = 220
  const k = Math.min(areaW / s.stockX, areaH / s.stockY)
  const rw = s.stockX * k, rh = s.stockY * k
  const rx = areaX + (areaW - rw) / 2
  const ry = areaY + (areaH - rh) / 2

  o.push(`<rect x="${px(rx)}" y="${px(ry)}" width="${px(rw)}" height="${px(rh)}" fill="none" stroke="${BLUE}" stroke-width="3"/>`)

  const cornerX = s.originCorner.includes('R') ? rx + rw : rx
  const cornerY = s.originCorner.includes('F') ? ry + rh : ry
  o.push(`<circle cx="${px(cornerX)}" cy="${px(cornerY)}" r="7" fill="${ORANGE}" stroke="#111" stroke-width="1.5"/>`)
  const labelRight = !s.originCorner.includes('R')
  const labelAbove = s.originCorner.includes('F')
  o.push(txt(
    cornerX + (labelRight ? 12 : -12), cornerY + (labelAbove ? -14 : 24),
    'ORIGIN (0,0)', ORANGE, { size: 13, anchor: labelRight ? 'start' : 'end' }
  ))

  const otY = ry - 36
  const otX1 = rx, otX2 = rx - s.overtravelMM * k
  o.push(dim(otX1, otY, otX2, otY, ORANGE))
  o.push(txt((otX1 + otX2) / 2, otY - 10, `OVERTRAVEL: ${s.overtravelMM.toFixed(2)} mm`, ORANGE, { size: 12, anchor: 'middle' }))

  const rowsToShow = Math.min(s.numRows, 5)
  for (let i = 0; i < rowsToShow; i++) {
    const y = ry + (rh * i) / Math.max(rowsToShow - 1, 1)
    const ltr = s.pattern === 'UNI' || i % 2 === 0
    o.push(line(rx + 6, y, rx + rw - 6, y, TOOLPATH, '', 1.8))
    o.push(head(ltr ? rx + rw - 6 : rx + 6, y, ltr ? 0 : Math.PI, TOOLPATH))
  }

  if (rowsToShow > 1) {
    const soX = rx + rw + 36
    const soY1 = ry, soY2 = ry + rh / Math.max(rowsToShow - 1, 1)
    o.push(dim(soX, soY1, soX, soY2, GREEN))
    o.push(txt(soX + 10, (soY1 + soY2) / 2 + 4, `STEPOVER`, GREEN, { size: 12 }))
    o.push(txt(soX + 10, (soY1 + soY2) / 2 + 20, `${s.stepoverDist.toFixed(2)} mm`, GREEN, { size: 12, bold: false }))
  }

  const dimYBottom = ry + rh + 36
  o.push(line(rx, ry + rh, rx, dimYBottom, '#555', '2 2', 1))
  o.push(line(rx + rw, ry + rh, rx + rw, dimYBottom, '#555', '2 2', 1))
  o.push(dim(rx, dimYBottom, rx + rw, dimYBottom, BLUE))
  o.push(txt(rx + rw / 2, dimYBottom + 20, `LENGTH (X): ${s.stockX.toFixed(2)} mm`, BLUE, { size: 14, anchor: 'middle' }))

  const dimXLeft = rx - 90
  o.push(line(rx, ry, dimXLeft, ry, '#555', '2 2', 1))
  o.push(line(rx, ry + rh, dimXLeft, ry + rh, '#555', '2 2', 1))
  o.push(dim(dimXLeft, ry, dimXLeft, ry + rh, BLUE))
  o.push(txt(dimXLeft - 10, ry + rh / 2, `WIDTH (Y)`, BLUE, { size: 13, anchor: 'end' }))
  o.push(txt(dimXLeft - 10, ry + rh / 2 + 16, `${s.stockY.toFixed(2)} mm`, BLUE, { size: 13, bold: false, anchor: 'end' }))

  o.push(txt(30, 350, `Passes (rows): ${s.numRows}`, MUTED, { size: 13, bold: false }))
  o.push(legendDot(30, 378, TOOLPATH, 'Toolpath'))
  o.push(legendDot(150, 378, ORANGE, 'Overtravel / Origin'))
  o.push(legendDot(300, 378, GREEN, 'Stepover'))

  o.push(`<line x1="0" y1="405" x2="900" y2="405" stroke="#3a3733" stroke-width="1"/>`)
  o.push(txt(30, 430, depthSummary(s.depth, s.rlevel, s.safeZ, s.depthPerPass, s.numRoughPasses, s.finishCut, s.finishMargin), '#ddd', { size: 13, bold: false }))

  return `<svg viewBox="0 0 900 450" width="100%" xmlns="http://www.w3.org/2000/svg" role="img">${o.join('')}</svg>`
}

export function buildFaceMillRoundSvg(s: {
  diameter: number; toolpathStyle: string
  depth: number; rlevel: number; safeZ: number; depthPerPass: number
  numRoughPasses: number; stepoverDist: number; numRings: number; overtravelMM: number
  finishCut: boolean; finishMargin: number
}): string {
  const o: string[] = []
  o.push(txt(30, 36, 'TOP VIEW', INK, { size: 18 }))

  const cx = 430, cy = 190
  const effRadiusMM = s.diameter / 2 + s.overtravelMM
  const fitScale = 150 / effRadiusMM
  const partRpx = (s.diameter / 2) * fitScale
  const effRpx = effRadiusMM * fitScale

  o.push(`<circle cx="${px(cx)}" cy="${px(cy)}" r="${px(partRpx)}" fill="none" stroke="${BLUE}" stroke-width="3"/>`)
  o.push(`<circle cx="${px(cx)}" cy="${px(cy)}" r="7" fill="${ORANGE}" stroke="#111" stroke-width="1.5"/>`)
  o.push(txt(cx + 14, cy - 14, 'ORIGIN (0,0)', ORANGE, { size: 13 }))

  const otY = cy - partRpx - 40
  o.push(dim(cx, otY, cx + (effRpx - partRpx), otY, ORANGE))
  o.push(txt(cx + 8, otY - 10, `OVERTRAVEL: ${s.overtravelMM.toFixed(2)} mm`, ORANGE, { size: 12 }))

  if (s.toolpathStyle === 'SPIRAL') {
    const rings = Math.min(s.numRings, 5)
    for (let i = 1; i <= rings; i++) {
      const r = (effRpx * i) / rings
      o.push(`<circle cx="${px(cx)}" cy="${px(cy)}" r="${px(r)}" fill="none" stroke="${TOOLPATH}" stroke-width="1.8"/>`)
    }
    const r1 = s.stepoverDist * fitScale
    const r2 = Math.min(2 * s.stepoverDist, effRadiusMM) * fitScale
    o.push(dim(cx, cy + r1, cx, cy + r2, GREEN))
    o.push(txt(cx + 14, cy + (r1 + r2) / 2 + 4, `STEPOVER: ${s.stepoverDist.toFixed(2)} mm`, GREEN, { size: 12 }))
  } else {
    const rows = Math.min(s.numRings, 5)
    for (let i = 0; i < rows; i++) {
      const yOff = -effRpx + (2 * effRpx * i) / Math.max(rows - 1, 1)
      const half = Math.sqrt(Math.max(effRpx * effRpx - yOff * yOff, 0))
      const ltr = i % 2 === 0
      o.push(line(cx - half + 4, cy + yOff, cx + half - 4, cy + yOff, TOOLPATH, '', 1.8))
      o.push(head(ltr ? cx + half - 4 : cx - half + 4, cy + yOff, ltr ? 0 : Math.PI, TOOLPATH))
    }
    if (rows > 1) {
      const soX = cx + effRpx + 36
      const y0off = -effRpx, y1off = -effRpx + (2 * effRpx) / Math.max(rows - 1, 1)
      o.push(dim(soX, cy + y0off, soX, cy + y1off, GREEN))
      o.push(txt(soX + 10, cy + (y0off + y1off) / 2 + 4, `STEPOVER`, GREEN, { size: 12 }))
      o.push(txt(soX + 10, cy + (y0off + y1off) / 2 + 20, `${s.stepoverDist.toFixed(2)} mm`, GREEN, { size: 12, bold: false }))
    }
  }

  const dimY = cy + partRpx + 36
  o.push(dim(cx - partRpx, dimY, cx + partRpx, dimY, BLUE))
  o.push(txt(cx, dimY + 20, `DIA \u2300 : ${s.diameter.toFixed(2)} mm`, BLUE, { size: 14, anchor: 'middle' }))

  o.push(txt(30, 350, `Style: ${s.toolpathStyle === 'SPIRAL' ? 'Spiral' : 'Linear Raster'}`, MUTED, { size: 13, bold: false }))
  o.push(legendDot(30, 378, TOOLPATH, 'Toolpath'))
  o.push(legendDot(150, 378, ORANGE, 'Overtravel / Origin'))
  o.push(legendDot(300, 378, GREEN, 'Stepover'))

  o.push(`<line x1="0" y1="405" x2="900" y2="405" stroke="#3a3733" stroke-width="1"/>`)
  o.push(txt(30, 430, depthSummary(s.depth, s.rlevel, s.safeZ, s.depthPerPass, s.numRoughPasses, s.finishCut, s.finishMargin), '#ddd', { size: 13, bold: false }))

  return `<svg viewBox="0 0 900 450" width="100%" xmlns="http://www.w3.org/2000/svg" role="img">${o.join('')}</svg>`
}