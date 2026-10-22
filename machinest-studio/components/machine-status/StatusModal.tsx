'use client'
import { useState } from 'react'
import { STATUSES, statusInfo, typeInfo, typeBadge } from '@/lib/machineStatus'
import type { CardMachine } from './MachineCard'

const inputStyle = { background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 12px', fontSize: 14, width: '100%', boxSizing: 'border-box' } as const
const labelStyle = { color: '#999', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 } as const

// Status update box used by the owner and by operators
export default function StatusModal({
  machine, canEdit, onClose, onDone, onError, footer,
}: {
  machine: CardMachine
  canEdit: boolean
  onClose: () => void
  onDone: (text: string) => void
  onError: (text: string) => void
  footer?: React.ReactNode
}) {
  const [status, setStatus] = useState(machine.status)
  const [remark, setRemark] = useState(machine.remark || '')
  const [part, setPart] = useState(machine.part_name || '')
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!part.trim()) { onError('Part name is required'); return }
    if (status === 'other' && !remark.trim()) { onError('Please write a remark for "Other"'); return }
    setBusy(true)
    const res = await fetch(`/api/machine-status/machines/${machine.id}/status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, remark, part_name: part }),
    }).catch(() => null)
    setBusy(false)
    if (!res) { onError('Network error. Please try again'); return }
    const data = await res.json().catch(() => ({}))
    if (!res.ok) { onError(data.error || 'Could not update'); return }
    onDone('Status updated')
  }

  const ty = typeInfo(machine.machine_type)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 20, width: '100%', maxWidth: 400, maxHeight: '90vh', overflowY: 'auto', color: '#fff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, gap: 10 }}>
          <div>
            <h2 style={{ fontSize: 18, margin: 0 }}>{machine.name}{machine.machine_no ? ` #${machine.machine_no}` : ''}</h2>
            <span style={{ display: 'inline-block', marginTop: 6, background: ty.color, color: '#fff', fontWeight: 800, fontSize: 11, padding: '3px 8px', borderRadius: 6 }}>
              {typeBadge(machine.machine_type, machine.type_remark)}
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: '1px solid #3a3733', color: '#ddd', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>✕</button>
        </div>

        {!canEdit ? (
          <p style={{ color: '#e0b13a', fontSize: 14, margin: 0 }}>The subscription has expired, so status cannot be updated.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Status</label>
              <select style={{ ...inputStyle, borderColor: statusInfo(status).color }} value={status} onChange={e => setStatus(e.target.value)}>
                {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Part name</label>
              <input style={inputStyle} value={part} maxLength={60} onChange={e => setPart(e.target.value)} placeholder="Part being made" />
            </div>
            <div>
              <label style={labelStyle}>Remark {status === 'other' ? '(required)' : '(optional)'}</label>
              <textarea style={{ ...inputStyle, fontFamily: 'inherit' }} rows={3} maxLength={200} value={remark} onChange={e => setRemark(e.target.value)} />
            </div>
            <button
              onClick={save}
              disabled={busy}
              style={{ background: '#F0801E', color: '#fff', border: 'none', borderRadius: 999, padding: '11px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
            >
              {busy ? 'Saving...' : 'Update status'}
            </button>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
