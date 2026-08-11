import React, { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useLang } from '../context/LangContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { useSettings } from '../context/SettingsContext.jsx'
import InstallButton from './InstallButton.jsx'
import { NAV, ROLE_ACCESS } from '../permissions.js'

function getAllowed(user) {
  if (user && user.pages && user.pages.length) return user.pages
  return ROLE_ACCESS[user?.role] || []
}

function Sidebar({ open, onClose }) {
  const { t } = useLang()
  const { user, logout } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const allowed = getAllowed(user)
  const appName = settings.appName || t('appName')

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      {open && <div className="modal-overlay" onClick={onClose} style={{ zIndex: 99, backdropFilter: 'none' }} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">🏪</div>
          <h2>{appName}</h2>
        </div>
        <nav className="sidebar-nav">
          {NAV.filter((n) => allowed.includes(n.path)).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={onClose}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="icon">{item.icon}</span>
              <span>{t(item.key)}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <InstallButton />
          <button className="nav-item" onClick={handleLogout}>
            <span className="icon">🚪</span>
            <span>{t('logout')}</span>
          </button>
        </div>
      </aside>
    </>
  )
}

function Topbar({ onMenu }) {
  const { t, lang, changeLang } = useLang()
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { settings } = useSettings()
  const initials = user ? user.name.slice(0, 1) : ''
  const roleLabel = user ? t(user.role) : ''
  const appName = settings.appName || t('appName')

  return (
    <header className="topbar">
      <div className="d-flex" style={{ gap: 10 }}>
        <button className="menu-toggle" onClick={onMenu}>☰</button>
        <h1 className="topbar-title">{appName}</h1>
      </div>
      <div className="topbar-actions">
        <button className="icon-btn" style={{ fontSize: 18 }} title={theme === 'dark' ? 'Light' : 'Dark'} onClick={toggleTheme}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        <div className="lang-toggle">
          <button className={lang === 'ar' ? 'active' : ''} onClick={() => changeLang('ar')}>
            ع
          </button>
          <button className={lang === 'en' ? 'active' : ''} onClick={() => changeLang('en')}>
            EN
          </button>
        </div>
        <div className="user-chip">
          <div className="avatar">{initials}</div>
          <div className="uinfo">
            <div className="uname">{user?.name}</div>
            <div className="urole">{roleLabel}</div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default function Layout() {
  const { t } = useLang()
  const { user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const isPos = location.pathname.startsWith('/pos')
  const denied = !getAllowed(user).includes(location.pathname)
  return (
    <div className={`layout ${isPos ? 'pos-route' : ''}`}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main">
        <Topbar onMenu={() => setSidebarOpen(true)} />
        <div className="content">
          {denied ? (
            <div className="card access-denied">
              <div className="access-denied-icon">🚫</div>
              <h3>{t('noAccess')}</h3>
            </div>
          ) : (
            <Outlet />
          )}
        </div>
      </div>
    </div>
  )
}
