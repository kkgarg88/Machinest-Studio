'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { STATUSES, type Shift } from '@/lib/machineStatus'
import type { Report } from '@/lib/machineReport'

type Payload = {
  state: 'ok'
  shopName: string
  report: Report
  machines: { id: string; name: string; machine_no: string | null }[]
  shifts: Shift[]
}

const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 18, marginBottom: 16 } as const
const sel = { background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 8, color: '#fff', padding: '9px 12px', fontSize: 13.5 } as const
const btnPrimary = { background: '#F0801E', color: '#fff', border: 'none', borderRadius: 999, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' } as const
const btnGhost = { background: 'transparent', border: '1px solid #F0801E', color: '#F0801E', borderRadius: 999, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' } as const

type Tab = 'util' | 'idle' | 'parts'

function pct(n: number | null): string {
  return n === null ? '—' : `${Math.round(n * 100)}%`
}
function hrs(n: number): string {
  return `${Math.round(n * 10) / 10} h`
}
function dmy(d: string): string {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}-${m}-${y}`
}

// Shared by the owner page and the public (PIN) page. `slug` is only needed on the public page.
export default function ReportView({ slug }: { slug?: string }) {
  const [tab, setTab] = useState<Tab>('util')
  const [preset, setPreset] = useState('7d')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [shift, setShift] = useState('all')
  const [machine, setMachine] = useState('all')
  const [dailyDate, setDailyDate] = useState('')
  const [data, setData] = useState<Payload | null>(null)
  const [error, setError] = useState('')
  const [locked, setLocked] = useState(false)
  const [loading, setLoading] = useState(true)

  const query = useMemo(() => {
    const q = new URLSearchParams()
    if (slug) q.set('slug', slug)
    if (preset === 'custom') { q.set('from', from); q.set('to', to) } else q.set('preset', preset)
    q.set('shift', shift)
    q.set('machine', machine)
    return q
  }, [slug, preset, from, to, shift, machine])

  const load = useCallback(async () => {
    if (preset === 'custom' && (!from || !to)) return
    setLoading(true)
    setError('')
    const res = await fetch(`/api/machine-status/report?${query.toString()}`, { cache: 'no-store' }).catch(() => null)
    setLoading(false)
    if (!res) { setError('Network error. Please try again'); return }
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (body.state === 'locked') setLocked(true)
      setError(body.error || 'Could not load the report')
      return
    }
    setLocked(false)
    setData(body as Payload)
  }, [query, preset, from, to])

  useEffect(() => { load() }, [load])

  function download(q: URLSearchParams) {
    window.location.href = `/api/machine-status/report/export?${q.toString()}`
  }

  function dailyDownload() {
    if (!dailyDate) { setError('Pick the report day first'); return }
    const q = new URLSearchParams()
    if (slug) q.set('slug', slug)
    q.set('from', dailyDate)
    q.set('to', dailyDate)
    q.set('shift', 'all')
    q.set('machine', 'all')
    download(q)
  }

  if (locked) {
    return (
      <div style={{ ...card, textAlign: 'center', color: '#ccc' }}>
        <p style={{ margin: '0 0 6px', fontWeight: 700 }}>Enter the PIN first</p>
        <p style={{ margin: 0, color: '#999', fontSize: 13.5 }}>Open the status board, enter the PIN, then come back to Reports.</p>
      </div>
    )
  }

  const r = data?.report
  const maxIdle = r && r.idle.length > 0 ? Math.max(...r.idle.map(x => x.hours)) : 0

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {([['util', 'Utilization'], ['idle', 'Idle reasons'], ['parts', 'Part history']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ background: tab === k ? '#F0801E' : '#33312e', color: tab === k ? '#fff' : '#ccc', border: 'none', borderRadius: 999, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      <div style={{ ...card, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select style={sel} value={preset} onChange={e => setPreset(e.target.value)}>
          <option value="today">Today (current report day)</option>
          <option value="yesterday">Yesterday</option>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="custom">Choose dates</option>
        </select>
        {preset === 'custom' && (
          <>
            <input type="date" style={sel} value={from} onChange={e => setFrom(e.target.value)} />
            <span style={{ color: '#888' }}>to</span>
            <input type="date" style={sel} value={to} onChange={e => setTo(e.target.value)} />
          </>
        )}
        <select style={sel} value={shift} onChange={e => setShift(e.target.value)}>
          <option value="all">All shifts</option>
          {(data?.shifts || []).map((s, i) => <option key={i} value={String(i)}>{s.name} ({s.start}-{s.end})</option>)}
        </select>
        <select style={sel} value={machine} onChange={e => setMachine(e.target.value)}>
          <option value="all">All machines</option>
          {(data?.machines || []).map(m => <option key={m.id} value={m.id}>{m.name}{m.machine_no ? ` #${m.machine_no}` : ''}</option>)}
        </select>
        <span style={{ flex: 1 }} />
        <button style={btnPrimary} onClick={() => download(query)}>Download Excel</button>
      </div>

      <div style={{ ...card, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <b style={{ fontSize: 14 }}>Daily report</b>
        <span style={{ color: '#999', fontSize: 12.5 }}>24 hours from the start of Shift 1</span>
        <input type="date" style={sel} value={dailyDate} onChange={e => setDailyDate(e.target.value)} />
        <button style={btnGhost} onClick={dailyDownload}>Download daily report</button>
      </div>

      {error && <div style={{ background: '#3a2222', border: '1px solid #ff6b6b', color: '#ff8a8a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13.5 }}>{error}</div>}
      {loading && !r && <p style={{ color: '#999' }}>Loading...</p>}

      {r && (
        <div style={{ opacity: loading ? 0.6 : 1 }}>
          <div style={{ color: '#999', fontSize: 12.5, marginBottom: 12 }}>
            {r.fromDay === r.toDay ? `Report day ${dmy(r.fromDay)}` : `${dmy(r.fromDay)} to ${dmy(r.toDay)}`}. Only time inside the shifts, on working days, is counted.
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
            {[
              { v: pct(r.effectiveness), l: 'Shop effectiveness', c: '#2fbf71' },
              { v: `${r.workingDays} / ${r.totalDays}`, l: 'Working days in period', c: '#fff' },
              { v: hrs(r.availableHours), l: 'Available shift hours', c: '#fff' },
              { v: hrs(r.runningHours), l: 'Running hours', c: '#fff' },
            ].map(k => (
              <div key={k.l} style={{ background: '#33312e', borderRadius: 10, padding: 14 }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: k.c }}>{k.v}</div>
                <div style={{ color: '#999', fontSize: 12 }}>{k.l}</div>
              </div>
            ))}
          </div>

          {tab === 'util' && (
            <>
              <div style={card}>
                <b>Machine-wise utilization</b>
                {r.machines.length === 0 && <p style={{ color: '#999', fontSize: 13.5 }}>No machines.</p>}
                {r.machines.map(m => (
                  <div key={m.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 170px) 1fr 56px', gap: 12, alignItems: 'center', margin: '10px 0', fontSize: 13.5 }}>
                    <span style={{ wordBreak: 'break-word' }}>{m.name}{m.machine_no ? ` #${m.machine_no}` : ''}</span>
                    <div style={{ display: 'flex', height: 20, borderRadius: 5, overflow: 'hidden', background: '#1c1b19' }} title={m.availableHours > 0 ? undefined : 'No shift time in this period'}>
                      {m.availableHours > 0 && STATUSES.map(s => {
                        const w = ((m.hours[s.key] || 0) / m.availableHours) * 100
                        return w > 0 ? <i key={s.key} title={`${s.label}: ${hrs(m.hours[s.key] || 0)}`} style={{ width: `${w}%`, background: s.color }} /> : null
                      })}
                    </div>
                    <b style={{ textAlign: 'right' }}>{pct(m.utilization)}</b>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, color: '#ccc', marginTop: 12 }}>
                  {STATUSES.map(s => <span key={s.key}><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: s.color, marginRight: 5 }} />{s.label}</span>)}
                </div>
              </div>

              {r.shifts.length > 1 && (
                <div style={{ ...card, overflowX: 'auto' }}>
                  <b>Shift-wise utilization</b>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
                    <thead><tr style={{ color: '#999', textAlign: 'left' }}>
                      <th style={{ padding: 8 }}>Machine</th>
                      {r.shifts.map(s => <th key={s.name} style={{ padding: 8 }}>{s.name}</th>)}
                    </tr></thead>
                    <tbody>
                      {r.machines.map(m => (
                        <tr key={m.id} style={{ borderTop: '1px solid #3a3733' }}>
                          <td style={{ padding: 8 }}>{m.name}</td>
                          {m.byShift.map((b, i) => <td key={i} style={{ padding: 8 }}>{pct(b.utilization)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {r.days.length > 1 && (
                <div style={{ ...card, overflowX: 'auto' }}>
                  <b>Day-wise</b>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
                    <thead><tr style={{ color: '#999', textAlign: 'left' }}><th style={{ padding: 8 }}>Report day</th><th style={{ padding: 8 }}>Available</th><th style={{ padding: 8 }}>Running</th><th style={{ padding: 8 }}>Utilization</th></tr></thead>
                    <tbody>
                      {r.days.map(d => (
                        <tr key={d.date} style={{ borderTop: '1px solid #3a3733', color: d.off ? '#777' : '#fff' }}>
                          <td style={{ padding: 8 }}>{dmy(d.date)}{d.off ? ' (off day)' : ''}</td>
                          <td style={{ padding: 8 }}>{d.off ? '—' : hrs(d.availableHours)}</td>
                          <td style={{ padding: 8 }}>{d.off ? '—' : hrs(d.runningHours)}</td>
                          <td style={{ padding: 8 }}>{d.off ? '—' : pct(d.utilization)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {tab === 'idle' && (
            <>
              <div style={card}>
                <b>Idle reasons (hours lost, all selected machines)</b>
                {r.idle.length === 0 && <p style={{ color: '#999', fontSize: 13.5 }}>No idle time recorded in this period.</p>}
                {r.idle.map(x => (
                  <div key={x.status} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px, 170px) 1fr 70px', gap: 12, alignItems: 'center', margin: '10px 0', fontSize: 13.5 }}>
                    <span>{x.label}</span>
                    <div style={{ height: 20, borderRadius: 5, background: '#1c1b19', overflow: 'hidden' }}>
                      <i style={{ display: 'block', height: '100%', width: `${maxIdle > 0 ? (x.hours / maxIdle) * 100 : 0}%`, background: x.color }} />
                    </div>
                    <b style={{ textAlign: 'right' }}>{hrs(x.hours)}</b>
                  </div>
                ))}
              </div>
              {r.otherRemarks.length > 0 && (
                <div style={card}>
                  <b>&quot;Other&quot; by remark</b>
                  {r.otherRemarks.map(o => (
                    <div key={o.remark} style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #3a3733', padding: '8px 0', fontSize: 13.5, marginTop: 6 }}>
                      <span style={{ wordBreak: 'break-word' }}>{o.remark}</span><b>{hrs(o.hours)}</b>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'parts' && (
            <div style={{ ...card, overflowX: 'auto' }}>
              <b>Part history</b>
              {r.parts.length === 0 ? (
                <p style={{ color: '#999', fontSize: 13.5 }}>No running time recorded in this period.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
                  <thead><tr style={{ color: '#999', textAlign: 'left' }}>
                    <th style={{ padding: 8 }}>Part</th><th style={{ padding: 8 }}>Machines used</th><th style={{ padding: 8 }}>Runs</th><th style={{ padding: 8 }}>Running hours</th><th style={{ padding: 8 }}>First / last run</th>
                  </tr></thead>
                  <tbody>
                    {r.parts.map(p => (
                      <tr key={p.name} style={{ borderTop: '1px solid #3a3733' }}>
                        <td style={{ padding: 8, fontWeight: 600 }}>{p.name}</td>
                        <td style={{ padding: 8 }}>{p.machines.join(', ')}</td>
                        <td style={{ padding: 8 }}>{p.runs}</td>
                        <td style={{ padding: 8 }}>{hrs(p.runningHours)}</td>
                        <td style={{ padding: 8 }}>{dmy(p.firstRun)} / {dmy(p.lastRun)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
