'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const card = { background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 24 } as const
const inputStyle = { width: '100%', background: '#1c1b19', border: '1px solid #3a3733', borderRadius: 6, color: '#fff', padding: '10px 12px', fontSize: 14 } as const
const labelStyle = { display: 'block', fontSize: 13, color: '#ccc', marginBottom: 6, fontWeight: 600 } as const
const btnPrimary = { background: '#F0801E', color: '#fff', border: 'none', borderRadius: 6, padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer' } as const
const btnGhost = { background: 'transparent', border: '1px solid #3a3733', color: '#ddd', borderRadius: 6, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' } as const

type ResumeRow = {
  id: string
  file_path: string
  file_name: string
  file_size: number | null
  job_interest: string | null
  preferred_location: string | null
  consent: boolean
  updated_at: string
}

const MAX_BYTES = 5 * 1024 * 1024
const TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
}
const INTERESTS = [
  'CNC Operator',
  'CNC Setter',
  'CNC Programmer',
  'Supervisor / Engineer',
  'Quality / Inspection',
  'Other',
]

export default function ResumePage() {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [userId, setUserId] = useState<string | null>(null)
  const [resume, setResume] = useState<ResumeRow | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [jobInterest, setJobInterest] = useState('')
  const [location, setLocation] = useState('')
  const [consent, setConsent] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }
      setUserId(user.id)

      const { data } = await supabase.from('resumes').select('*').eq('user_id', user.id).maybeSingle()
      if (data) {
        setResume(data as ResumeRow)
        setJobInterest(data.job_interest || '')
        setLocation(data.preferred_location || '')
        setConsent(!!data.consent)
      }
      setLoading(false)
    }
    load()
  }, [])

  function flash(text: string, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  async function save() {
    if (!userId) return
    if (!consent) { flash('Please tick the consent box to continue.', false); return }
    if (!resume && !file) { flash('Please choose your resume file.', false); return }

    let filePath = resume?.file_path ?? ''
    let fileName = resume?.file_name ?? ''
    let fileSize: number | null = resume?.file_size ?? null
    let oldPath: string | null = null

    setBusy(true)

    if (file) {
      const ext = (file.name.split('.').pop() || '').toLowerCase()
      if (!TYPES[ext]) { setBusy(false); flash('Only PDF, DOC or DOCX files are allowed.', false); return }
      if (file.size > MAX_BYTES) { setBusy(false); flash('File is too large. Maximum size is 5 MB.', false); return }

      const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const newPath = `${userId}/${Date.now()}-${safe}`
      const { error: upErr } = await supabase.storage
        .from('resumes')
        .upload(newPath, file, { contentType: TYPES[ext], upsert: false })
      if (upErr) { setBusy(false); flash(`Upload failed: ${upErr.message}`, false); return }

      oldPath = resume?.file_path ?? null
      filePath = newPath
      fileName = file.name
      fileSize = file.size
    }

    const { data, error } = await supabase
      .from('resumes')
      .upsert({
        user_id: userId,
        file_path: filePath,
        file_name: fileName,
        file_size: fileSize,
        job_interest: jobInterest || null,
        preferred_location: location.trim() || null,
        consent: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      if (file) await supabase.storage.from('resumes').remove([filePath])
      setBusy(false)
      flash(`Could not save: ${error.message}`, false)
      return
    }

    if (oldPath && oldPath !== filePath) {
      await supabase.storage.from('resumes').remove([oldPath])
    }

    setResume(data as ResumeRow)
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setBusy(false)
    flash('Resume saved.')
  }

  async function download() {
    if (!resume) return
    const { data, error } = await supabase.storage.from('resumes').createSignedUrl(resume.file_path, 60)
    if (error || !data) { flash('Could not open the file.', false); return }
    window.open(data.signedUrl, '_blank')
  }

  async function remove() {
    if (!resume) return
    if (!confirm('Delete your resume? Companies will no longer be able to see it.')) return
    setBusy(true)
    await supabase.storage.from('resumes').remove([resume.file_path])
    const { error } = await supabase.from('resumes').delete().eq('id', resume.id)
    setBusy(false)
    if (error) { flash('Could not delete.', false); return }
    setResume(null)
    setJobInterest('')
    setLocation('')
    setConsent(false)
    flash('Resume deleted.')
  }

  if (loading) {
    return <div style={{ minHeight: '100vh', background: '#262421', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Segoe UI, sans-serif' }}>Loading...</div>
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #262421 0%, #302d29 100%)', fontFamily: 'Segoe UI, sans-serif' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 32px', background: '#211f1d', borderBottom: '2px solid #F0801E' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src="/logo-icon.png" alt="Machinest Studio" style={{ height: 40, width: 'auto' }} />
          <span style={{ fontSize: 19, fontWeight: 800, color: '#fff' }}>Machinest <span style={{ color: '#F0801E' }}>Studio</span></span>
        </div>
        <button onClick={() => router.push('/dashboard')} style={{ background: '#F0801E', color: '#fff', border: 'none', borderRadius: 999, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          &larr; Dashboard
        </button>
      </header>

      <div style={{ padding: '32px 24px', maxWidth: 680, margin: '0 auto' }}>
        <h2 style={{ color: '#fff', fontSize: 24, margin: '0 0 6px', fontWeight: 800 }}>My Resume</h2>
        <p style={{ color: '#999', fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
          Upload your resume so Machinest can connect you with CNC job openings. Only you and the Machinest team can see it.
        </p>

        {msg && (
          <div style={{
            background: msg.ok ? '#1f2e22' : '#2e1f1f', border: `1px solid ${msg.ok ? '#2fbf71' : '#ff6b6b'}`,
            color: msg.ok ? '#2fbf71' : '#ff6b6b', borderRadius: 8, padding: '10px 16px', marginBottom: 20, fontSize: 14,
          }}>
            {msg.text}
          </div>
        )}

        {resume && (
          <div style={{ ...card, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: '#2fbf71', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>&#10003; Resume uploaded</div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: 15, wordBreak: 'break-word' }}>{resume.file_name}</div>
              <div style={{ color: '#888', fontSize: 12, marginTop: 2 }}>
                {resume.file_size ? `${(resume.file_size / 1024).toFixed(0)} KB · ` : ''}
                Updated {new Date(resume.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={btnGhost} onClick={download}>View</button>
              <button style={{ ...btnGhost, borderColor: '#ff6b6b', color: '#ff6b6b' }} onClick={remove} disabled={busy}>Delete</button>
            </div>
          </div>
        )}

        <div style={card}>
          <h3 style={{ color: '#fff', fontSize: 16, margin: '0 0 18px' }}>{resume ? 'Update resume or preferences' : 'Upload resume'}</h3>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>{resume ? 'Replace file (optional)' : 'Resume file'} — PDF, DOC or DOCX, max 5 MB</label>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={e => setFile(e.target.files?.[0] || null)}
              style={{ ...inputStyle, padding: 8 }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Looking for</label>
            <select style={inputStyle} value={jobInterest} onChange={e => setJobInterest(e.target.value)}>
              <option value="">Select role</option>
              {INTERESTS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle}>Preferred job location (optional)</label>
            <input style={inputStyle} value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Rajkot, Pune, anywhere in India" />
          </div>

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: '#ccc', fontSize: 13, lineHeight: 1.5, marginBottom: 20, cursor: 'pointer' }}>
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
            <span>
              I agree that Machinest may store my resume and share it with companies hiring through Machinest for job placement.
              I can delete it anytime from this page.
            </span>
          </label>

          <button style={btnPrimary} onClick={save} disabled={busy}>
            {busy ? 'Saving...' : resume ? 'Save changes' : 'Upload resume'}
          </button>
        </div>
      </div>
    </div>
  )
}
