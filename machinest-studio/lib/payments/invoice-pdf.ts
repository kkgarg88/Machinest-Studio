import { PDFDocument, StandardFonts, rgb, PDFFont } from 'pdf-lib'

export const SELLER = {
  name: 'Machinest-India',
  address: 'Ahmedabad, Gujarat',
  phone: '+91 7988277215',
  email: 'machinestindia@gmail.com',
}

export type InvoiceData = {
  invoiceNo: string
  invoiceDate: string
  customerName: string
  customerEmail: string
  customerPhone: string
  planName: string
  billingLabel: string      // "Monthly" or "Yearly"
  toolNames: string[]
  startDate: string
  expiryDate: string
  subtotal: number
  discount: number
  couponCode: string
  total: number
  orderId: string
}

// The standard PDF fonts only know basic Latin letters, so anything else becomes "?".
function clean(s: string): string {
  return (s || '').replace(/[^\x20-\x7E]/g, '?')
}
export function money(n: number): string {
  return 'Rs. ' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const words = clean(text).split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w
    if (font.widthOfTextAtSize(t, size) <= maxW) cur = t
    else { if (cur) lines.push(cur); cur = w }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

export async function buildInvoicePdf(d: InvoiceData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595, 842])
  const reg = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const orange = rgb(0.949, 0.549, 0.059)
  const dark = rgb(0.1, 0.1, 0.1)
  const grey = rgb(0.4, 0.4, 0.4)
  const line = rgb(0.82, 0.82, 0.82)
  const L = 45, R = 550
  const text = (t: string, x: number, y: number, o: { size?: number; bold?: boolean; color?: any; right?: boolean } = {}) => {
    const size = o.size || 10, font = o.bold ? bold : reg, s = clean(t)
    const xx = o.right ? x - font.widthOfTextAtSize(s, size) : x
    page.drawText(s, { x: xx, y, size, font, color: o.color || dark })
  }

  // top band
  page.drawRectangle({ x: 0, y: 812, width: 595, height: 30, color: orange })
  text(SELLER.name, L, 770, { size: 24, bold: true })
  text(SELLER.address, L, 752, { color: grey })
  text('Mobile: ' + SELLER.phone, L, 738, { color: grey })
  text('Email: ' + SELLER.email, L, 724, { color: grey })
  text('INVOICE', R, 770, { size: 24, bold: true, color: orange, right: true })
  text('Invoice No: ' + d.invoiceNo, R, 750, { bold: true, right: true })
  text('Date: ' + d.invoiceDate, R, 736, { right: true })
  page.drawLine({ start: { x: L, y: 706 }, end: { x: R, y: 706 }, thickness: 1, color: line })

  // bill to
  text('BILLED TO', L, 684, { size: 9, bold: true, color: grey })
  let y = 668
  text(d.customerName || 'Customer', L, y, { bold: true, size: 11 }); y -= 15
  if (d.customerEmail) { text(d.customerEmail, L, y, { color: grey }); y -= 14 }
  if (d.customerPhone) { text(d.customerPhone, L, y, { color: grey }); y -= 14 }

  // table
  const ty = 590
  page.drawRectangle({ x: L, y: ty - 6, width: R - L, height: 24, color: dark })
  text('DESCRIPTION', L + 10, ty + 2, { bold: true, color: rgb(1, 1, 1), size: 9 })
  text('AMOUNT', R - 10, ty + 2, { bold: true, color: rgb(1, 1, 1), size: 9, right: true })

  let ry = ty - 28
  const title = `${d.planName} - ${d.billingLabel} membership`
  for (const l of wrap(title, bold, 11, 370)) { text(l, L + 10, ry, { bold: true, size: 11 }); ry -= 15 }
  if (d.toolNames.length) for (const l of wrap('Includes: ' + d.toolNames.join(', '), reg, 10, 370)) { text(l, L + 10, ry, { color: grey }); ry -= 13 }
  text(`Valid from ${d.startDate} to ${d.expiryDate}`, L + 10, ry, { color: grey }); ry -= 13
  text(money(d.subtotal), R - 10, ty - 28, { right: true, size: 11 })
  ry -= 8
  page.drawLine({ start: { x: L, y: ry }, end: { x: R, y: ry }, thickness: 0.5, color: line })

  // totals
  ry -= 22
  if (d.discount > 0) {
    text('Subtotal', 340, ry, { color: grey }); text(money(d.subtotal), R - 10, ry, { right: true }); ry -= 16
    text(`Coupon discount${d.couponCode ? ' (' + d.couponCode + ')' : ''}`, 340, ry, { color: grey })
    text('- ' + money(d.discount), R - 10, ry, { right: true }); ry -= 20
  }
  page.drawRectangle({ x: 330, y: ry - 8, width: R - 330, height: 28, color: rgb(0.99, 0.91, 0.78) })
  text('TOTAL PAID', 340, ry + 2, { bold: true })
  text(money(d.total), R - 10, ry + 2, { bold: true, size: 12, right: true })

  ry -= 50
  text('Payment method: Online (Razorpay)', L, ry, { color: grey }); ry -= 14
  text('Order ID: ' + d.orderId, L, ry, { color: grey })

  // footer
  page.drawLine({ start: { x: L, y: 70 }, end: { x: R, y: 70 }, thickness: 1, color: line })
  text('Thank you for choosing Machinest Studio.', L, 52, { color: grey })
  text('This is a computer-generated invoice and does not need a signature.', L, 38, { color: grey, size: 9 })

  return pdf.save()
}
