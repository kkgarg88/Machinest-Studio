'use client'
import { statusInfo, typeInfo, typeBadge, formatStamp, staleHours, staleLabel } from '@/lib/machineStatus'

// Blinking dot in the machine's status colour (still dot for people who prefer less motion)
const BLINK_CSS = `@keyframes msblink{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.25;transform:scale(.8)}}.ms-dot{animation:msblink 1.3s ease-in-out infinite}@media (prefers-reduced-motion:reduce){.ms-dot{animation:none}}`

export type CardMachine = {
  id: string
  name: string
  machine_no: string | null
  machine_type: string
  type_remark: string | null
  part_name: string | null
  part_id?: string | null
  updated_at?: string | null
  status: string
  remark: string | null
  status_since: string
  updated_by_name: string | null
}

export default function MachineCard({ machine: m, onClick, tv }: { machine: CardMachine; onClick?: () => void; tv?: boolean }) {
  const st = statusInfo(m.status)
  const ty = typeInfo(m.machine_type)
  const stale = staleHours(m.status, m.updated_at || m.status_since)

  return (
    <div
      onClick={onClick}
      style={{
        background: '#2b2a28', border: `2px solid ${st.color}`, borderRadius: 12, padding: 10,
        cursor: onClick ? 'pointer' : 'default', boxShadow: `0 4px 16px ${st.color}22`, minWidth: 0,
      }}
    >
      {/* Type badge and machine number sit above the picture so they never cover it */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ background: ty.color, color: '#fff', fontWeight: 800, fontSize: 11, letterSpacing: 0.4, padding: '4px 8px', borderRadius: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
          {typeBadge(m.machine_type, m.type_remark)}
        </span>
        {m.machine_no && (
          <span style={{ background: '#1f1e1c', color: '#fff', fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 6, whiteSpace: 'nowrap' }}>
            #{m.machine_no}
          </span>
        )}
      </div>

      <div style={{ background: '#fff', borderRadius: 8, height: tv ? 150 : 100, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ty.image} alt={ty.label} style={{ height: '100%', width: '100%', objectFit: 'contain' }} />
      </div>

      <style>{BLINK_CSS}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: tv ? 18 : 15, wordBreak: 'break-word' }}>{m.name}</div>
        <span
          className="ms-dot"
          title={st.label}
          style={{ flex: '0 0 auto', width: tv ? 14 : 11, height: tv ? 14 : 11, borderRadius: '50%', background: st.color, boxShadow: `0 0 8px 2px ${st.color}` }}
        />
      </div>
      <div style={{ color: '#bbb', fontSize: 12.5, margin: '2px 0 8px', wordBreak: 'break-word' }}>
        Part: <b style={{ color: '#fff' }}>{m.part_name || '—'}</b>
      </div>

      <span style={{ display: 'inline-block', background: st.color, color: '#111', fontWeight: 800, fontSize: 11.5, padding: '3px 10px', borderRadius: 10 }}>
        {st.label}
      </span>
      {stale !== null && (
        <div style={{ color: '#ffcf4a', fontSize: tv ? 14 : 12, fontWeight: 700, marginTop: 8 }}>
          ⚠ Not updated for {staleLabel(stale)}
        </div>
      )}
      {m.remark && <div style={{ color: '#ccc', fontSize: 12.5, marginTop: 8, lineHeight: 1.4, wordBreak: 'break-word' }}>{m.remark}</div>}

      <div style={{ borderTop: '1px solid #3a3733', marginTop: 10, paddingTop: 8, color: '#999', fontSize: 11.5, lineHeight: 1.6 }}>
        From: <span style={{ color: '#ddd' }}>{formatStamp(m.status_since)}</span>
        <br />
        Last updated by: <span style={{ color: '#ddd' }}>{m.updated_by_name || '—'}</span>
      </div>
    </div>
  )
}
