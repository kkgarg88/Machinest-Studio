'use client'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type Lang = 'en' | 'hi'
const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'en', setLang: () => {} })

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')
  // the chosen language is remembered in this browser
  useEffect(() => {
    try { if (localStorage.getItem('ms_lang') === 'hi') setLangState('hi') } catch {}
  }, [])
  const setLang = (l: Lang) => {
    setLangState(l)
    try { localStorage.setItem('ms_lang', l) } catch {}
  }
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>
}

export const useLang = () => useContext(Ctx)

// t('English text', 'हिंदी टेक्स्ट') gives the text in the chosen language
export function useT() {
  const { lang } = useLang()
  return (en: string, hi: string) => (lang === 'hi' ? hi : en)
}

export function LangSwitch() {
  const { lang, setLang } = useLang()
  const b = (l: Lang, text: string) => (
    <button type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
      style={{ padding: '7px 16px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, background: lang === l ? '#F0801E' : 'transparent', color: lang === l ? '#fff' : '#bbb' }}>
      {text}
    </button>
  )
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
      <span style={{ color: '#888', fontSize: 12.5 }}>{lang === 'hi' ? 'भाषा' : 'Language'}</span>
      <div style={{ display: 'inline-flex', border: '1px solid #3a3733', borderRadius: 8, overflow: 'hidden', background: '#1c1b19' }}>
        {b('en', 'English')}{b('hi', 'हिंदी')}
      </div>
    </div>
  )
}
