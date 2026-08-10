import React from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../context/LangContext.jsx'

export default function NotFound() {
  const { t } = useLang()
  return (
    <div className="empty-state" style={{ paddingTop: 80 }}>
      <div className="icon">🧭</div>
      <h2 style={{ marginBottom: 10 }}>404</h2>
      <p className="text-muted mb-16">{t('noData')}</p>
      <Link to="/" className="btn">{t('dashboard')}</Link>
    </div>
  )
}
