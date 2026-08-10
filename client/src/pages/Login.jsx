import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../context/LangContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'

export default function Login() {
  const { t, lang, changeLang } = useLang()
  const { theme, toggleTheme } = useTheme()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message === 'Request failed' ? t('invalidCredentials') : err.message)
    } finally {
      setLoading(false)
    }
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
        <h1>{t('welcomeBack')}</h1>
        <p className="subtitle">{t('loginSubtitle')}</p>
        {error && <div className="form-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>{t('email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@shop.com"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label>{t('password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          <button className="btn btn-block" type="submit" disabled={loading}>
            {loading ? t('loading') : t('login')}
          </button>
        </form>
        <div className="text-muted mt-16" style={{ fontSize: 12, textAlign: 'center' }}>
          admin@shop.com / admin123
        </div>
      </div>
    </div>
  )
}
