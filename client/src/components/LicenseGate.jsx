import React, { useEffect, useState } from 'react'
import { api } from '../api.js'
import LicenseScreen from './LicenseScreen.jsx'

export default function LicenseGate({ children }) {
  const [state, setState] = useState('loading')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let alive = true
    setState('loading')
    api.get('/license')
      .then((info) => { if (alive) setState(info && info.valid !== false ? 'ok' : 'locked') })
      .catch((e) => {
        if (!alive) return
        if (e && e.offline) setState('ok')
        else setState('locked')
      })
    return () => { alive = false }
  }, [retry])

  if (state === 'loading') {
    return <div className="login-page"><div className="login-card"><div className="page-loader">…</div></div></div>
  }
  if (state === 'locked') {
    return <LicenseScreen onUnlock={() => setRetry((r) => r + 1)} />
  }
  return children
}
