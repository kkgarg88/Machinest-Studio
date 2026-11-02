import 'server-only'
import { NextResponse } from 'next/server'
import { loadReport } from '@/lib/reportData'
import { buildReportWorkbook } from '@/lib/reportExcel'

// Excel download of the same report (also used by the "Daily report" button)
export async function GET(req: Request) {
  const url = new URL(req.url)
  const r = await loadReport(url)
  if (!r.ok) return NextResponse.json({ error: r.error, state: r.state }, { status: r.status })

  const shiftParam = url.searchParams.get('shift')
  const shiftIdx = shiftParam && shiftParam !== 'all' ? Number(shiftParam) : null
  const machineParam = url.searchParams.get('machine')
  const machine = r.machines.find(m => m.id === machineParam)

  const buf = await buildReportWorkbook({
    shopName: r.shopName,
    report: r.report,
    shiftLabel: shiftIdx !== null && r.shifts[shiftIdx] ? r.shifts[shiftIdx].name : 'All shifts',
    machineLabel: machine ? machine.name : 'All machines',
  })

  const name = r.report.fromDay === r.report.toDay ? `Daily-report-${r.report.fromDay}` : `Report-${r.report.fromDay}-to-${r.report.toDay}`
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${name}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  })
}
