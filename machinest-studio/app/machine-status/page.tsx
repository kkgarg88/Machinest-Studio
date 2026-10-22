'use client'
import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  STATUSES, MACHINE_ICONS, statusInfo, iconEmoji, formatSince, slugify, checkSlug, PIN_RE,
} from '@/lib/machineStatus'

type Machine = {
  id: string
  name: string
  machine_no: string | null
  icon: string
  status: string
  remark: string | null
  status_since: string
  updated_at: string
  updated_by_name: string | null
}

type Shop = {
  id: string
  name: string
  slug: string
  public_enabled: boolean
  public_pin?: string
  join_code?: string
}

type Me =
  | { role: null; canCreate: boolean }
  | {
      role: 'owner' | 'operator'
      active: boolean
      shop: Shop
      machines: Machine[]
      members: { id: string; name: string; created_at: string }[]
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

export default function MachineStatusPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [me, setMe] = useState<Me | null>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [, setTick] = useState(0)

  // setup forms
  const [shopName, setShopName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [pin, setPin] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)

  // board state
  const [selected, setSelected] = useState<Machine | null>(null)
  const [editStatus, setEditStatus] = useState('idle')
  const [editRemark, setEditRemark] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newName, setNewName] = useState('')
  const [newNo, setNewNo] = useState('')
  const [newIcon, setNewIcon] = useState('lathe')
  const [showSettings, setShowSettings] = useState(false)
  const [setName, setSetName] = useState('')
  const [setSlugVal, setSetSlugVal] = useState('')
  const [newPin, setNewPin] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [renameName, setRenameName] = useState('')
  const [renameNo, setRenameNo] = useState('')
  const [renameIcon, setRenameIcon] = useState('other')

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
    const clock = setInterval(() => setTick(t => t + 1), 30000)
    return () => { clearInterval(poll); clearInterval(clock) }
  }, [])

  // keep settings fields in step with the shop when the panel opens
  useEffect(() => {
    if (showSettings && me && me.role === 'owner') {
      setSetName(me.shop.name)
      setSetSlugVal(me.shop.slug)
      setNewPin('')
    }
  }, [showSettings])

  async function createShop(e: React.FormEvent) {
    e.preventDefault()
    const slugError = checkSlug(slug)
    if (slugError) { flash(slugError, false); return }
    if (!PIN_RE.test(pin)) { flash('PIN must be 4 to 6 digits', false); return }
    setBusy(true)
    const r = await api('/api/machine-status/shop', 'POST', { name: shopName, slug, pin })
    setBusy(false)
    if (!r.ok) { flash(r.data.error || 'Could not create shop', false); return }
    flash('Your shop is ready')
    load()
  }

  async function joinShop(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const r = await api('/api/machine-status/join', 'POST', { code: joinCode })
    setBusy(false)
    if (!r.ok) { flash(r.data.error || 'Could not join', false); return }
    flash(`Joined ${r.data.shopName}`)
    load()
  }

  function openMachine(m: Machine) {
    setSelected(m)
    setEditStatus(m.status)
    setEditRemark(m.remark || '')
    setRenaming(false)
    setRenameName(m.name)
    setRenameNo(m.machine_no || '')
    setRenameIcon(m.icon)
  }

  async function saveStatus() {
    if (!selected) return
    if (editStatus === 'other' && !editRemark.trim()) { flash('Please write a remark for "Other"', false); return }
    setBusy(true)
    const r = await api(`/api/machine-status/machines/${selected.id}/status`, 'POST', { status: editStatus, remark: editRemark })
    setBusy(false)
    if (!r.ok) { flash(r.data.error || 'Could not update', false); return }
    setSelected(null)
    flash('Status updated')
    load()
  }

  async function addMachine(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const r = await api('/api/machine-status/machines', 'POST', { name: newName, machine_no: newNo, icon: newIcon })
    setBusy(false)
    if (!r.ok) { flash(r.data.error || 'Could not add machine', false); return }
    setNewName(''); setNewNo('')
    flash('Machine added')
    load()
  }

  async function saveMachineDetails() {
    if (!selected) return
    setBusy(true)
    const r = await api(`/api/machine-status/machines/${selected.id}`, 'PATCH', { name: renameName, machine_no: renameNo, icon: renameIcon })
    setBusy(false)
    if (!r.ok) { flash(r.data.error || 'Could not save', false); return }
    setSelected(null)
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
    setSelected(null)
    flash('Machine deleted')
    load()
  }

  async function saveSettings(fields: Record<string, unknown>, okText: string) {
    setBusy(true)
    const r = await api('/api/machine-status/shop', 'PATCH', fields)
    setBusy(false)
    if (!r.ok) { flash(r.data.error || 'Could not save', false); return }
    flash(okText)
    load()
  }

  async function removeMember(id: string, name: string) {
    if (!confirm(`Remove ${name} from your shop? They will no longer be able to update status.`)) return
    const r = await api(`/api/machine-status/members?memberId=${id}`, 'DELETE')
    if (!r.ok) { flash(r.data.error || 'Could not remove', false); return }
    flash('Operator removed')
    load()
  }

  async function leaveShop() {
    if (!confirm('Leave this shop? You will need a new join code to come back.')) return
    const r = await api('/api/machine-status/members?leave=1', 'DELETE')
    if (!r.ok) { flash(r.data.error || 'Could not leave', false); return }
    load()
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text).then(() => flash('Copied'), () => flash('Could not copy', false))
  }

  const shell = (children: React.ReactNode) => (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #262421 0%, #302d29 100%)', fontFamily: 'Segoe UI, sans-serif', padding: '24px 16px', color: '#fff' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        {msg && (
          <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 50, background: msg.ok ? '#1f2e22' : '#3a2222', border: `1px solid ${msg.ok ? '#2fbf71' : '#ff6b6b'}`, color: msg.ok ? '#2fbf71' : '#ff6b6b', borderRadius: 8, padding: '10px 18px', fontSize: 14 }}>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          <div style={card}>
            <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>I am the shop owner</h2>
            <p style={{ color: '#999', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>
              Set up your shop board: up to 100 machines, 3 operator logins and a PIN-protected public link.
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
                  <input
                    style={inputStyle} value={pin} inputMode="numeric" maxLength={6} required placeholder="e.g. 4827"
                    onChange={e => setPin(e.target.value.replace(/\D/g, ''))}
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

          <div style={card}>
            <h2 style={{ fontSize: 17, margin: '0 0 6px' }}>I am an operator</h2>
            <p style={{ color: '#999', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>
              Ask your shop owner for the join code. You can then update machine status from your phone.
            </p>
            <form onSubmit={joinShop} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={label}>Join code</label>
                <input
                  style={{ ...inputStyle, letterSpacing: 4, textTransform: 'uppercase' }} value={joinCode} maxLength={12} required placeholder="ABCD2345"
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                />
              </div>
              <button type="submit" disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>Join shop</button>
            </form>
          </div>
        </div>
      </>
    )
  }

  // ---------- Board ----------
  const isOwner = me.role === 'owner'
  const { shop, machines, members, limits, active } = me
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.machinest.in'
  const publicUrl = `${origin}/${shop.slug}`
  const canEdit = active

  return shell(
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>📟 {shop.name}</h1>
          <div style={{ color: '#999', fontSize: 12.5, marginTop: 3 }}>
            {isOwner ? 'Owner' : 'Operator'} · {machines.length} / {limits.machines} machines
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {isOwner && <button style={btnGhost} onClick={() => setShowSettings(s => !s)}>⚙️ Shop settings</button>}
          {!isOwner && <button style={btnGhost} onClick={leaveShop}>Leave shop</button>}
          <button style={btnGhost} onClick={() => router.push('/dashboard')}>&larr; Dashboard</button>
        </div>
      </div>

      {!active && (
        <div style={{ background: '#3a2f1a', border: '1px solid #e0b13a', color: '#e0b13a', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 14 }}>
          {isOwner
            ? 'Your Machine Status subscription has expired. The board is read-only and your public link is paused.'
            : 'The shop owner\'s subscription has expired. You can view machines but cannot update status.'}
          {isOwner && <button style={{ ...btnPrimary, marginLeft: 12, padding: '6px 16px', fontSize: 13 }} onClick={() => router.push('/membership')}>Renew</button>}
        </div>
      )}

      {/* Owner settings */}
      {isOwner && showSettings && (
        <div style={{ ...card, marginBottom: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          <div>
            <h3 style={{ fontSize: 15, margin: '0 0 12px' }}>Public link</h3>
            <div style={{ background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 8, padding: '10px 12px', fontSize: 13, wordBreak: 'break-all', marginBottom: 8 }}>{publicUrl}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
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
              <button style={btnGhost} disabled={busy} onClick={() => {
                if (!PIN_RE.test(newPin)) { flash('PIN must be 4 to 6 digits', false); return }
                saveSettings({ pin: newPin }, 'PIN changed. Old PIN no longer works').then(() => setNewPin(''))
              }}>Save</button>
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: 15, margin: '0 0 12px' }}>Shop details</h3>
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
                saveSettings({ slug: setSlugVal }, 'Link name saved. Share the new link')
              }}>Save</button>
            </div>
            <div style={{ color: '#777', fontSize: 11.5 }}>Changing this changes your public link.</div>
          </div>

          <div>
            <h3 style={{ fontSize: 15, margin: '0 0 12px' }}>Operators ({members.length} / {limits.operators})</h3>
            <label style={label}>Join code for operators</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 20, letterSpacing: 4, fontWeight: 700 }}>{shop.join_code}</span>
              <button style={btnGhost} onClick={() => copy(shop.join_code || '')}>Copy</button>
            </div>
            <button style={{ ...btnGhost, marginBottom: 14 }} disabled={busy} onClick={() => {
              if (confirm('Make a new join code? The old code stops working. Existing operators stay.')) saveSettings({ regenerate_join_code: true }, 'New join code created')
            }}>New code</button>
            {members.length === 0 ? (
              <p style={{ color: '#777', fontSize: 13, margin: 0 }}>No operators yet. Share the join code with your operators.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {members.map(mem => (
                  <div key={mem.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 8, padding: '8px 12px' }}>
                    <span style={{ fontSize: 13.5 }}>{mem.name}</span>
                    <button style={{ ...btnGhost, padding: '4px 10px', fontSize: 12, borderColor: '#ff6b6b', color: '#ff6b6b' }} onClick={() => removeMember(mem.id, mem.name)}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Owner: add machine */}
      {isOwner && canEdit && (
        <div style={{ marginBottom: 16 }}>
          <button style={btnGhost} onClick={() => setShowAdd(s => !s)}>{showAdd ? 'Close' : '+ Add machine'}</button>
          {showAdd && (
            <form onSubmit={addMachine} style={{ ...card, marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div style={{ flex: '2 1 180px' }}>
                <label style={label}>Machine name</label>
                <input style={inputStyle} value={newName} maxLength={40} required placeholder="e.g. Doosan Puma" onChange={e => setNewName(e.target.value)} />
              </div>
              <div style={{ flex: '1 1 100px' }}>
                <label style={label}>Number (optional)</label>
                <input style={inputStyle} value={newNo} maxLength={30} placeholder="e.g. 12" onChange={e => setNewNo(e.target.value)} />
              </div>
              <div style={{ flex: '1 1 160px' }}>
                <label style={label}>Type</label>
                <select style={inputStyle} value={newIcon} onChange={e => setNewIcon(e.target.value)}>
                  {MACHINE_ICONS.map(i => <option key={i.key} value={i.key}>{i.emoji} {i.label}</option>)}
                </select>
              </div>
              <button type="submit" disabled={busy} style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }}>Add</button>
            </form>
          )}
        </div>
      )}

      {/* Grid */}
      {machines.length === 0 ? (
        <div style={{ ...card, textAlign: 'center', color: '#999', fontSize: 14 }}>
          {isOwner ? 'No machines yet. Use "+ Add machine" to build your grid.' : 'The owner has not added any machines yet.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
          {machines.map(m => {
            const st = statusInfo(m.status)
            return (
              <div
                key={m.id}
                onClick={() => openMachine(m)}
                style={{ background: '#2b2a28', border: `2px solid ${st.color}`, borderRadius: 12, padding: 14, cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 22 }}>{iconEmoji(m.icon)}</span>
                  {m.machine_no && <span style={{ color: '#999', fontSize: 11.5, fontWeight: 600 }}>#{m.machine_no}</span>}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, margin: '8px 0', wordBreak: 'break-word' }}>{m.name}</div>
                <span style={{ display: 'inline-block', background: st.color, color: '#111', fontWeight: 800, fontSize: 11.5, padding: '3px 10px', borderRadius: 10 }}>{st.label}</span>
                {m.remark && <div style={{ color: '#ccc', fontSize: 12.5, marginTop: 8, lineHeight: 1.4, wordBreak: 'break-word' }}>{m.remark}</div>}
                <div style={{ color: '#888', fontSize: 11.5, marginTop: 8 }}>
                  for {formatSince(m.status_since)}{m.updated_by_name ? ` · ${m.updated_by_name}` : ''}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Update / manage modal */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div onClick={e => e.stopPropagation()} style={{ ...card, width: '100%', maxWidth: 400, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 18, margin: 0 }}>{iconEmoji(selected.icon)} {selected.name}{selected.machine_no ? ` #${selected.machine_no}` : ''}</h2>
              <button style={{ ...btnGhost, padding: '4px 10px' }} onClick={() => setSelected(null)}>✕</button>
            </div>

            {!canEdit ? (
              <p style={{ color: '#e0b13a', fontSize: 14, margin: 0 }}>The subscription has expired, so this machine is read-only.</p>
            ) : renaming ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div><label style={label}>Machine name</label><input style={inputStyle} value={renameName} maxLength={40} onChange={e => setRenameName(e.target.value)} /></div>
                <div><label style={label}>Number</label><input style={inputStyle} value={renameNo} maxLength={30} onChange={e => setRenameNo(e.target.value)} /></div>
                <div>
                  <label style={label}>Type</label>
                  <select style={inputStyle} value={renameIcon} onChange={e => setRenameIcon(e.target.value)}>
                    {MACHINE_ICONS.map(i => <option key={i.key} value={i.key}>{i.emoji} {i.label}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={btnPrimary} disabled={busy} onClick={saveMachineDetails}>Save</button>
                  <button style={btnGhost} onClick={() => setRenaming(false)}>Back</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={label}>Status</label>
                  <select style={{ ...inputStyle, borderColor: statusInfo(editStatus).color }} value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                    {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={label}>Remark {editStatus === 'other' ? '(required)' : '(optional, e.g. job or part name)'}</label>
                  <textarea style={{ ...inputStyle, fontFamily: 'inherit' }} rows={3} maxLength={200} value={editRemark} onChange={e => setEditRemark(e.target.value)} />
                </div>
                <button style={{ ...btnPrimary, opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={saveStatus}>Update status</button>

                {isOwner && (
                  <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #3a3733', paddingTop: 12 }}>
                    <button style={btnGhost} onClick={() => setRenaming(true)}>Edit machine</button>
                    <button style={{ ...btnGhost, borderColor: '#ff6b6b', color: '#ff6b6b' }} onClick={deleteMachine}>Delete</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
