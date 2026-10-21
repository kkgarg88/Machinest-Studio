'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 24 } as const
const inputStyle = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 12px', fontSize: 14 } as const
const labelStyle = { display: 'block', fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600 } as const
const btnPrimary = { background: '#F0801E', color: '#fff', border: 'none', borderRadius: 6, padding: '10px 18px', fontSize: 14, fontWeight: 700, cursor: 'pointer' } as const
const btnGhost = { background: 'transparent', border: '1px solid #3a3733', color: '#ddd', borderRadius: 6, padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer' } as const

type ResourceType = 'video' | 'pdf' | 'excel' | 'calculator' | 'link'

type Resource = {
  id: string
  title: string
  description: string | null
  resource_type: ResourceType
  url: string
  category: string | null
  thumbnail_url: string | null
  display_order: number
  active: boolean
  created_at: string
}

type ToolCycle = { id: string; code: string; name: string; tool_id: string; isFree: boolean }
type ToolGroup = { tool: { id: string; name: string; slug: string }; cycles: ToolCycle[] }

const TYPE_LABEL: Record<ResourceType, string> = {
  video: 'Video',
  pdf: 'PDF',
  excel: 'Excel Sheet',
  calculator: 'Web Tool',
  link: 'Link',
}

const EMPTY_FORM = { title: '', description: '', resource_type: 'video' as ResourceType, url: '', category: '', thumbnail_url: '', display_order: '0' }

export default function AdminResourcesPage() {
  const router = useRouter()
  const supabase = createClient()

  const [checking, setChecking] = useState(true)
  const [resources, setResources] = useState<Resource[]>([])
  const [toolGroups, setToolGroups] = useState<ToolGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle()
      if (!profile?.is_admin) { router.push('/dashboard'); return }
      setChecking(false)
      loadAll()
    }
    check()
  }, [])

  async function loadAll() {
    setLoading(true)
    const [rRes, fRes] = await Promise.all([
      fetch('/api/admin/resources').then(r => r.json()).catch(() => ({ resources: [] })),
      fetch('/api/admin/free-cycles').then(r => r.json()).catch(() => ({ tools: [] })),
    ])
    setResources(rRes.resources || [])
    setToolGroups(fRes.tools || [])
    setLoading(false)
  }

  function flash(text: string) {
    setMsg(text)
    setTimeout(() => setMsg(''), 2500)
  }

  async function submitResource() {
    if (!form.title.trim() || !form.url.trim()) { flash('Title and URL are required'); return }
    setBusy(true)
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      resource_type: form.resource_type,
      url: form.url.trim(),
      category: form.category.trim() || null,
      thumbnail_url: form.thumbnail_url.trim() || null,
      display_order: Number(form.display_order) || 0,
    }

    const res = editingId
      ? await fetch(`/api/admin/resources/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      : await fetch('/api/admin/resources', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { flash(data.error || 'Something went wrong'); return }

    setForm(EMPTY_FORM)
    setEditingId(null)
    flash(editingId ? 'Resource updated' : 'Resource added')
    loadAll()
  }

  function startEdit(r: Resource) {
    setEditingId(r.id)
    setForm({
      title: r.title,
      description: r.description || '',
      resource_type: r.resource_type,
      url: r.url,
      category: r.category || '',
      thumbnail_url: r.thumbnail_url || '',
      display_order: String(r.display_order),
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  async function toggleActive(r: Resource) {
    await fetch(`/api/admin/resources/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !r.active }) })
    loadAll()
  }

  async function deleteResource(r: Resource) {
    if (!confirm(`Delete "${r.title}"? This cannot be undone.`)) return
    await fetch(`/api/admin/resources/${r.id}`, { method: 'DELETE' })
    flash('Resource deleted')
    loadAll()
  }

  async function setFreeCycle(toolId: string, cycleId: string | null) {
    setBusy(true)
    const res = await fetch('/api/admin/free-cycles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toolId, cycleId }),
    })
    setBusy(false)
    if (!res.ok) { flash('Could not update free cycle'); return }
    flash('Free cycle updated')
    loadAll()
  }

  if (checking) {
    return <div style={{ minHeight: '100vh', background: '#262421', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, sans-serif' }}>Checking access...</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #262421 0%, #302d29 100%)', fontFamily: 'Segoe UI, sans-serif', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ color: '#fff', fontSize: 24, fontWeight: 800, margin: 0 }}>Resources &amp; Free Cycles</h1>
          <button onClick={() => router.push('/admin')} style={btnGhost}>&larr; Back to Admin</button>
        </div>

        {msg && (
          <div style={{ background: '#1f2e22', border: '1px solid #2fbf71', color: '#2fbf71', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 14 }}>
            {msg}
          </div>
        )}

        {/* FREE CYCLE PICKER */}
        <div style={{ ...card, marginBottom: 28 }}>
          <h2 style={{ color: '#fff', fontSize: 18, margin: '0 0 6px' }}>Free Cycle (one per tool)</h2>
          <p style={{ color: '#999', fontSize: 13, margin: '0 0 18px' }}>
            Pick exactly one cycle per tool that every signed-up user can use for free. Change it anytime — no SQL needed.
          </p>
          {loading ? (
            <p style={{ color: '#999' }}>Loading...</p>
          ) : toolGroups.length === 0 ? (
            <p style={{ color: '#999' }}>No tools found yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {toolGroups.map(group => (
                <div key={group.tool.id}>
                  <div style={{ color: '#F0801E', fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{group.tool.name}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    <label style={{
                      display: 'flex', alignItems: 'center', gap: 8, background: '#1c1b19',
                      border: `1px solid ${!group.cycles.some(c => c.isFree) ? '#F0801E' : '#3a3733'}`,
                      borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#ccc', cursor: 'pointer',
                    }}>
                      <input
                        type="radio"
                        name={`free-${group.tool.id}`}
                        checked={!group.cycles.some(c => c.isFree)}
                        onChange={() => setFreeCycle(group.tool.id, null)}
                        disabled={busy}
                      />
                      None
                    </label>
                    {group.cycles.map(c => (
                      <label key={c.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8, background: '#1c1b19',
                        border: `1px solid ${c.isFree ? '#F0801E' : '#3a3733'}`,
                        borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#ccc', cursor: 'pointer',
                      }}>
                        <input
                          type="radio"
                          name={`free-${group.tool.id}`}
                          checked={c.isFree}
                          onChange={() => setFreeCycle(group.tool.id, c.id)}
                          disabled={busy}
                        />
                        <span style={{ color: '#F0801E', fontFamily: 'Consolas, monospace', fontWeight: 700 }}>{c.code}</span> {c.name}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ADD / EDIT RESOURCE */}
        <div style={card}>
          <h2 style={{ color: '#fff', fontSize: 18, margin: '0 0 18px' }}>{editingId ? 'Edit Resource' : 'Add Resource'}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Title</label>
              <input style={inputStyle} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Tapping Chart (Metric)" />
            </div>
            <div>
              <label style={labelStyle}>Type</label>
              <select style={inputStyle} value={form.resource_type} onChange={e => setForm({ ...form, resource_type: e.target.value as ResourceType })}>
                <option value="video">Video</option>
                <option value="pdf">PDF</option>
                <option value="excel">Excel Sheet</option>
                <option value="calculator">Web Tool / Calculator</option>
                <option value="link">Link</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>URL</label>
            <input style={inputStyle} value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://... (YouTube link, Supabase Storage file link, Drive link, etc.)" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Thumbnail image URL (optional)</label>
            <input style={inputStyle} value={form.thumbnail_url} onChange={e => setForm({ ...form, thumbnail_url: e.target.value })} placeholder="https://... image link. YouTube videos: leave blank, thumbnail is automatic" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Description (optional)</label>
            <input style={inputStyle} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Short line shown under the title" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
            <div>
              <label style={labelStyle}>Category (optional)</label>
              <input style={inputStyle} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="e.g. Turning, General" />
            </div>
            <div>
              <label style={labelStyle}>Display Order</label>
              <input style={inputStyle} type="number" value={form.display_order} onChange={e => setForm({ ...form, display_order: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={btnPrimary} disabled={busy} onClick={submitResource}>
              {busy ? 'Saving...' : editingId ? 'Save Changes' : 'Add Resource'}
            </button>
            {editingId && <button style={btnGhost} onClick={cancelEdit}>Cancel</button>}
          </div>
        </div>

        {/* RESOURCE LIST */}
        <div style={{ ...card, marginTop: 24 }}>
          <h2 style={{ color: '#fff', fontSize: 18, margin: '0 0 18px' }}>All Resources</h2>
          {loading ? (
            <p style={{ color: '#999' }}>Loading...</p>
          ) : resources.length === 0 ? (
            <p style={{ color: '#999' }}>No resources yet. Add one above.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {resources.map(r => (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 8, padding: '12px 16px', flexWrap: 'wrap', gap: 10,
                }}>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
                      {r.title} <span style={{ color: '#777', fontWeight: 600, fontSize: 11, marginLeft: 8 }}>{TYPE_LABEL[r.resource_type]}</span>
                      {!r.active && <span style={{ color: '#ff6b6b', fontWeight: 600, fontSize: 11, marginLeft: 8 }}>Hidden</span>}
                    </div>
                    {r.category && <div style={{ color: '#999', fontSize: 12, marginTop: 2 }}>{r.category}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={btnGhost} onClick={() => toggleActive(r)}>{r.active ? 'Hide' : 'Show'}</button>
                    <button style={btnGhost} onClick={() => startEdit(r)}>Edit</button>
                    <button style={{ ...btnGhost, borderColor: '#ff6b6b', color: '#ff6b6b' }} onClick={() => deleteResource(r)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
