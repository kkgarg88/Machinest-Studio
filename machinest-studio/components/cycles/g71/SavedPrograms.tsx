'use client'
import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bi } from './Bi'

const ORANGE = '#F0801E'
const MAX = 30

type Item = { id: string; name: string; updated_at: string }
type Current = { id: string; name: string; json: string | null } | null
type Msg = { ok: boolean; text: string } | null

function niceError(err: { code?: string; message?: string } | null): string {
  if (!err) return 'Something went wrong'
  if (err.code === '23505') return 'A saved program with this name already exists. Use another name, or load that program and save changes.'
  if (err.code === '42P01' || err.code === 'PGRST205') return 'Saving is not set up yet. Please contact support.'
  if (err.message && /up to 30/.test(err.message)) return 'You can save up to 30 programs. Delete one to save a new program.'
  return `Could not complete this (${err.code || 'error'}). Please try again.`
}

const fmtDate = (s: string) => {
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const btn = { background: 'transparent', border: '1px solid #3a3733', color: '#ddd', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' } as const
const input = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 12px', fontSize: 14 } as const

export default function SavedPrograms({ cycleCode, snapshot, onLoad, onNew }: {
  cycleCode: string
  snapshot: object
  onLoad: (data: unknown) => void
  onNew: () => void
}) {
  const [supabase] = useState(() => createClient())
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [listError, setListError] = useState('')
  const [name, setName] = useState('')
  const [current, setCurrent] = useState<Current>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [askLoad, setAskLoad] = useState<string | null>(null)
  const [askNew, setAskNew] = useState(false)

  const snapJson = JSON.stringify(snapshot)
  const dirty = !!current && current.json !== null && current.json !== snapJson

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('saved_programs')
      .select('id, name, updated_at')
      .eq('cycle_code', cycleCode)
      .order('updated_at', { ascending: false })
    if (error) { setListError(niceError(error)); setItems([]) } else { setListError(''); setItems((data || []) as Item[]) }
    setLoading(false)
  }, [supabase, cycleCode])

  useEffect(() => { refresh() }, [refresh])

  // After a program is loaded the screen settles on its own normalised values; remember them as "saved"
  useEffect(() => {
    if (current && current.json === null) setCurrent({ ...current, json: snapJson })
  }, [current, snapJson])

  function flash(ok: boolean, text: string) { setMsg({ ok, text }) }

  function uniqueName(base: string): string {
    const taken = new Set(items.map(i => i.name.toLowerCase()))
    if (!taken.has(base.toLowerCase())) return base
    for (let n = 1; n < 100; n++) {
      const cand = n === 1 ? `${base} (copy)` : `${base} (copy ${n})`
      if (!taken.has(cand.toLowerCase())) return cand
    }
    return `${base} (${Date.now()})`
  }

  async function save(asNew: boolean) {
    const nm = name.trim()
    if (!nm || busy) return
    setBusy(true); setMsg(null)
    if (current && !asNew) {
      const { error } = await supabase.from('saved_programs').update({ name: nm, data: snapshot }).eq('id', current.id)
      if (error) flash(false, niceError(error))
      else { setCurrent({ id: current.id, name: nm, json: snapJson }); await refresh(); flash(true, 'Saved · सेव हो गया') }
    } else {
      if (items.length >= MAX) { setBusy(false); flash(false, 'You can save up to 30 programs. Delete one to save a new program.'); return }
      const finalName = asNew ? uniqueName(nm) : nm
      const { data, error } = await supabase
        .from('saved_programs')
        .insert({ cycle_code: cycleCode, name: finalName, data: snapshot })
        .select('id, name, updated_at')
        .single()
      if (error || !data) flash(false, niceError(error))
      else { setCurrent({ id: data.id, name: data.name, json: snapJson }); setName(data.name); await refresh(); flash(true, 'Saved · सेव हो गया') }
    }
    setBusy(false)
  }

  async function load(id: string) {
    setAskLoad(null); setBusy(true); setMsg(null)
    const { data, error } = await supabase.from('saved_programs').select('id, name, data').eq('id', id).single()
    if (error || !data) { setBusy(false); flash(false, niceError(error)); return }
    onLoad(data.data)
    setName(data.name)
    setCurrent({ id: data.id, name: data.name, json: null })
    setBusy(false)
    flash(true, 'Loaded · प्रोग्राम खुल गया')
  }

  async function rename(id: string) {
    const nm = renameText.trim()
    if (!nm) return
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('saved_programs').update({ name: nm }).eq('id', id)
    setBusy(false)
    if (error) { flash(false, niceError(error)); return }
    setRenameId(null)
    if (current?.id === id) { setCurrent({ ...current, name: nm }); setName(nm) }
    await refresh()
    flash(true, 'Renamed · नाम बदल गया')
  }

  async function duplicate(id: string) {
    if (items.length >= MAX) { flash(false, 'You can save up to 30 programs. Delete one to save a new program.'); return }
    setBusy(true); setMsg(null)
    const src = items.find(i => i.id === id)
    const { data: row, error: e1 } = await supabase.from('saved_programs').select('data').eq('id', id).single()
    if (e1 || !row) { setBusy(false); flash(false, niceError(e1)); return }
    const { error: e2 } = await supabase.from('saved_programs').insert({ cycle_code: cycleCode, name: uniqueName(src?.name || 'Program'), data: row.data })
    setBusy(false)
    if (e2) { flash(false, niceError(e2)); return }
    await refresh()
    flash(true, 'Copied · कॉपी बन गई')
  }

  async function remove(id: string) {
    setBusy(true); setMsg(null)
    const { error } = await supabase.from('saved_programs').delete().eq('id', id)
    setBusy(false)
    setDeleteId(null)
    if (error) { flash(false, niceError(error)); return }
    if (current?.id === id) setCurrent(null)
    await refresh()
    flash(true, 'Deleted · हटा दिया')
  }

  function startNew() {
    setAskNew(false)
    setCurrent(null); setName(''); setMsg(null)
    onNew()
  }

  const status = current
    ? (dirty ? { c: '#ffb34d', t: 'Unsaved changes · बदलाव सेव नहीं हुए' } : { c: '#2fbf71', t: 'Saved ✓ · सेव है' })
    : { c: '#8a8782', t: 'Not saved yet · अभी सेव नहीं हुआ' }

  return (
    <div style={{ background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
        <h4 style={{ color: '#fff', margin: 0, fontSize: 16 }}><Bi en="My saved G71 programs" hi="मेरे सेव किए G71 प्रोग्राम" /></h4>
        <span style={{ color: '#888', fontSize: 12.5 }}>{items.length}/{MAX}</span>
        <span style={{ flex: 1 }} />
        <span style={{ color: status.c, fontSize: 12.5, fontWeight: 700 }}>{status.t}</span>
      </div>
      <p style={{ color: '#999', fontSize: 12.5, margin: '0 0 12px', lineHeight: 1.5 }}>
        <Bi en="Give the program a name (for example the part number) and press Save. You can load it later, change it and save again."
            hi="प्रोग्राम का नाम दें (जैसे पार्ट नंबर) और Save दबाएँ। बाद में इसे खोलकर बदल सकते हैं और फिर सेव कर सकते हैं।" />
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: '1 1 220px' }}>
          <input style={input} maxLength={80} placeholder="Program name · प्रोग्राम का नाम" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <button onClick={() => save(false)} disabled={!name.trim() || busy}
          style={{ background: name.trim() ? ORANGE : '#4a4744', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: name.trim() && !busy ? 'pointer' : 'not-allowed' }}>
          {current ? 'Save changes · सेव' : 'Save · सेव'}
        </button>
        {current && (
          <button onClick={() => save(true)} disabled={!name.trim() || busy} style={{ ...btn, padding: '10px 14px' }}>Save as new · नया सेव</button>
        )}
        <button onClick={() => (dirty ? setAskNew(true) : startNew())} disabled={busy} style={{ ...btn, padding: '10px 14px' }}>New · नया</button>
      </div>

      {askNew && (
        <div style={{ marginTop: 10, color: '#ffb34d', fontSize: 13, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span>Unsaved changes will be lost. Start a new program? · बदलाव सेव नहीं हैं, नया प्रोग्राम शुरू करें?</span>
          <button style={btn} onClick={startNew}>Yes · हाँ</button>
          <button style={btn} onClick={() => setAskNew(false)}>No · नहीं</button>
        </div>
      )}
      {msg && <div style={{ marginTop: 10, fontSize: 13, color: msg.ok ? '#2fbf71' : '#ff8a8a' }}>{msg.text}</div>}

      <div style={{ marginTop: 14, maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {loading && <div style={{ color: '#888', fontSize: 13 }}>Loading… · खुल रहा है…</div>}
        {!loading && listError && <div style={{ color: '#ff8a8a', fontSize: 13 }}>{listError}</div>}
        {!loading && !listError && items.length === 0 && (
          <div style={{ color: '#777', fontSize: 13 }}><Bi en="No saved programs yet." hi="अभी कोई प्रोग्राम सेव नहीं है।" /></div>
        )}
        {items.map(it => {
          const active = current?.id === it.id
          return (
            <div key={it.id} style={{ background: '#222120', border: `1px solid ${active ? ORANGE : '#3a3733'}`, borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {renameId === it.id ? (
                  <>
                    <input style={{ ...input, flex: '1 1 160px', padding: '7px 10px' }} maxLength={80} value={renameText} autoFocus
                      onChange={e => setRenameText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') rename(it.id); if (e.key === 'Escape') setRenameId(null) }} />
                    <button style={btn} onClick={() => rename(it.id)} disabled={!renameText.trim() || busy}>OK · ठीक</button>
                    <button style={btn} onClick={() => setRenameId(null)}>✕</button>
                  </>
                ) : (
                  <>
                    <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}{active ? ' •' : ''}</div>
                      <div style={{ color: '#888', fontSize: 11.5 }}>{fmtDate(it.updated_at)}</div>
                    </div>
                    <button style={{ ...btn, borderColor: ORANGE, color: '#FFB34D' }} disabled={busy}
                      onClick={() => (dirty && !active ? setAskLoad(it.id) : load(it.id))}>Load · खोलें</button>
                    <button style={btn} disabled={busy} onClick={() => { setRenameId(it.id); setRenameText(it.name) }}>Rename · नाम बदलें</button>
                    <button style={btn} disabled={busy} onClick={() => duplicate(it.id)}>Copy · कॉपी</button>
                    <button style={{ ...btn, color: '#ff8a8a' }} disabled={busy} onClick={() => setDeleteId(it.id)}>Delete · हटाएँ</button>
                  </>
                )}
              </div>
              {askLoad === it.id && (
                <div style={{ marginTop: 8, color: '#ffb34d', fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>Unsaved changes will be lost. Load anyway? · बदलाव सेव नहीं हैं, फिर भी खोलें?</span>
                  <button style={btn} onClick={() => load(it.id)}>Yes · हाँ</button>
                  <button style={btn} onClick={() => setAskLoad(null)}>No · नहीं</button>
                </div>
              )}
              {deleteId === it.id && (
                <div style={{ marginTop: 8, color: '#ff8a8a', fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>Delete “{it.name}”? This cannot be undone. · “{it.name}” हटाएँ? यह वापस नहीं आएगा।</span>
                  <button style={{ ...btn, color: '#ff8a8a', borderColor: '#ff8a8a' }} onClick={() => remove(it.id)}>Yes, delete · हाँ, हटाएँ</button>
                  <button style={btn} onClick={() => setDeleteId(null)}>No · नहीं</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
