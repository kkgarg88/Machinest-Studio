// Utilization report maths. Pure code, safe for browser and server.
// All dates are Indian time. A "report day" starts when Shift 1 starts and lasts 24 hours.
import { STATUSES, shiftMinutes, type Shift } from './machineStatus'

export type LogRow = {
  machine_id: string
  status: string
  remark: string | null
  part_id: string | null
  part_name: string | null
  created_at: string
}
export type MachineRow = { id: string; name: string; machine_no: string | null; machine_type: string; type_remark: string | null; created_at: string }
export type PartRow = { id: string; name: string }

const IST_MIN = 330
const DAY_MS = 86400000

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Instant (ms) of "YYYY-MM-DD HH:MM" in Indian time
export function istMs(date: string, hhmm: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = hhmm.split(':').map(Number)
  return Date.UTC(y, m - 1, d, hh, mm) - IST_MIN * 60000
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  const [a, b] = [from, to].map(s => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) })
  return Math.round((b - a) / DAY_MS)
}

// Which report day is "now" in? (Before Shift 1 starts, it is still yesterday's report day.)
export function currentReportDay(now: number, shifts: Shift[]): string {
  const ist = new Date(now + IST_MIN * 60000)
  const date = ist.toISOString().slice(0, 10)
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes()
  return minutes < toMin(shifts[0].start) ? addDays(date, -1) : date
}

export function istDateOf(ms: number): string {
  return new Date(ms + IST_MIN * 60000).toISOString().slice(0, 10)
}

type Interval = { start: number; end: number; shift: number; day: string }

export function buildIntervals(fromDay: string, toDay: string, shifts: Shift[], offDays: Set<string>, shiftIndex: number | null, now: number): Interval[] {
  const out: Interval[] = []
  const n = daysBetween(fromDay, toDay)
  for (let i = 0; i <= n; i++) {
    const day = addDays(fromDay, i)
    if (offDays.has(day)) continue
    const dayStart = istMs(day, shifts[0].start)
    shifts.forEach((sh, k) => {
      if (shiftIndex !== null && shiftIndex !== k) return
      const offset = ((toMin(sh.start) - toMin(shifts[0].start) + 1440) % 1440) * 60000
      const start = dayStart + offset
      const end = Math.min(start + shiftMinutes(sh) * 60000, now)
      if (end > start) out.push({ start, end, shift: k, day })
    })
  }
  return out.sort((a, b) => a.start - b.start)
}

type Seg = { start: number; end: number; status: string; remark: string; partKey: string; partName: string }

export type ReportInput = {
  machines: MachineRow[]
  logs: LogRow[]
  parts: PartRow[]
  shifts: Shift[]
  offDays: string[]
  fromDay: string
  toDay: string
  shiftIndex: number | null
  machineId: string | null
  now: number
}

export type MachineReport = {
  id: string
  name: string
  machine_no: string | null
  availableHours: number
  hours: Record<string, number>
  runningHours: number
  utilization: number | null
  byShift: { name: string; availableHours: number; runningHours: number; utilization: number | null }[]
}

export type Report = {
  fromDay: string
  toDay: string
  totalDays: number
  workingDays: number
  shifts: Shift[]
  availableHours: number
  runningHours: number
  effectiveness: number | null
  machines: MachineReport[]
  idle: { status: string; label: string; color: string; hours: number }[]
  otherRemarks: { remark: string; hours: number }[]
  parts: { name: string; machines: string[]; runs: number; runningHours: number; firstRun: string; lastRun: string }[]
  days: { date: string; off: boolean; availableHours: number; runningHours: number; utilization: number | null }[]
}

const H = 3600000

function buildSegments(machine: MachineRow, logs: LogRow[], partName: (id: string | null, text: string | null) => { key: string; name: string }, now: number): Seg[] {
  const events = [
    { t: new Date(machine.created_at).getTime(), status: 'no_plan', remark: '', pk: partName(null, null) },
    ...logs.map(l => ({ t: new Date(l.created_at).getTime(), status: l.status, remark: (l.remark || '').trim(), pk: partName(l.part_id, l.part_name) })),
  ].sort((a, b) => a.t - b.t)

  const segs: Seg[] = []
  for (let i = 0; i < events.length; i++) {
    const e = events[i]
    const end = i + 1 < events.length ? events[i + 1].t : now
    if (end <= e.t) continue
    const prev = segs[segs.length - 1]
    // join neighbours that describe the same thing (e.g. a status confirmed again)
    if (prev && prev.status === e.status && prev.partKey === e.pk.key && prev.remark === e.remark && prev.end === e.t) prev.end = end
    else segs.push({ start: e.t, end, status: e.status, remark: e.remark, partKey: e.pk.key, partName: e.pk.name })
  }
  return segs
}

export function computeReport(input: ReportInput): Report {
  const { shifts, fromDay, toDay, now } = input
  const offSet = new Set(input.offDays)
  const intervals = buildIntervals(fromDay, toDay, shifts, offSet, input.shiftIndex, now)
  const partNames = new Map(input.parts.map(p => [p.id, p.name]))
  const resolvePart = (id: string | null, text: string | null) => {
    if (id && partNames.has(id)) return { key: id, name: partNames.get(id)! }
    if (text && text.trim()) return { key: 't:' + text.toLowerCase().replace(/\s+/g, ''), name: text.trim() }
    return { key: 'none', name: '(no part)' }
  }

  const machines = input.machines.filter(m => !input.machineId || m.id === input.machineId)
  const logsBy = new Map<string, LogRow[]>()
  for (const l of input.logs) {
    if (!logsBy.has(l.machine_id)) logsBy.set(l.machine_id, [])
    logsBy.get(l.machine_id)!.push(l)
  }

  const statusKeys = STATUSES.map(s => s.key as string)
  const idleTotals: Record<string, number> = {}
  const otherTotals = new Map<string, { label: string; ms: number }>()
  const partAgg = new Map<string, { name: string; machines: Set<string>; runs: number; ms: number; first: string; last: string }>()
  const dayAgg = new Map<string, { avail: number; run: number }>()

  const reports: MachineReport[] = []
  for (const m of machines) {
    const segs = buildSegments(m, logsBy.get(m.id) || [], resolvePart, now)
    const ms: Record<string, number> = {}
    const shiftAvail = shifts.map(() => 0)
    const shiftRun = shifts.map(() => 0)
    const counted = new Set<string>() // runs counted per segment
    let startIdx = 0

    for (const iv of intervals) {
      while (startIdx < segs.length && segs[startIdx].end <= iv.start) startIdx++
      for (let s = startIdx; s < segs.length && segs[s].start < iv.end; s++) {
        const seg = segs[s]
        const o = Math.min(seg.end, iv.end) - Math.max(seg.start, iv.start)
        if (o <= 0) continue
        ms[seg.status] = (ms[seg.status] || 0) + o
        shiftAvail[iv.shift] += o
        const d = dayAgg.get(iv.day) || { avail: 0, run: 0 }
        d.avail += o
        if (seg.status === 'running') {
          shiftRun[iv.shift] += o
          d.run += o
          const pa = partAgg.get(seg.partKey) || { name: seg.partName, machines: new Set<string>(), runs: 0, ms: 0, first: '', last: '' }
          pa.ms += o
          pa.machines.add(m.name + (m.machine_no ? ` #${m.machine_no}` : ''))
          const sk = `${m.id}:${s}`
          if (!counted.has(sk)) { counted.add(sk); pa.runs += 1 }
          const day = iv.day
          if (!pa.first || day < pa.first) pa.first = day
          if (!pa.last || day > pa.last) pa.last = day
          partAgg.set(seg.partKey, pa)
        } else {
          idleTotals[seg.status] = (idleTotals[seg.status] || 0) + o
          if (seg.status === 'other') {
            const key = (seg.remark || '(no remark)').toLowerCase().replace(/\s+/g, ' ')
            const cur = otherTotals.get(key) || { label: seg.remark || '(no remark)', ms: 0 }
            cur.ms += o
            otherTotals.set(key, cur)
          }
        }
        dayAgg.set(iv.day, d)
      }
    }

    const hours: Record<string, number> = {}
    let avail = 0
    for (const k of statusKeys) { hours[k] = (ms[k] || 0) / H; avail += ms[k] || 0 }
    const run = ms['running'] || 0
    reports.push({
      id: m.id, name: m.name, machine_no: m.machine_no,
      availableHours: avail / H, hours, runningHours: run / H,
      utilization: avail > 0 ? run / avail : null,
      byShift: shifts.map((sh, k) => ({ name: sh.name, availableHours: shiftAvail[k] / H, runningHours: shiftRun[k] / H, utilization: shiftAvail[k] > 0 ? shiftRun[k] / shiftAvail[k] : null })),
    })
  }

  const availableHours = reports.reduce((a, r) => a + r.availableHours, 0)
  const runningHours = reports.reduce((a, r) => a + r.runningHours, 0)

  const totalDays = daysBetween(fromDay, toDay) + 1
  const days: Report['days'] = []
  for (let i = 0; i < totalDays; i++) {
    const date = addDays(fromDay, i)
    const d = dayAgg.get(date) || { avail: 0, run: 0 }
    days.push({ date, off: offSet.has(date), availableHours: d.avail / H, runningHours: d.run / H, utilization: d.avail > 0 ? d.run / d.avail : null })
  }

  return {
    fromDay, toDay, totalDays,
    workingDays: days.filter(d => !d.off).length,
    shifts,
    availableHours, runningHours,
    effectiveness: availableHours > 0 ? runningHours / availableHours : null,
    machines: reports,
    idle: STATUSES.filter(s => s.key !== 'running' && (idleTotals[s.key] || 0) > 0)
      .map(s => ({ status: s.key as string, label: s.label as string, color: s.color as string, hours: idleTotals[s.key] / H }))
      .sort((a, b) => b.hours - a.hours),
    otherRemarks: Array.from(otherTotals.values()).map(o => ({ remark: o.label, hours: o.ms / H })).sort((a, b) => b.hours - a.hours),
    parts: Array.from(partAgg.values())
      .map(p => ({ name: p.name, machines: Array.from(p.machines).sort(), runs: p.runs, runningHours: p.ms / H, firstRun: p.first, lastRun: p.last }))
      .sort((a, b) => b.runningHours - a.runningHours),
    days,
  }
}

// ---- Period presets, resolved on the server ----
export function resolveRange(
  preset: string | null, from: string | null, to: string | null, now: number, shifts: Shift[],
): { fromDay: string; toDay: string } | { error: string } {
  const today = currentReportDay(now, shifts)
  const DATE = /^\d{4}-\d{2}-\d{2}$/
  if (preset === 'today') return { fromDay: today, toDay: today }
  if (preset === 'yesterday') { const y = addDays(today, -1); return { fromDay: y, toDay: y } }
  if (preset === '7d') return { fromDay: addDays(today, -6), toDay: today }
  if (preset === '30d') return { fromDay: addDays(today, -29), toDay: today }
  if (from && to && DATE.test(from) && DATE.test(to)) {
    if (to < from) return { error: 'The end date is before the start date' }
    if (daysBetween(from, to) > 91) return { error: 'Choose a period of up to 92 days' }
    if (to > today) return { fromDay: from, toDay: today < from ? from : today }
    return { fromDay: from, toDay: to }
  }
  return { error: 'Choose a period' }
}
