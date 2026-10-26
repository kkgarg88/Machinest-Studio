'use client'
import { useEffect, useRef, useState } from 'react'
import { Bi } from './Bi'
import { useT } from './lang'

const OR = '#F0801E'
const ST = '#8a8782'

type Pair = [string, string]
type ToolType = { n: number; grp: Pair; name: Pair; desc: Pair; dir: string; common?: boolean }

// P = programmed (imaginary) tip, C = centre of the nose radius. Pictures use X+ up and Z+ to the right.
const G_OD: Pair = ['OD turning', 'OD टर्निंग']
const G_BORE: Pair = ['Boring', 'बोरिंग']
const G_SPECIAL: Pair = ['Special', 'स्पेशल']
const G_RARE: Pair = ['Less common – check your control manual', 'कम इस्तेमाल – अपने कंट्रोल का मैनुअल देखें']

export const TOOL_TYPES: ToolType[] = [
  { n: 3, grp: G_OD, name: ['OD turning tool', 'OD टर्निंग टूल'], desc: ['Corner points to the centre and towards the chuck (standard right-hand tool)', 'कोना सेंटर और चक की तरफ (सामान्य राइट-हैंड टूल)'], dir: 'xm zm', common: true },
  { n: 4, grp: G_OD, name: ['OD back-turning tool', 'OD बैक-टर्निंग टूल'], desc: ['Corner points to the centre and away from the chuck (turning back towards the face)', 'कोना सेंटर की तरफ और चक से दूर (फेस की तरफ वापस टर्निंग)'], dir: 'xm zp' },
  { n: 2, grp: G_BORE, name: ['ID boring bar', 'ID बोरिंग बार'], desc: ['Corner points away from the centre and towards the chuck', 'कोना सेंटर से दूर और चक की तरफ'], dir: 'xp zm' },
  { n: 1, grp: G_BORE, name: ['ID back-boring tool', 'ID बैक-बोरिंग टूल'], desc: ['Corner points away from the centre and away from the chuck', 'कोना सेंटर से दूर और चक से भी दूर'], dir: 'xp zp' },
  { n: 0, grp: G_SPECIAL, name: ['Tip at the nose centre', 'टिप नोज़ के सेंटर पर'], desc: ['Round insert / button tool programmed to its centre (0 and 9 are the same)', 'राउंड इन्सर्ट / बटन टूल, सेंटर पर प्रोग्राम (0 और 9 एक ही हैं)'], dir: 'c' },
  { n: 5, grp: G_RARE, name: ['Tip on the right edge', 'टिप दाईं एज पर'], desc: ['Programmed point at the +Z side of the nose radius', 'प्रोग्राम पॉइंट नोज़ रेडियस की +Z तरफ'], dir: 'e zp' },
  { n: 6, grp: G_RARE, name: ['Tip on the top edge', 'टिप ऊपरी एज पर'], desc: ['Programmed point at the +X side of the nose radius', 'प्रोग्राम पॉइंट नोज़ रेडियस की +X तरफ'], dir: 'e xp' },
  { n: 7, grp: G_RARE, name: ['Tip on the left edge', 'टिप बाईं एज पर'], desc: ['Programmed point at the −Z side of the nose radius', 'प्रोग्राम पॉइंट नोज़ रेडियस की −Z तरफ'], dir: 'e zm' },
  { n: 8, grp: G_RARE, name: ['Tip on the bottom edge', 'टिप निचली एज पर'], desc: ['Programmed point at the −X side of the nose radius', 'प्रोग्राम पॉइंट नोज़ रेडियस की −X तरफ'], dir: 'e xm' },
]

export function TypeIcon({ dir, size = 78 }: { dir: string; size?: number }) {
  const C = { x: 46, y: 46 }
  const r = 17
  const d = dir.split(' ')
  let P = { x: C.x, y: C.y }
  let body: React.ReactNode = null

  if (d[0] === 'c') {
    body = <circle cx={C.x} cy={C.y} r={r} fill="rgba(240,128,30,.25)" stroke={OR} strokeWidth="2.4" />
  } else if (d[0] === 'e') {
    const v = d[1]
    const off = ({ xp: [0, -r], xm: [0, r], zp: [r, 0], zm: [-r, 0] } as Record<string, number[]>)[v]
    P = { x: C.x + off[0], y: C.y + off[1] }
    body = (
      <>
        {v[0] === 'x'
          ? <line x1={P.x - 30} x2={P.x + 30} y1={P.y} y2={P.y} stroke={ST} strokeDasharray="3 3" />
          : <line x1={P.x} x2={P.x} y1={P.y - 30} y2={P.y + 30} stroke={ST} strokeDasharray="3 3" />}
        <circle cx={C.x} cy={C.y} r={r} fill="rgba(240,128,30,.2)" stroke={OR} strokeWidth="2.4" />
      </>
    )
  } else {
    // corner types: P is the corner of the two tangent lines, on the side given by the direction
    const sx = d[1] === 'zp' ? 1 : -1
    const sy = d[0] === 'xp' ? -1 : 1
    P = { x: C.x + sx * r, y: C.y + sy * r }
    const e1 = { x: P.x - sx * 40, y: P.y }
    const e2 = { x: P.x, y: P.y - sy * 40 }
    const t1 = { x: C.x + sx * r, y: C.y }
    const t2 = { x: C.x, y: C.y + sy * r }
    const sweep = sx * sy > 0 ? 1 : 0
    body = (
      <>
        <polygon points={`${P.x},${P.y} ${e1.x},${e1.y} ${C.x - sx * r * 0.2},${C.y - sy * r * 0.2} ${e2.x},${e2.y}`} fill="rgba(240,128,30,.14)" />
        <line x1={P.x} y1={P.y} x2={e1.x} y2={e1.y} stroke={OR} strokeWidth="2" />
        <line x1={P.x} y1={P.y} x2={e2.x} y2={e2.y} stroke={OR} strokeWidth="2" />
        <path d={`M${t1.x},${t1.y} A${r},${r} 0 0 ${sweep} ${t2.x},${t2.y}`} fill="none" stroke={OR} strokeWidth="3.2" />
        <circle cx={C.x} cy={C.y} r={r} fill="none" stroke="#6a655f" strokeDasharray="2 3" />
      </>
    )
  }
  return (
    <svg viewBox="0 0 92 92" style={{ flex: `0 0 ${size}px`, width: size, height: size }} aria-hidden="true">
      {body}
      <line x1={C.x} y1={C.y} x2={P.x} y2={P.y} stroke="#7aa7ff" strokeWidth="1" strokeDasharray="2 2" />
      <circle cx={C.x} cy={C.y} r="2.6" fill="#7aa7ff" />
      <circle cx={P.x} cy={P.y} r="4" fill="#ff5a5a" stroke="#fff" strokeWidth="1" />
      <line x1="8" y1="86" x2="8" y2="70" stroke="#aaa" strokeWidth="1" />
      <text x="11" y="72" fill="#aaa" fontSize="8">X+</text>
      <line x1="8" y1="86" x2="24" y2="86" stroke="#aaa" strokeWidth="1" />
      <text x="26" y="89" fill="#aaa" fontSize="8">Z+</text>
    </svg>
  )
}

export default function ToolTypePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const current = TOOL_TYPES.find(t => String(t.n) === value) ?? TOOL_TYPES[0]

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  let last = ''
  return (
    <div ref={box} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(!open)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, background: '#1c1b19', border: `1px solid ${open ? OR : '#3a3733'}`, borderRadius: 8, color: '#fff', padding: '8px 12px', fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>
        <TypeIcon dir={current.dir} />
        <span style={{ flex: 1, lineHeight: 1.35 }}>
          <b>Type {current.n}</b> – <Bi en={current.name[0]} hi={current.name[1]} />
        </span>
        <span style={{ color: '#999' }}>▾</span>
      </button>

      {open && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: 'calc(100% + 6px)', background: '#1c1b19', border: `1px solid ${OR}`, borderRadius: 10, zIndex: 30, maxHeight: 460, overflow: 'auto', boxShadow: '0 14px 40px rgba(0,0,0,.55)' }}>
          {TOOL_TYPES.map(tt => {
            const head = tt.grp[0] !== last
            last = tt.grp[0]
            return (
              <div key={tt.n}>
                {head && (
                  <div style={{ padding: '6px 12px', fontSize: 11, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8a8782', background: '#232120' }}>
                    {t(tt.grp[0], tt.grp[1])}
                  </div>
                )}
                <div onClick={() => { onChange(String(tt.n)); setOpen(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #2a2826', background: tt.n === current.n ? 'rgba(240,128,30,.2)' : 'transparent' }}>
                  <TypeIcon dir={tt.dir} />
                  <div style={{ fontSize: 13.5, lineHeight: 1.4, color: '#eee' }}>
                    <b style={{ fontSize: 14.5 }}>Type {tt.n}</b>
                    {tt.common && <span style={{ display: 'inline-block', background: OR, color: '#171513', fontSize: 10.5, fontWeight: 800, borderRadius: 99, padding: '1px 8px', marginLeft: 6 }}>{t('common', 'सामान्य')}</span>}
                    <div><Bi en={tt.name[0]} hi={tt.name[1]} /></div>
                    <div style={{ color: '#a39d94', fontSize: 12 }}><Bi en={tt.desc[0]} hi={tt.desc[1]} /></div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
