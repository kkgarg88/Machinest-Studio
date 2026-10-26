'use client'
import type { ReactNode } from 'react'

// English line with the Hindi line (Devanagari) under it.
export function Bi({ en, hi, hiColor }: { en: ReactNode; hi: ReactNode; hiColor?: string }) {
  return (
    <>
      <span style={{ display: 'block' }}>{en}</span>
      <span lang="hi" style={{ display: 'block', marginTop: 2, fontSize: '0.96em', color: hiColor, opacity: hiColor ? 1 : 0.92 }}>{hi}</span>
    </>
  )
}
