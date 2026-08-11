import React, { useState, useEffect } from 'react'
import { api } from '../api.js'
import { useLang } from '../context/LangContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'

export default function LicenseScreen({ onUnlock }) {
  const { t, lang, changeLang } = useLang()
  const { theme, toggleTheme } = useTheme()
  const [info, setInfo] = useState(null)
  const [key, setKey] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = () => api.get('/license').then(setInfo).catch(() => setInfo(null))
  useEffect(load, [])

  const activate = async () => {
    setBusy(true)
    setMsg('')
    try {
      const r = await api.post('/license/activate', { key })
      if (r.ok) {
        const fresh = await api.get('/license')
        setInfo(fresh)
        setKey('')
        if (onUnlock) onUnlock()
      } else {
        setMsg(t('licenseInvalid'))
      }
    } catch (e) {
      setMsg(t('licenseInvalid'))
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(info.installId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="d-flex justify-between">
          <div className="login-logo">🏪</div>
          <div className="d-flex" style={{ gap: 8 }}>
            <button className="icon-btn" style={{ fontSize: 18 }} onClick={toggleTheme}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <div className="lang-toggle">
              <button className={lang === 'ar' ? 'active' : ''} onClick={() => changeLang('ar')}>ع</button>
              <button className={lang === 'en' ? 'active' : ''} onClick={() => changeLang('en')}>EN</button>
            </div>
          </div>
        </div>
        <h1>🔑 {t('licenseTitle')}</h1>

        {!info ? (
          <div className="text-muted">{t('loading')}</div>
        ) : (
          <>
            {info.activated && (
              <p className="license-activated">✅ {t('licenseActivated')} — {t('licenseUntil')} <b dir="ltr">{info.expiry}</b></p>
            )}
            {!info.activated && info.valid && (
              <p className="license-trial">⏳ {t('trialActive')}: <b>{info.daysLeft}</b> {t('days')}</p>
            )}
            {!info.activated && !info.valid && (
              <p className="license-expired">⚠️ {t('trialExpired')}</p>
            )}

            {!info.activated && (
              <>
                <div className="field">
                  <label>{t('installId')}</label>
                  <div className="install-id">
                    <code dir="ltr">{info.installId}</code>
                    <button className="btn btn-ghost" onClick={copy}>{copied ? '✅' : '📋'}</button>
                  </div>
                </div>
                <div className="field">
                  <label>{t('activationKey')}</label>
                  <input dir="ltr" value={key} onChange={(e) => setKey(e.target.value)} placeholder="•••• •••• •••• ••••" />
                </div>
                {msg && <div className="form-error">{msg}</div>}
                <button className="btn btn-block" onClick={activate} disabled={busy}>
                  {busy ? t('loading') : t('activate')}
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
