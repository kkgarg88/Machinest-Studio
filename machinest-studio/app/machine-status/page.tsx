'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MACHINE_TYPES, slugify, checkSlug, PIN_RE, checkShifts, DEFAULT_SHIFTS, type PartLite, type Shift } from '@/lib/machineStatus'
import MachineCard, { type CardMachine } from '@/components/machine-status/MachineCard'
import StatusModal from '@/components/machine-status/StatusModal'

type Shop = { id: string; name: string; slug: string; logo_url: string | null; public_enabled: boolean; public_pin: string; shift_count: number; shifts: Shift[] }
type Operator = { id: string; name: string; phone: string | null; created_at: string }

type Me =
  | { role: null; canCreate: boolean }
  | {
      role: 'owner'
      active: boolean
      shop: Shop
      machines: CardMachine[]
      parts: PartLite[]
      operators: Operator[]
      limits: { machines: number; operators: number }
    }

const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 20 } as const
const inputStyle = { background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 12px', fontSize: 14, width: '100%', boxSizing: 'border-box' } as const
const btnPrimary = { background: '#F0801E', color: '#fff', border: 'none', borderRadius: 999, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer' } as const
const btnGhost = { background: 'transparent', border: '1px solid #3a3733', color: '#ddd', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const
const label = { color: '#999', fontSize: 12, fontWeight: 600, display: 'block', marginBottom: 5 } as const

async function api(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => null)
  if (!res) return { ok: false, data: { error: 'Network error. Please try again' } as Record<string, string> }
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, data: data as Record<string, string> }
}

async function uploadLogo(file: File) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch('/api/machine-status/logo', { method: 'POST', body: form }).catch(() => null)
  if (!res) return { ok: false, error: 'Network error. Please try again' }
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, error: (data.error as string) || '' }
}

export default function MachineStatusPage() {
  const router = useRouter()
  const supabase = createClient()
  const logoInput = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<Me | null>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [busy, setBusy] = useState(false)

  // create shop
  const [shopName, setShopName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [pin, setPin] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)

  // board
  const [selected, setSelected] = useState<CardMachine | null>(null)
  const [editing, setEditing] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // add / edit machine form
  const [fName, setFName] = useState('')
  const [fNo, setFNo] = useState('')
  const [fType, setFType] = useState('cnc')
  const [fTypeRemark, setFTypeRemark] = useState('')
  const [fPart, setFPart] = useState('')

  // settings
  const [setName, setSetName] = useState('')
  const [setSlugVal, setSetSlugVal] = useState('')
  const [newPin, setNewPin] = useState('')

  // operators
  // part master, shifts, off days
  const [partName, setPartName] = useState('')
  const [partCustomer, setPartCustomer] = useState('')
  const [shiftCount, setShiftCount] = useState(2)
  const [shiftRows, setShiftRows] = useState<Shift[]>(DEFAULT_SHIFTS)
  const todayIso = new Date().toISOString().slice(0, 7)
  const [offMonth, setOffMonth] = useState(todayIso)
  const [offDays, setOffDays] = useState<string[]>([])
  const [offLoaded, setOffLoaded] = useState(false)

  const [opName, setOpName] = useState('')
  const [opPhone, setOpPhone] = useState('')
  const [opPin, setOpPin] = useState('')

  const flash = useCallback((text: string, ok = true) => {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3500)
  }, [])

  const load = useCallback(async () => {
    const res = await fetch('/api/machine-status/me', { cache: 'no-store' }).catch(() => null)
    if (!res) return
    if (res.status === 401) { router.push('/'); return }
    const data = await res.json().catch(() => null)
    if (data) setMe(data as Me)
    setLoading(false)
  }, [router])

  useEffect(() => {
    async function start() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      load()
    }
    start()
    const poll = setInterval(load, 8000)
    return () => clearInterval(poll)
  }, [])

  useEffect(() => {
    if (showSettings && me && me.role === 'owner') {
      setSetName(me.shop.name)
      setSetSlugVal(me.shop.slug)
      setNewPin('')
      const n = me.shop.shift_count || 2
      setShiftCount(n)
      const saved = Array.isArray(me.shop.shifts) ? me.shop.shifts : DEFAULT_SHIFTS
      setShiftRows([0, 1, 2].map(i => saved[i] || { name: `Shift ${i + 1}`, start: '08:00', end: '20:00' }))
    }
  }, [showSettings])

  useEffect(() => {
    if (!showSettings) return
    let cancelled = false
    setOffLoaded(false)
    fetch(`/api/machine-status/off-days?month=${offMonth}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (!cancelled) { setOffDays(Array.isArray(d.days) ? d.days : []); setOffLoaded(true) } })
      .catch(() => {})
    return () => { cancelled = true }
  }, [showSettings, offMonth])

  function resetMachineForm() {
    setFName(''); setFNo(''); setFType('cnc'); setFTypeRemark(''); setFPart('')
  }

  async function createShop(e: React.FormEvent) {
    e.preventDefault()
    const slugError = checkSlug(slug)
    if (slugError) { flash(slugError, false); return }
    if (!PIN_RE.test(pin)) { flash('PIN must be 4 to 6 digits', false); return }
    setBusy(true)
    const r = await api('/api/machine-status/shop', 'POST', { name: shopName, slug, pin })
    if (!r.ok) { setBusy(false); flash(r.data.error || 'Could not create shop', false); return }
    if (logoFile) {
      const up = await uploadLogo(logoFile)
      if (!up.ok) flash(`Shop created, but the logo was not saved: ${up.error}`, false)
      else flash('Your shop is ready')
    } else {
      flash('Your shop is ready')
    }
    setBusy(false)
    load()
  }

  async function changeLogo(file: File | undefined) {
    if (!file) return
    setBusy(true)
    const up = await uploadLogo(file)
    setBusy(false)
    if (logoInput.current) logoInput.current.value = ''
    if (!up.ok) { flash(up.error || 'Could not upload logo', false); return }
    flash('Logo saved')
    load()
  }

  async function removeLogo() {
    if (!confirm('Remove the shop logo?')) return
    const r = await api('/api/machine-status/logo', 'DELETE')
    if (!r.ok) { flash(r.data.error || 'Could not remove logo', false); return }
    flash('Logo removed')
    load()
  }

  async function addMachine(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const r = await api('/api/machine-status/machines', 'POST', {
      name: fName, machine_no: fNo, machine_type: fType, type_remark: fTypeRemark, part_id: fPart,
    })
    setBusy(false)
    if (!r.ok) { flash(r.data.error || 'Could not add machine', false); return }
    resetMachineForm()
    flash('Machine added')
    load()
  }

  function startEdit() {
    if (!selected) return
    setFName(selected.name)
    setFNo(selected.machine_no || '')
    setFType(selected.machine_type)
    setFTypeRemark(selected.type_remark || '')
    setFPart(selected.part_id || '')
    setEditing(true)
  }

  async function saveMachineDetails() {
    if (!selected) return
    setBusy(true)
    const r = await api(`/api/machine-status/machines/${selected.id}`, 'PATCH', {
      name: fName, machine_no: fNo, machine_type: fType, type_remark: fTypeRemark, part_id: fPart,
    })
    setBusy(false)
    if (!r.ok) { flash(r.data.error || 'Could not save', false); return }
    setSelected(null); setEditing(false); resetMachineForm()
    flash('Machine updated')
    load()
  }

  async function deleteMachine() {
    if (!selected) return
    if (!confirm(`Delete "${selected.name}" and its history? This cannot be undone.`)) return
    setBusy(true)
    const r = await api(`/api/machine-status/machines/${selected.id}`, 'DELETE')
    setBusy(false)
    if (!r.ok) { flash(r.data.error || 'Could not delete', false); return }
    setSelected(null); setEditing(false)
    flash('Machine deleted')
    load()
  }

  async function saveSettings(fields: Record<string, unknown>, okText: string) {
    setBusy(true)
    const r = await api('/api/machine-status/shop', 'PATCH', fields)
    setBusy(false)
    if (!r.ok) { flash(r.data.error || 'Could not save', false); return false }
    flash(okText)
    load()
    return true
  }

  async function deleteShop() {
    if (!me || me.role !== 'owner') return
    const typed = prompt(
      `This permanently deletes "${me.shop.name}": all machines, history, operators and the logo. The public and operator links stop working.\n\nType the shop name to confirm:`
    )
    if (typed === null) return
    setBusy(true)
    const r = await api('/api/machine-status/shop', 'DELETE', { confirm: typed })
    setBusy(false)
    if (!r.ok) { flash(r.data.error || 'Could not delete the shop', false); return }
    setShowSettings(false)
    setSelected(null)
    flash('Shop deleted')
    load()
  }

  async function addOperator(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const r = await api('/api/machine-status/operators', 'POST', { name: opName, phone: opPhone, pin: opPin })
    setBusy(false)
    if (!r.ok) { flash(r.data.error || 'Could not add operator', false); return }
    setOpName(''); setOpPhone(''); setOpPin('')
    flash('Operator added. Share the operator link and their PIN')
    load()
  }

  async function resetOperatorPin(op: Operator) {
    const value = prompt(`New PIN for ${op.name} (4 to 6 digits). Their phone will be logged out.`)
    if (value === null) return
    const r = await api(`/api/machine-status/operators/${op.id}`, 'PATCH', { pin: value.trim() })
    if (!r.ok) { flash(r.data.error || 'Could not change PIN', false); return }
    flash(`PIN changed for ${op.name}`)
  }

  async function removeOperator(op: Operator) {
    if (!confirm(`Remove ${op.name}? They will no longer be able to update status.`)) return
    const r = await api(`/api/machine-status/operators/${op.id}`, 'DELETE')
    if (!r.ok) { flash(r.data.error || 'Could not remove', false); return }
    flash('Operator removed')
    load()
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => flash('Copied'), () => flash('Could not copy', false))
  }

  async function addPart(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const r = await api('/api/machine-status/parts', 'POST', { name: partName, customer: partCustomer })
    setBusy(false)
    if (!r.ok) { flash(r.data.error || 'Could not add part', false); return }
    setPartName(''); setPartCustomer('')
    flash('Part added')
    load()
  }

  async function renamePart(p: PartLite) {
    const value = prompt('New name for this part', p.name)
    if (value === null || value.trim() === p.name) return
    const r = await api(`/api/machine-status/parts/${p.id}`, 'PATCH', { name: value })
    if (!r.ok) { flash(r.data.error || 'Could not rename', false); return }
    flash('Part renamed')
    load()
  }

  async function togglePart(p: PartLite) {
    const r = await api(`/api/machine-status/parts/${p.id}`, 'PATCH', { active: !p.active })
    if (!r.ok) { flash(r.data.error || 'Could not update', false); return }
    flash(p.active ? 'Part switched off. It no longer shows in the list' : 'Part switched on')
    load()
  }

  async function deletePart(p: PartLite) {
    if (!confirm(`Delete "${p.name}"?`)) return
    const r = await api(`/api/machine-status/parts/${p.id}`, 'DELETE')
    if (!r.ok) { flash(r.data.error || 'Could not delete', false); return }
    flash('Part deleted')
    load()
  }

  async function saveShifts() {
    const rows = shiftRows.slice(0, shiftCount).map(s => ({ name: s.name.trim(), start: s.start, end: s.end }))
    const err = checkShifts(shiftCount, rows)
    if (err) { flash(err, false); return }
    await saveSettings({ shift_count: shiftCount, shifts: rows }, 'Shifts saved')
  }

  function toggleOffDay(d: string) {
    setOffDays(list => (list.includes(d) ? list.filter(x => x !== d) : [...list, d]))
  }

  function monthDays(month: string): string[] {
    const [y, m] = month.split('-').map(Number)
    const last = new Date(y, m, 0).getDate()
    return Array.from({ length: last }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)
  }

  function markSundays() {
    const sundays = monthDays(offMonth).filter(d => new Date(d + 'T00:00:00').getDay() === 0)
    setOffDays(list => Array.from(new Set([...list, ...sundays])))
  }

  function shiftMonth(delta: number) {
    const [y, m] = offMonth.split('-').map(Number)
    const d = new Date(y, m - 1 + delta, 1)
    setOffMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  async function saveOffDays() {
    setBusy(true)
    const r = await api('/api/machine-status/off-days', 'PUT', { month: offMonth, days: offDays })
    setBusy(false)
    if (!r.ok) { flash(r.data.error || 'Could not save off days', false); return }
    flash('Off days saved')
  }

  const partOptions: PartLite[] = me && me.role === 'owner' ? me.parts.filter(p => p.active || p.id === fPart) : []

  const machineFields = (
    <>
      <div style={{ flex: '2 1 180px' }}>
        <label style={label}>Machine name</label>
        <input style={inputStyle} value={fName} maxLength={40} required placeholder="e.g. Doosan Puma" onChange={e => setFName(e.target.value)} />
      </div>
      <div style={{ flex: '1 1 100px' }}>
        <label style={label}>Machine number</label>
        <input style={inputStyle} value={fNo} maxLength={30} required placeholder="e.g. 12" onChange={e => setFNo(e.target.value)} />
      </div>
      <div style={{ flex: '1 1 180px' }}>
        <label style={label}>Machine type</label>
        <select style={inputStyle} value={fType} onChange={e => setFType(e.target.value)}>
          {MACHINE_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </div>
      {fType === 'other' && (
        <div style={{ flex: '1 1 180px' }}>
          <label style={label}>Type (write it)</label>
          <input style={inputStyle} value={fTypeRemark} maxLength={30} required placeholder="e.g. Grinder" onChange={e => setFTypeRemark(e.target.value)} />
        </div>
      )}
      <div style={{ flex: '2 1 180px' }}>
        <label style={label}>Part (optional)</label>
        <select style={inputStyle} value={fPart} onChange={e => setFPart(e.target.value)}>
          <option value="">No part yet</option>
          {partOptions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        {partOptions.length === 0 && <div style={{ color: '#777', fontSize: 11.5, marginTop: 4 }}>Add parts in Shop settings first.</div>}
      </div>
    </>
  )

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #262421 0%, #302d29 100%)', fontFamily: 'Segoe UI, sans-serif', padding: '24px 16px', color: '#fff' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {msg && (
          <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 60, background: msg.ok ? '#1f2e22' : '#3a2222', border: `1px solid ${msg.ok ? '#2fbf71' : '#ff6b6b'}`, color: msg.ok ? '#2fbf71' : '#ff6b6b', borderRadius: 8, padding: '10px 18px', fontSize: 14, maxWidth: '90vw' }}>
            {msg.text}
          </div>
        )}
        {children}
      </div>
    </div>
  )

  if (loading || !me) return shell(<p style={{ color: '#999' }}>Loading...</p>)

  // ---------- No shop yet ----------
  if (me.role === null) {
    return shell(
      <>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>📟 Machine Status</h1>
          <button style={btnGhost} onClick={() => router.push('/dashboard')}>&larr; Dashboard</button>
        </div>

        <div style={{ ...card, maxWidth: 520 }}>
          <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>Set up your shop</h2>
          <p style={{ color: '#999', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>
            Up to 100 machines, 3 operators who update status from their phones, and a PIN-protected public link.
          </p>
          {me.canCreate ? (
            <form onSubmit={createShop} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={label}>Shop name</label>
                <input
                  style={inputStyle} value={shopName} maxLength={60} required placeholder="Kamal Engineering"
                  onChange={e => { setShopName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)) }}
                />
              </div>
              <div>
                <label style={label}>Public link name</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: '#777', fontSize: 13, whiteSpace: 'nowrap' }}>app.machinest.in/</span>
                  <input
                    style={inputStyle} value={slug} maxLength={30} required placeholder="kamalshop"
                    onChange={e => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')) }}
                  />
                </div>
              </div>
              <div>
                <label style={label}>Link PIN (4 to 6 digits, share it with people who may view)</label>
                <input style={inputStyle} value={pin} inputMode="numeric" maxLength={6} required placeholder="e.g. 4827" onChange={e => setPin(e.target.value.replace(/\D/g, ''))} />
              </div>
              <div>
                <label style={label}>Shop logo (optional, PNG / JPG / WebP, up to 1 MB)</label>
                <input
                  type="file" accept="image/png,image/jpeg,image/webp"
                  onChange={e => setLogoFile(e.target.files?.[0] || null)}
                  style={{ color: '#ccc', fontSize: 13 }}
                />
              </div>
              <button type="submit" disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>Create my shop</button>
            </form>
          ) : (
            <div>
              <p style={{ color: '#e0b13a', fontSize: 13, margin: '0 0 14px' }}>You need an active plan that includes Machine Status.</p>
              <button style={btnPrimary} onClick={() => router.push('/membership')}>View plans</button>
            </div>
          )}
        </div>
        <p style={{ color: '#777', fontSize: 12.5, marginTop: 14 }}>Operators do not log in here. After you create the shop, add them in Shop settings and share their link.</p>
      </>
    )
  }

  // ---------- Owner board ----------
  const { shop, machines, operators, limits, active, parts } = me
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.machinest.in'
  const publicUrl = `${origin}/${shop.slug}`
  const operatorUrl = `${origin}/${shop.slug}/operator`

  return shell(
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {shop.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shop.logo_url} alt="" style={{ width: 46, height: 46, objectFit: 'contain', background: '#fff', borderRadius: 10, padding: 3, boxSizing: 'border-box' }} />
          )}
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{shop.name}</h1>
            <div style={{ color: '#999', fontSize: 12.5, marginTop: 3 }}>Owner · {machines.length} / {limits.machines} machines</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={btnGhost} onClick={() => router.push('/machine-status/reports')}>📊 Reports</button>
          <button style={btnGhost} onClick={() => setShowSettings(s => !s)}>⚙️ Shop settings</button>
          <button style={btnGhost} onClick={() => router.push('/dashboard')}>&larr; Dashboard</button>
        </div>
      </div>

      {!active && (
        <div style={{ background: '#3a2f1a', border: '1px solid #e0b13a', color: '#e0b13a', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 14 }}>
          Your Machine Status subscription has expired. The board is read-only, operators cannot update and your public link is paused.
          <button style={{ ...btnPrimary, marginLeft: 12, padding: '6px 16px', fontSize: 13 }} onClick={() => router.push('/membership')}>Renew</button>
        </div>
      )}

      {showSettings && (
        <div style={{ ...card, marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 24 }}>
          <div>
            <h3 style={{ fontSize: 15, margin: '0 0 12px' }}>Public link (for viewers)</h3>
            <div style={{ background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 8, padding: '10px 12px', fontSize: 13, wordBreak: 'break-all', marginBottom: 8 }}>{publicUrl}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
              <button style={btnGhost} onClick={() => copy(publicUrl)}>Copy link</button>
              <button style={btnGhost} onClick={() => window.open(publicUrl, '_blank')}>Open</button>
              <button style={btnGhost} onClick={() => saveSettings({ public_enabled: !shop.public_enabled }, shop.public_enabled ? 'Public link turned off' : 'Public link turned on')}>
                {shop.public_enabled ? 'Turn link off' : 'Turn link on'}
              </button>
            </div>
            <div style={{ color: shop.public_enabled ? '#2fbf71' : '#ff6b6b', fontSize: 12.5, marginBottom: 14 }}>
              {shop.public_enabled ? '● Link is on' : '● Link is off. Nobody can view it'}
            </div>
            <label style={label}>Current PIN</label>
            <div style={{ fontSize: 20, letterSpacing: 6, fontWeight: 700, marginBottom: 10 }}>{shop.public_pin}</div>
            <label style={label}>Change PIN (4 to 6 digits)</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={inputStyle} value={newPin} inputMode="numeric" maxLength={6} placeholder="New PIN" onChange={e => setNewPin(e.target.value.replace(/\D/g, ''))} />
              <button style={btnGhost} disabled={busy} onClick={async () => {
                if (!PIN_RE.test(newPin)) { flash('PIN must be 4 to 6 digits', false); return }
                if (await saveSettings({ pin: newPin }, 'PIN changed. The old PIN no longer works')) setNewPin('')
              }}>Save</button>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: 15, margin: '0 0 12px' }}>Shop details</h3>
            <label style={label}>Logo</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              {shop.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={shop.logo_url} alt="" style={{ width: 52, height: 52, objectFit: 'contain', background: '#fff', borderRadius: 10, padding: 3, boxSizing: 'border-box' }} />
              ) : (
                <div style={{ width: 52, height: 52, borderRadius: 10, border: '1px dashed #3a3733', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 11 }}>None</div>
              )}
              <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={e => changeLogo(e.target.files?.[0])} />
              <button style={btnGhost} disabled={busy} onClick={() => logoInput.current?.click()}>{shop.logo_url ? 'Change logo' : 'Upload logo'}</button>
              {shop.logo_url && <button style={{ ...btnGhost, borderColor: '#ff6b6b', color: '#ff6b6b' }} onClick={removeLogo}>Remove</button>}
            </div>
            <label style={label}>Shop name</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input style={inputStyle} value={setName} maxLength={60} onChange={e => setSetName(e.target.value)} />
              <button style={btnGhost} disabled={busy} onClick={() => saveSettings({ name: setName }, 'Name saved')}>Save</button>
            </div>
            <label style={label}>Link name</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input style={inputStyle} value={setSlugVal} maxLength={30} onChange={e => setSetSlugVal(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
              <button style={btnGhost} disabled={busy} onClick={() => {
                const err = checkSlug(setSlugVal)
                if (err) { flash(err, false); return }
                saveSettings({ slug: setSlugVal }, 'Link name saved. Share the new links')
              }}>Save</button>
            </div>
            <div style={{ color: '#777', fontSize: 11.5 }}>Changing this changes both the public link and the operator link.</div>
          </div>

          <div>
            <h3 style={{ fontSize: 15, margin: '0 0 12px' }}>Operators ({operators.length} / {limits.operators})</h3>
            <label style={label}>Operator link (same for all operators)</label>
            <div style={{ background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 8, padding: '10px 12px', fontSize: 13, wordBreak: 'break-all', marginBottom: 8 }}>{operatorUrl}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <button style={btnGhost} onClick={() => copy(operatorUrl)}>Copy link</button>
              <button style={btnGhost} onClick={() => window.open(operatorUrl, '_blank')}>Open</button>
            </div>

            {operators.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {operators.map(op => (
                  <div key={op.id} style={{ background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 8, padding: '8px 12px' }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>{op.name}{op.phone ? <span style={{ color: '#888', fontWeight: 400 }}> · {op.phone}</span> : null}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 12 }} onClick={() => resetOperatorPin(op)}>Change PIN</button>
                      <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 12, borderColor: '#ff6b6b', color: '#ff6b6b' }} onClick={() => removeOperator(op)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {operators.length < limits.operators ? (
              <form onSubmit={addOperator} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={label}>Add operator</label>
                <input style={inputStyle} value={opName} maxLength={40} required placeholder="Operator name" onChange={e => setOpName(e.target.value)} />
                <input style={inputStyle} value={opPhone} inputMode="tel" maxLength={15} placeholder="Phone (optional)" onChange={e => setOpPhone(e.target.value.replace(/[^\d+ ]/g, ''))} />
                <input style={inputStyle} value={opPin} inputMode="numeric" maxLength={6} required placeholder="PIN for this operator (4 to 6 digits)" onChange={e => setOpPin(e.target.value.replace(/\D/g, ''))} />
                <button type="submit" disabled={busy} style={{ ...btnGhost, opacity: busy ? 0.6 : 1 }}>+ Add operator</button>
              </form>
            ) : (
              <p style={{ color: '#777', fontSize: 12.5, margin: 0 }}>You have added the maximum of {limits.operators} operators.</p>
            )}
          </div>

          <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #3a3733', paddingTop: 18 }}>
            <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>Part master ({parts.filter(p => p.active).length} active)</h3>
            <p style={{ color: '#999', fontSize: 12.5, margin: '0 0 12px', lineHeight: 1.5 }}>
              Operators pick the part from this list, so the same part is never written in two ways. Only you can add parts. Names that differ only in capital letters or spaces count as the same part.
            </p>
            <form onSubmit={addPart} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <input style={{ ...inputStyle, flex: '2 1 200px' }} value={partName} maxLength={60} required placeholder="Part name / code" onChange={e => setPartName(e.target.value)} />
              <input style={{ ...inputStyle, flex: '1 1 160px' }} value={partCustomer} maxLength={60} placeholder="Customer (optional)" onChange={e => setPartCustomer(e.target.value)} />
              <button type="submit" disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>Add part</button>
            </form>
            {parts.length === 0 ? (
              <p style={{ color: '#777', fontSize: 12.5, margin: 0 }}>No parts yet.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                {parts.map(p => (
                  <div key={p.id} style={{ background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 8, padding: '8px 12px', opacity: p.active ? 1 : 0.55 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, wordBreak: 'break-word' }}>
                      {p.name}{!p.active && <span style={{ color: '#e0b13a', fontWeight: 400 }}> · switched off</span>}
                    </div>
                    {p.customer && <div style={{ color: '#888', fontSize: 12 }}>{p.customer}</div>}
                    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 12 }} onClick={() => renamePart(p)}>Rename</button>
                      <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 12 }} onClick={() => togglePart(p)}>{p.active ? 'Switch off' : 'Switch on'}</button>
                      <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 12, borderColor: '#ff6b6b', color: '#ff6b6b' }} onClick={() => deletePart(p)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>Shifts</h3>
            <p style={{ color: '#999', fontSize: 12.5, margin: '0 0 12px', lineHeight: 1.5 }}>
              Reports count only time inside these shifts. A report day starts when Shift 1 starts.
            </p>
            <label style={label}>Number of shifts</label>
            <select style={{ ...inputStyle, marginBottom: 12 }} value={shiftCount} onChange={e => setShiftCount(Number(e.target.value))}>
              <option value={1}>1 shift</option>
              <option value={2}>2 shifts</option>
              <option value={3}>3 shifts</option>
            </select>
            {shiftRows.slice(0, shiftCount).map((sh, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 110px' }}>
                  <label style={label}>Shift {i + 1} name</label>
                  <input style={inputStyle} value={sh.name} maxLength={20} onChange={e => setShiftRows(rows => rows.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))} />
                </div>
                <div style={{ flex: '1 1 100px' }}>
                  <label style={label}>Starts</label>
                  <input type="time" style={inputStyle} value={sh.start} onChange={e => setShiftRows(rows => rows.map((r, j) => (j === i ? { ...r, start: e.target.value } : r)))} />
                </div>
                <div style={{ flex: '1 1 100px' }}>
                  <label style={label}>Ends</label>
                  <input type="time" style={inputStyle} value={sh.end} onChange={e => setShiftRows(rows => rows.map((r, j) => (j === i ? { ...r, end: e.target.value } : r)))} />
                </div>
              </div>
            ))}
            <button style={{ ...btnPrimary, marginTop: 6, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={saveShifts}>Save shifts</button>
          </div>

          <div>
            <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>Off days</h3>
            <p style={{ color: '#999', fontSize: 12.5, margin: '0 0 12px', lineHeight: 1.5 }}>
              Tap a day to mark it off. Off days are left out when effectiveness is calculated.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 340, marginBottom: 8 }}>
              <button style={{ ...btnGhost, padding: '4px 12px' }} onClick={() => shiftMonth(-1)}>&lsaquo;</button>
              <b style={{ fontSize: 14 }}>{new Date(offMonth + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</b>
              <button style={{ ...btnGhost, padding: '4px 12px' }} onClick={() => shiftMonth(1)}>&rsaquo;</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 5, maxWidth: 340, opacity: offLoaded ? 1 : 0.5 }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} style={{ color: '#888', fontSize: 11, textAlign: 'center' }}>{d}</div>)}
              {Array.from({ length: (new Date(offMonth + '-01T00:00:00').getDay() + 6) % 7 }, (_, i) => <div key={'b' + i} />)}
              {monthDays(offMonth).map(d => {
                const off = offDays.includes(d)
                return (
                  <button
                    key={d}
                    onClick={() => toggleOffDay(d)}
                    style={{ background: off ? '#4a2b2b' : '#33312e', color: off ? '#ff8a8a' : '#ddd', border: `1px solid ${off ? '#ff6b6b' : 'transparent'}`, borderRadius: 6, padding: '7px 0', fontSize: 12.5, cursor: 'pointer' }}
                  >
                    {Number(d.slice(8))}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <button style={btnGhost} onClick={markSundays}>Mark all Sundays</button>
              <button style={btnGhost} onClick={() => setOffDays(list => list.filter(d => !d.startsWith(offMonth + '-')))}>Clear month</button>
              <button style={{ ...btnPrimary, padding: '8px 18px', opacity: busy || !offLoaded ? 0.6 : 1 }} disabled={busy || !offLoaded} onClick={saveOffDays}>Save off days</button>
            </div>
          </div>

          <div style={{ gridColumn: '1 / -1', borderTop: '1px solid #3a3733', paddingTop: 18 }}>
            <h3 style={{ fontSize: 15, margin: '0 0 6px', color: '#ff6b6b' }}>Danger zone</h3>
            <p style={{ color: '#999', fontSize: 12.5, margin: '0 0 12px', lineHeight: 1.5 }}>
              Deleting the shop removes all machines, status history, operators and the logo, and frees the link name. Your subscription stays active, so you can set up a new shop afterwards.
            </p>
            <button
              style={{ background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}
              disabled={busy}
              onClick={deleteShop}
            >
              Delete shop
            </button>
          </div>
        </div>
      )}

      {active && (
        <div style={{ marginBottom: 16 }}>
          <button style={btnGhost} onClick={() => { setShowAdd(s => !s); resetMachineForm() }}>{showAdd ? 'Close' : '+ Add machine'}</button>
          {showAdd && (
            <form onSubmit={addMachine} style={{ ...card, marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {machineFields}
              <button type="submit" disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>Add</button>
            </form>
          )}
        </div>
      )}

      {machines.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#999', fontSize: 14 }}>No machines yet. Use &quot;+ Add machine&quot; to build your grid.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(136px, 1fr))', gap: 12 }}>
          {machines.map(m => <MachineCard key={m.id} machine={m} onClick={() => { setSelected(m); setEditing(false) }} />)}
        </div>
      )}

      {selected && !editing && (
        <StatusModal
          key={selected.id}
          machine={selected}
          parts={parts}
          canEdit={active}
          onClose={() => setSelected(null)}
          onDone={text => { setSelected(null); flash(text); load() }}
          onError={text => flash(text, false)}
          footer={
            <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #3a3733', paddingTop: 12 }}>
              <button style={btnGhost} onClick={startEdit}>Edit machine</button>
              <button style={{ ...btnGhost, borderColor: '#ff6b6b', color: '#ff6b6b' }} onClick={deleteMachine}>Delete</button>
            </div>
          }
        />
      )}

      {selected && editing && (
        <div onClick={() => { setSelected(null); setEditing(false) }} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ ...card, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 18, margin: '0 0 14px' }}>Edit machine</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {machineFields}
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={saveMachineDetails}>Save</button>
                <button style={btnGhost} onClick={() => setEditing(false)}>Back</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
