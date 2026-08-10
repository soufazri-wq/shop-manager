import React, { createContext, useContext, useState } from 'react'
import { translations } from '../i18n/translations.js'

const LangContext = createContext(null)

export function LangProvider({ children }) {
  const [lang, setLang] = useState(localStorage.getItem('lang') || 'ar')

  const changeLang = (l) => {
    setLang(l)
    localStorage.setItem('lang', l)
    document.documentElement.lang = l
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr'
  }

  const t = (key) => {
    const table = translations[lang] || translations.ar
    return table[key] || translations.en[key] || key
  }

  return (
    <LangContext.Provider value={{ lang, changeLang, t }}>
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}
