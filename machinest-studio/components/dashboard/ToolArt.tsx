'use client'
import { useEffect, useState } from 'react'

// Animated pictures for the premium tool cards.

export function TurningArt() {
  const lines: number[] = []
  for (let y = 62; y <= 134; y += 6) lines.push(y)
  return (
    <>
      <svg viewBox="0 0 320 196" aria-hidden="true">
        <defs>
          <linearGradient id="dbxSt1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8a8680" /><stop offset=".45" stopColor="#cfcac2" /><stop offset="1" stopColor="#5d5954" /></linearGradient>
          <linearGradient id="dbxSt2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffd9a8" /><stop offset=".45" stopColor="#fff4e4" /><stop offset="1" stopColor="#e8a45b" /></linearGradient>
          <clipPath id="dbxWp"><rect x="70" y="78" width="200" height="46" rx="2" /></clipPath>
        </defs>
        <line x1="8" x2="312" y1="101" y2="101" stroke="#F0801E" strokeOpacity=".3" strokeDasharray="12 4 2 4" />
        <rect x="20" y="58" width="50" height="86" rx="7" fill="#4a4744" />
        <rect x="52" y="64" width="18" height="15" rx="2" fill="#6a6560" />
        <rect x="52" y="123" width="18" height="15" rx="2" fill="#6a6560" />
        <g clipPath="url(#dbxWp)">
          <rect x="70" y="78" width="200" height="46" fill="url(#dbxSt1)" />
          <g className="dbx-fin"><rect x="70" y="78" width="200" height="46" fill="url(#dbxSt2)" /></g>
          <g className="dbx-roll" stroke="#000" strokeOpacity=".2" strokeWidth="1.4">
            {lines.map(y => <line key={y} x1="70" x2="270" y1={y} y2={y} />)}
          </g>
        </g>
        <g className="dbx-tmove">
          <rect x="-13" y="24" width="26" height="36" rx="3" fill="#F0801E" />
          <rect x="-13" y="24" width="26" height="6" rx="3" fill="#FFB34D" />
          <polygon points="-10,60 10,60 0,78" fill="#FFB34D" />
          <circle className="dbx-sp" cx="2" cy="76" r="1.8" fill="#FFD08A" style={{ ['--dx' as string]: '16px', ['--dy' as string]: '-18px' }} />
          <circle className="dbx-sp" cx="2" cy="76" r="1.4" fill="#FFB34D" style={{ ['--dx' as string]: '24px', ['--dy' as string]: '-8px', animationDelay: '.12s' }} />
          <circle className="dbx-sp" cx="2" cy="76" r="1.6" fill="#ffffff" style={{ ['--dx' as string]: '10px', ['--dy' as string]: '-26px', animationDelay: '.25s' }} />
          <circle className="dbx-sp" cx="2" cy="76" r="1.2" fill="#FFD08A" style={{ ['--dx' as string]: '30px', ['--dy' as string]: '-14px', animationDelay: '.38s' }} />
        </g>
      </svg>
      <span className="dbx-tag">S1200 &nbsp; F0.15</span>
    </>
  )
}

export function MillingArt() {
  return (
    <>
      <svg viewBox="0 0 320 196" aria-hidden="true">
        <rect x="40" y="26" width="240" height="144" rx="9" fill="#34312e" stroke="#4a4744" />
        <rect x="26" y="52" width="16" height="24" rx="3" fill="#5a5651" />
        <rect x="26" y="120" width="16" height="24" rx="3" fill="#5a5651" />
        <rect x="278" y="52" width="16" height="24" rx="3" fill="#5a5651" />
        <rect x="278" y="120" width="16" height="24" rx="3" fill="#5a5651" />
        <rect className="dbx-floor" x="100" y="76" width="120" height="46" fill="#1b1815" />
        <path className="dbx-cut" d="M100 76 H220 V122 H100 Z" fill="none" stroke="#14110e" strokeWidth="16" strokeLinejoin="round" />
        <path d="M100 76 H220 V122 H100 Z" fill="none" stroke="#F0801E" strokeOpacity=".28" strokeDasharray="3 5" />
        <g>
          <animateMotion dur="6s" repeatCount="indefinite" path="M100 76 H220 V122 H100 Z" />
          <circle r="19" fill="#F0801E" opacity=".16" />
          <circle r="10" fill="#2a2724" stroke="#F0801E" strokeWidth="2" />
          <g className="dbx-spin">
            <line x1="-10" y1="0" x2="10" y2="0" stroke="#FFB34D" strokeWidth="2.2" />
            <line x1="0" y1="-10" x2="0" y2="10" stroke="#FFB34D" strokeWidth="2.2" />
          </g>
          <circle r="2.4" fill="#FFB34D" />
        </g>
      </svg>
      <span className="dbx-tag">Z-5.0 &nbsp; F600</span>
    </>
  )
}

const LIVE: [string, string][] = [
  ['Running', '#2fbf71'], ['Setup', '#4dabf7'], ['Breakdown', '#ff4d4f'], ['No Plan', '#9aa0a6'],
  ['No Material', '#e0b13a'], ['Tool Chg', '#2dd4bf'], ['Maintenance', '#F0801E'],
]
const NAMES = ['VMC 3X', 'CNC', 'HMC', 'SLIDING', 'VTL', 'MILL-T']

export function StatusArt() {
  const [tiles, setTiles] = useState<number[]>([0, 0, 2, 1, 0, 5])
  const [time, setTime] = useState('')

  useEffect(() => {
    const clock = () => setTime(new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit' }).toUpperCase())
    clock()
    const c = setInterval(clock, 1000)
    const reduce = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const t = reduce ? null : setInterval(() => {
      setTiles(prev => {
        const next = [...prev]
        next[Math.floor(Math.random() * next.length)] = Math.floor(Math.random() * LIVE.length)
        return next
      })
    }, 1700)
    return () => { clearInterval(c); if (t) clearInterval(t) }
  }, [])

  return (
    <>
      <div className="dbx-livehead"><span><i className="dbx-dot" />LIVE</span><span>{time}</span></div>
      <div className="dbx-live">
        {NAMES.map((n, i) => (
          <div key={n} className="dbx-lt" style={{ ['--c' as string]: LIVE[tiles[i]][1] }}>
            <b>{n}</b>
            <span>{LIVE[tiles[i]][0]}</span>
          </div>
        ))}
      </div>
    </>
  )
}

// For any new tool added later: a slowly turning gear
export function GenericArt({ icon }: { icon: string }) {
  return (
    <svg viewBox="0 0 320 196" aria-hidden="true">
      <g transform="translate(160 98)">
        <g className="dbx-slow">
          <circle r="52" fill="none" stroke="#F0801E" strokeWidth="20" strokeDasharray="14.3 10" opacity=".85" />
          <circle r="36" fill="#1b1815" stroke="#F0801E" strokeWidth="3" />
        </g>
        <text textAnchor="middle" dominantBaseline="central" fontSize="34">{icon}</text>
      </g>
    </svg>
  )
}
