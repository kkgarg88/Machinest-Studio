'use client'
import { useEffect, useState } from 'react'

export default function TutorialModal({ cycleId, title, onClose }: { cycleId: string; title: string; onClose: () => void }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const res = await fetch('/api/tutorial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cycleId }),
        })
        const data = await res.json().catch(() => ({}))
        if (!alive) return
        if (res.ok) setUrl(data.url)
        else setError(data.error || 'Could not load video')
      } catch {
        if (alive) setError('Could not load video')
      }
    }
    load()

    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { alive = false; window.removeEventListener('keydown', onKey) }
  }, [cycleId])

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100 }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 820, background: '#2b2a28', border: '1px solid #3a3733', borderRadius: 12, padding: 18 }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{title} - Tutorial</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#bbb', fontSize: 22, cursor: 'pointer' }}>✕</button>
        </div>
        {url ? (
          <video
            src={url}
            controls
            autoPlay
            playsInline
            controlsList="nodownload"
            onContextMenu={e => e.preventDefault()}
            style={{ width: '100%', maxHeight: '70vh', background: '#000', borderRadius: 8 }}
          />
        ) : (
          <p style={{ color: error ? '#ff6b6b' : '#999', fontSize: 14, margin: '30px 0', textAlign: 'center' }}>
            {error || 'Loading video...'}
          </p>
        )}
      </div>
    </div>
  )
}