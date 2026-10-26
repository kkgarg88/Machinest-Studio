'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 20 } as const
const inputStyle = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' } as const
const btnPrimary = { background: '#F0801E', color: '#fff', border: 'none', borderRadius: 6, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' } as const
const btnGhost = { background: 'transparent', border: '1px solid #3a3733', color: '#ddd', borderRadius: 6, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const
const DESC_MAX = 200

type CycleRow = { id: string; tool_id: string; code: string; name: string; thumbnail_url: string | null; description: string | null }
type Group = { tool: { id: string; name: string; slug: string }; cycles: CycleRow[] }

export default function AdminCycleMediaPage() {
  const router = useRouter()
  const supabase = createClient()
  const [checking, setChecking] = useState(true)
  const [groups, setGroups] = useState<Group[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
      if (!profile?.is_admin) { router.push('/dashboard'); return }
      setChecking(false)
      load()
    }
    check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load() {
    const res = await fetch('/api/admin/cycle-media').then(r => r.json()).catch(() => ({ groups: [] }))
    const g: Group[] = res.groups || []
    setGroups(g)
    const d: Record<string, string> = {}
    g.forEach(x => x.cycles.forEach(c => { d[c.id] = c.description || '' }))
    setDrafts(d)
  }

  function flash(text: string) { setMsg(text); setTimeout(() => setMsg(''), 2500) }

  async function upload(c: CycleRow, file: File | undefined) {
    if (!file) return
    setBusyId(c.id)
    const fd = new FormData()
    fd.append('cycleId', c.id)
    fd.append('file', file)
    const res = await fetch('/api/admin/cycle-media', { method: 'POST', body: fd })
    const data = await res.json().catch(() => ({}))
    setBusyId('')
    if (!res.ok) { flash(data.error || 'Upload failed'); return }
    flash(`${c.code}: thumbnail saved`)
    setGroups(gs => gs.map(g => ({ ...g, cycles: g.cycles.map(x => (x.id === c.id ? { ...x, thumbnail_url: data.url } : x)) })))
  }

  async function removeThumb(c: CycleRow) {
    if (!window.confirm(`Remove the thumbnail of ${c.code}?`)) return
    setBusyId(c.id)
    const res = await fetch('/api/admin/cycle-media', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cycleId: c.id }) })
    const data = await res.json().catch(() => ({}))
    setBusyId('')
    if (!res.ok) { flash(data.error || 'Could not remove'); return }
    flash(`${c.code}: thumbnail removed`)
    setGroups(gs => gs.map(g => ({ ...g, cycles: g.cycles.map(x => (x.id === c.id ? { ...x, thumbnail_url: null } : x)) })))
  }

  async function saveDesc(c: CycleRow) {
    setBusyId(c.id)
    const res = await fetch('/api/admin/cycle-media', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cycleId: c.id, description: drafts[c.id] || '' }) })
    const data = await res.json().catch(() => ({}))
    setBusyId('')
    if (!res.ok) { flash(data.error || 'Could not save'); return }
    flash(`${c.code}: description saved`)
    setGroups(gs => gs.map(g => ({ ...g, cycles: g.cycles.map(x => (x.id === c.id ? { ...x, description: (drafts[c.id] || '').trim() || null } : x)) })))
  }

  if (checking) {
    return <div style={{ minHeight: '100vh', background: '#262421', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, sans-serif' }}>Loading...</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: '#262421', fontFamily: 'Segoe UI, sans-serif', color: '#fff' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 32px', background: '#211f1d', borderBottom: '2px solid #F0801E' }}>
        <span style={{ fontSize: 19, fontWeight: 800 }}>Cycle thumbnails <span style={{ color: '#F0801E' }}>and descriptions</span></span>
        <button onClick={() => router.push('/admin')} style={btnPrimary}>← Admin</button>
      </header>

      <div style={{ padding: '32px 40px', maxWidth: 1000, margin: '0 auto' }}>
        <p style={{ color: '#999', fontSize: 14, margin: '0 0 8px', lineHeight: 1.6 }}>
          Upload one picture for each cycle. It replaces the small icon on the cycle tile in Turning Studio and Milling Studio.
          Best size is 800 × 500 pixels (16:10), PNG, JPG or WebP, up to 2 MB. The brief description appears under the cycle name (up to {DESC_MAX} characters).
        </p>
        {msg && <p style={{ color: '#2fbf71', fontSize: 14, fontWeight: 600, margin: '8px 0' }}>{msg}</p>}

        {groups.map(g => (
          <div key={g.tool.id} style={{ marginTop: 28 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 800 }}>{g.tool.name}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {g.cycles.map(c => {
                const busy = busyId === c.id
                const dirty = (drafts[c.id] || '').trim() !== (c.description || '')
                return (
                  <div key={c.id} style={{ ...card, display: 'flex', gap: 18, flexWrap: 'wrap', opacity: busy ? 0.7 : 1 }}>
                    <div style={{ width: 200, flexShrink: 0 }}>
                      <div style={{ width: 200, aspectRatio: '16 / 10', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 8, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 12 }}>
                        {c.thumbnail_url
                          ? <img src={c.thumbnail_url} alt={c.code} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : 'No thumbnail'}
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <label style={{ ...btnPrimary, flex: 1, textAlign: 'center', cursor: busy ? 'not-allowed' : 'pointer' }}>
                          {c.thumbnail_url ? 'Replace' : 'Upload'}
                          <input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} style={{ display: 'none' }}
                            onChange={e => { upload(c, e.target.files?.[0]); e.target.value = '' }} />
                        </label>
                        {c.thumbnail_url && <button type="button" disabled={busy} onClick={() => removeThumb(c)} style={btnGhost}>Remove</button>}
                      </div>
                    </div>
                    <div style={{ flex: '1 1 300px', minWidth: 0 }}>
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ color: '#F0801E', fontFamily: 'Consolas, monospace', fontWeight: 800, fontSize: 13, marginRight: 8 }}>{c.code}</span>
                        <span style={{ fontWeight: 700 }}>{c.name}</span>
                      </div>
                      <textarea rows={3} maxLength={DESC_MAX} style={inputStyle} placeholder="Brief description of this cycle"
                        value={drafts[c.id] ?? ''} onChange={e => setDrafts(d => ({ ...d, [c.id]: e.target.value }))} />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                        <button type="button" disabled={busy || !dirty} onClick={() => saveDesc(c)} style={{ ...btnPrimary, opacity: dirty ? 1 : 0.5 }}>Save description</button>
                        <span style={{ color: '#777', fontSize: 12 }}>{(drafts[c.id] || '').length} / {DESC_MAX}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
