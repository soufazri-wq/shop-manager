import React, { useEffect, useState } from 'react'
import { useLang } from '../context/LangContext.jsx'

export default function OfflineNotice() {
  const { t } = useLang()
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false)

  useEffect(() => {
    const goOff = () => setOffline(true)
    const goOn = () => setOffline(false)
    window.addEventListener('offline', goOff)
    window.addEventListener('online', goOn)
    return () => {
      window.removeEventListener('offline', goOff)
      window.removeEventListener('online', goOn)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="offline-banner" role="alert">
      <span>📡</span>
      <span>{t('offline')}</span>
      <button onClick={() => setOffline(typeof navigator !== 'undefined' && !navigator.onLine)}>
        {t('retry')}
      </button>
    </div>
  )
}
