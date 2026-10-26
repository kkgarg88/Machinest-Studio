'use client'
import type { ReactNode } from 'react'
import { useLang } from './lang'

// Shows the English text or the Hindi (Devanagari) text, depending on the language switch.
export function Bi({ en, hi }: { en: ReactNode; hi: ReactNode; hiColor?: string }) {
  const { lang } = useLang()
  return lang === 'hi' ? <span lang="hi">{hi}</span> : <span>{en}</span>
}
