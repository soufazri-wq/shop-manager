import React, { useEffect, useState } from 'react'
import { useLang } from '../context/LangContext.jsx'

export default function InstallButton() {
  const { t } = useLang()
  const [prompt, setPrompt] = useState(null)
  const [hint, setHint] = useState(false)
  const [installed, setInstalled] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(display-mode: standalone)').matches
  })

  useEffect(() => {
    const onBefore = (e) => {
      e.preventDefault()
      setPrompt(e)
    }
    const onInstalled = () => {
      setPrompt(null)
      setInstalled(true)
      setHint(false)
    }
    window.addEventListener('beforeinstallprompt', onBefore)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBefore)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) {
    return (
      <button className="nav-item install-btn" disabled title={t('installed')}>
        <span className="icon">✅</span>
        <span>{t('installed')}</span>
      </button>
    )
  }

  const handleClick = async () => {
    if (prompt) {
      prompt.prompt()
      const choice = await prompt.userChoice
      if (choice && choice.outcome === 'accepted') setPrompt(null)
      return
    }
    setHint(true)
  }

  return (
    <div className="install-wrap">
      <button className="nav-item install-btn" onClick={handleClick}>
        <span className="icon">📲</span>
        <span>{t('installApp')}</span>
      </button>
      {hint && <div className="install-hint">{t('installHint')}</div>}
    </div>
  )
}
