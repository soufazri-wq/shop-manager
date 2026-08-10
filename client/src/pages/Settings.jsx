import React, { useState, useEffect } from 'react'
import { api } from '../api.js'
import { useLang } from '../context/LangContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'

export default function Settings() {
  const { t } = useLang()
  const { user } = useAuth()
  const { settings, saveSettings } = useSettings()
  const [profile, setProfile] = useState({ name: user?.name || '', phone: user?.phone || '' })
  const [pass, setPass] = useState({ currentPassword: '', password: '', confirm: '' })
  const [appSettings, setAppSettings] = useState({ appName: settings.appName || '', currency: settings.currency || '' })
  const [network, setNetwork] = useState(null)
  const [copied, setCopied] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/auth/me').then((u) => setProfile({ name: u.name, phone: u.phone || '' })).catch(() => {})
  }, [])

  useEffect(() => {
    api.get('/network').then(setNetwork).catch(() => {})
  }, [])

  const copyAddress = () => {
    if (!network) return
    const val = network.url
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(val).then(() => setCopied(true)).catch(() => {})
    } else {
      const ta = document.createElement('textarea')
      ta.value = val
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy'); setCopied(true) } catch (e) { setErr(e.message) }
      document.body.removeChild(ta)
    }
    setTimeout(() => setCopied(false), 1500)
  }

  useEffect(() => {
    setAppSettings({ appName: settings.appName || '', currency: settings.currency || '' })
  }, [settings])

  const saveAppSettings = async () => {
    setErr(''); setMsg('')
    setSaving(true)
    try {
      await saveSettings({ appName: appSettings.appName, currency: appSettings.currency })
      setMsg(t('saveSuccess'))
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  const saveProfile = async () => {
    setErr(''); setMsg('')
    setSaving(true)
    try {
      await api.put('/auth/me', profile)
      setMsg(t('saveSuccess'))
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  const savePass = async () => {
    setErr(''); setMsg('')
    if (pass.password !== pass.confirm) { setErr(t('confirmPassword')); return }
    if (!pass.password) { setErr(t('required')); return }
    setSaving(true)
    try {
      await api.put('/auth/me', pass)
      setMsg(t('saveSuccess'))
      setPass({ currentPassword: '', password: '', confirm: '' })
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="grid-3">
      <div className="card card-pad">
        <h3 className="font-bold mb-16">👤 {t('profile')}</h3>
        {msg && <div className="form-success">{msg}</div>}
        {err && <div className="form-error">{err}</div>}
        <div className="field">
          <label>{t('name')}</label>
          <input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
        </div>
        <div className="field">
          <label>{t('phone')}</label>
          <input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
        </div>
        <div className="field">
          <label>{t('email')}</label>
          <input value={user?.email || ''} disabled />
        </div>
        <button className="btn" onClick={saveProfile} disabled={saving}>{saving ? t('loading') : t('save')}</button>
      </div>

      <div className="card card-pad">
        <h3 className="font-bold mb-16">🔒 {t('changePassword')}</h3>
        <div className="field">
          <label>{t('currentPassword')}</label>
          <input type="password" value={pass.currentPassword} onChange={(e) => setPass({ ...pass, currentPassword: e.target.value })} />
        </div>
        <div className="field">
          <label>{t('newPassword')}</label>
          <input type="password" value={pass.password} onChange={(e) => setPass({ ...pass, password: e.target.value })} />
        </div>
        <div className="field">
          <label>{t('confirmPassword')}</label>
          <input type="password" value={pass.confirm} onChange={(e) => setPass({ ...pass, confirm: e.target.value })} />
        </div>
        <button className="btn" onClick={savePass} disabled={saving}>{saving ? t('loading') : t('save')}</button>
      </div>

      <div className="card card-pad">
        <h3 className="font-bold mb-16">🏪 {t('appSettings')}</h3>
        <div className="field">
          <label>{t('appTitle')}</label>
          <input value={appSettings.appName} onChange={(e) => setAppSettings({ ...appSettings, appName: e.target.value })} placeholder={t('appName')} />
        </div>
        <div className="field">
          <label>{t('currency')}</label>
          <input value={appSettings.currency} onChange={(e) => setAppSettings({ ...appSettings, currency: e.target.value })} placeholder="ر.س" />
        </div>
        <div className="field">
          <label>{t('role')}</label>
          <input value={t(user.role)} disabled />
        </div>
        <button className="btn" onClick={saveAppSettings} disabled={saving}>{saving ? t('loading') : t('save')}</button>
      </div>

      <div className="card card-pad">
        <h3 className="font-bold mb-16">📡 {t('networkAddress')}</h3>
        <div className="field">
          <label>{t('phoneNetworkHint')}</label>
          <div className="d-flex" style={{ gap: 8 }}>
            <input readOnly value={network ? network.url : t('loading')} />
            <button className="btn" onClick={copyAddress}>{copied ? '✓' : t('copy')}</button>
          </div>
        </div>
        <div className="text-muted" style={{ fontSize: 13, lineHeight: 1.8 }}>
          {t('networkAddressHint')}
        </div>
      </div>
    </div>
  )
}
