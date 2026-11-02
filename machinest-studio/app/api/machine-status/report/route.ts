import 'server-only'
import { NextResponse } from 'next/server'
import { loadReport } from '@/lib/reportData'

// Report numbers for the owner, or for a visitor who has entered the shop PIN
export async function GET(req: Request) {
  const r = await loadReport(new URL(req.url))
  if (!r.ok) return NextResponse.json({ error: r.error, state: r.state }, { status: r.status })
  return NextResponse.json({ state: 'ok', shopName: r.shopName, report: r.report, machines: r.machines, shifts: r.shifts })
}
