import 'server-only'
import ExcelJS from 'exceljs'
import { STATUSES } from '@/lib/machineStatus'
import type { Report } from '@/lib/machineReport'

const ORANGE = 'FFF0801E'
const DARK = 'FF1A1A1A'

function styleHeader(row: ExcelJS.Row) {
  row.eachCell(c => {
    c.font = { name: 'Arial', bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } }
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  })
  row.height = 28
}

function fmtDate(d: string): string {
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return `${day}-${m}-${y}`
}

function base(ws: ExcelJS.Worksheet) {
  ws.eachRow(r => r.eachCell(c => { if (!c.font || !c.font.name) c.font = { name: 'Arial', size: 10 } }))
}

export async function buildReportWorkbook(opts: {
  shopName: string
  report: Report
  shiftLabel: string
  machineLabel: string
}): Promise<Buffer> {
  const { shopName, report: r } = opts
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Machinest Studio'
  wb.created = new Date()

  // ---------- Summary ----------
  const s = wb.addWorksheet('Summary')
  s.getColumn(1).width = 30
  s.getColumn(2).width = 40
  s.addRow([`${shopName} - Machine utilization report`]).font = { name: 'Arial', bold: true, size: 14 }
  s.addRow([])
  const period = r.fromDay === r.toDay ? fmtDate(r.fromDay) : `${fmtDate(r.fromDay)} to ${fmtDate(r.toDay)}`
  const rows: [string, string | number][] = [
    ['Period (report days)', period],
    ['Shift', opts.shiftLabel],
    ['Machine', opts.machineLabel],
    ['Working days', `${r.workingDays} of ${r.totalDays}`],
    ['Available shift hours', Math.round(r.availableHours * 10) / 10],
    ['Running hours', Math.round(r.runningHours * 10) / 10],
    ['Shop effectiveness', r.effectiveness === null ? 'No data' : r.effectiveness],
    ['Shifts', r.shifts.map(sh => `${sh.name} ${sh.start}-${sh.end}`).join(', ')],
  ]
  for (const [k, v] of rows) {
    const row = s.addRow([k, v])
    row.getCell(1).font = { name: 'Arial', bold: true, size: 10 }
    if (k === 'Shop effectiveness' && typeof v === 'number') row.getCell(2).numFmt = '0.0%'
    row.getCell(2).alignment = { horizontal: 'left' }
  }
  s.addRow([])
  const note = s.addRow(['A report day starts when Shift 1 starts and lasts 24 hours. Only time inside the shifts, on working days, is counted. Times are Indian time.'])
  note.getCell(1).font = { name: 'Arial', italic: true, size: 9, color: { argb: 'FF666666' } }
  base(s)

  // ---------- Machine utilization ----------
  const m = wb.addWorksheet('Machine utilization')
  const stat = STATUSES.filter(x => x.key !== 'running')
  const head = ['Machine', 'No.', 'Available hours', 'Running hours', 'Utilization', ...stat.map(x => `${x.label} (h)`), ...r.shifts.map(sh => `${sh.name} utilization`)]
  styleHeader(m.addRow(head))
  for (const x of r.machines) {
    const row = m.addRow([
      x.name, x.machine_no || '', round1(x.availableHours), round1(x.runningHours), x.utilization === null ? 'No data' : x.utilization,
      ...stat.map(st => round1(x.hours[st.key] || 0)),
      ...x.byShift.map(b => (b.utilization === null ? 'No data' : b.utilization)),
    ])
    row.getCell(5).numFmt = '0.0%'
    x.byShift.forEach((_, i) => { row.getCell(6 + stat.length + i).numFmt = '0.0%' })
  }
  m.getColumn(1).width = 24
  for (let i = 2; i <= head.length; i++) m.getColumn(i).width = 15
  m.views = [{ state: 'frozen', ySplit: 1 }]
  base(m)

  // ---------- Idle reasons ----------
  const i = wb.addWorksheet('Idle reasons')
  styleHeader(i.addRow(['Reason', 'Hours lost', 'Share of idle time']))
  const idleTotal = r.idle.reduce((a, x) => a + x.hours, 0)
  for (const x of r.idle) {
    const row = i.addRow([x.label, round1(x.hours), idleTotal > 0 ? x.hours / idleTotal : 0])
    row.getCell(3).numFmt = '0.0%'
  }
  if (r.otherRemarks.length > 0) {
    i.addRow([])
    styleHeader(i.addRow(['"Other" by remark', 'Hours', '']))
    for (const x of r.otherRemarks) i.addRow([x.remark, round1(x.hours)])
  }
  ;[34, 14, 18].forEach((w, n) => { i.getColumn(n + 1).width = w })
  base(i)

  // ---------- Part history ----------
  const p = wb.addWorksheet('Part history')
  styleHeader(p.addRow(['Part', 'Machines used', 'Runs', 'Running hours', 'First run', 'Last run']))
  for (const x of r.parts) p.addRow([x.name, x.machines.join(', '), x.runs, round1(x.runningHours), fmtDate(x.firstRun), fmtDate(x.lastRun)])
  ;[26, 40, 8, 15, 14, 14].forEach((w, n) => { p.getColumn(n + 1).width = w })
  base(p)

  // ---------- Day-wise ----------
  const d = wb.addWorksheet('Day-wise')
  styleHeader(d.addRow(['Report day', 'Off day', 'Available hours', 'Running hours', 'Utilization']))
  for (const x of r.days) {
    const row = d.addRow([fmtDate(x.date), x.off ? 'Off' : '', round1(x.availableHours), round1(x.runningHours), x.utilization === null ? (x.off ? '' : 'No data') : x.utilization])
    row.getCell(5).numFmt = '0.0%'
  }
  ;[16, 10, 16, 16, 14].forEach((w, n) => { d.getColumn(n + 1).width = w })
  base(d)

  // brand accent on the first sheet title row
  s.getRow(1).getCell(1).font = { name: 'Arial', bold: true, size: 14, color: { argb: ORANGE } }

  const buf = await wb.xlsx.writeBuffer()
  return Buffer.from(buf as ArrayBuffer)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
