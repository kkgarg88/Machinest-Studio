'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { MACHINE_TYPES, slugify, checkSlug, PIN_RE } from '@/lib/machineStatus'
import MachineCard, { type CardMachine } from '@/components/machine-status/MachineCard'
import StatusModal from '@/components/machine-status/StatusModal'

type Shop = { id: string; name: string; slug: string; logo_url: string | null; public_enabled: boolean; public_pin: string }
type Operator = { id: string; name: string; phone: string | null; created_at: string }

type Me =
  | { role: null; canCreate: boolean }
  | {
      role: 'owner'
      active: boolean
      shop: Shop
      machines: CardMachine[]
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
    }
  }, [showSettings])

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
      name: fName, machine_no: fNo, machine_type: fType, type_remark: fTypeRemark, part_name: fPart,
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
    setFPart(selected.part_name || '')
    setEditing(true)
  }

  async function saveMachineDetails() {
    if (!selected) return
    setBusy(true)
    const r = await api(`/api/machine-status/machines/${selected.id}`, 'PATCH', {
      name: fName, machine_no: fNo, machine_type: fType, type_remark: fTypeRemark, part_name: fPart,
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
        <label style={label}>Part name</label>
        <input style={inputStyle} value={fPart} maxLength={60} required placeholder="Part being made" onChange={e => setFPart(e.target.value)} />
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
  const { shop, machines, operators, limits, active } = me
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
          {machines.map(m => <MachineCard key={m.id} machine={m} onClick={() => { setSelected(m); setEditing(false) }} />)}
        </div>
      )}

      {selected && !editing && (
        <StatusModal
          key={selected.id}
          machine={selected}
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
