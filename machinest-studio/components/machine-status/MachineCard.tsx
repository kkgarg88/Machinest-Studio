'use client'
import { statusInfo, typeInfo, typeBadge, formatStamp } from '@/lib/machineStatus'

export type CardMachine = {
  id: string
  name: string
  machine_no: string | null
  machine_type: string
  type_remark: string | null
  part_name: string | null
  status: string
  remark: string | null
  status_since: string
  updated_by_name: string | null
}

export default function MachineCard({ machine: m, onClick, tv }: { machine: CardMachine; onClick?: () => void; tv?: boolean }) {
  const st = statusInfo(m.status)
  const ty = typeInfo(m.machine_type)

  return (
    <div
      onClick={onClick}
      style={{
        background: '#2b2a28', border: `2px solid ${st.color}`, borderRadius: 12, padding: 12,
        cursor: onClick ? 'pointer' : 'default', boxShadow: `0 4px 16px ${st.color}22`,
      }}
    >
      <div style={{ position: 'relative', background: '#fff', borderRadius: 8, height: tv ? 150 : 110, marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ty.image} alt={ty.label} style={{ height: '100%', width: '100%', objectFit: 'contain' }} />
        <span style={{ position: 'absolute', left: 8, top: 8, background: ty.color, color: '#fff', fontWeight: 800, fontSize: 11.5, letterSpacing: 0.5, padding: '4px 9px', borderRadius: 6 }}>
          {typeBadge(m.machine_type, m.type_remark)}
        </span>
        {m.machine_no && (
          <span style={{ position: 'absolute', right: 8, top: 8, background: '#262421', color: '#fff', fontSize: 12, fontWeight: 700, padding: '3px 8px', borderRadius: 6 }}>
            #{m.machine_no}
          </span>
        )}
      </div>

      <div style={{ color: '#fff', fontWeight: 700, fontSize: tv ? 18 : 16, wordBreak: 'break-word' }}>{m.name}</div>
      <div style={{ color: '#bbb', fontSize: 12.5, margin: '2px 0 8px', wordBreak: 'break-word' }}>
        Part: <b style={{ color: '#fff' }}>{m.part_name || '—'}</b>
      </div>

      <span style={{ display: 'inline-block', background: st.color, color: '#111', fontWeight: 800, fontSize: 11.5, padding: '3px 10px', borderRadius: 10 }}>
        {st.label}
      </span>
      {m.remark && <div style={{ color: '#ccc', fontSize: 12.5, marginTop: 8, lineHeight: 1.4, wordBreak: 'break-word' }}>{m.remark}</div>}

      <div style={{ borderTop: '1px solid #3a3733', marginTop: 10, paddingTop: 8, color: '#999', fontSize: 11.5, lineHeight: 1.6 }}>
        From: <span style={{ color: '#ddd' }}>{formatStamp(m.status_since)}</span>
        <br />
        Last updated by: <span style={{ color: '#ddd' }}>{m.updated_by_name || '—'}</span>
      </div>
    </div>
  )
}
