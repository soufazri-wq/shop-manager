import React, { useState, useEffect } from 'react'
import { api } from '../api.js'
import { useLang } from '../context/LangContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import Modal from '../components/Modal.jsx'
import { EmptyState, Loader, ConfirmModal } from '../components/UI.jsx'
import { NAV, getRolePagePaths } from '../permissions.js'

const ROLES = ['admin', 'manager', 'cashier', 'warehouse']

export default function Employees() {
  const { t } = useLang()
  const { user: me } = useAuth()
  const [users, setUsers] = useState(null)
  const [modal, setModal] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => api.get('/employees').then(setUsers).catch(() => setUsers([]))
  useEffect(load, [])

  const openAdd = () => setModal({ name: '', email: '', phone: '', password: '', role: 'cashier', active: 1, pages: getRolePagePaths('cashier') })
  const openEdit = (u) => setModal({
    id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, active: u.active, password: '',
    pages: u.pages && u.pages.length ? u.pages : getRolePagePaths(u.role),
  })

  const togglePage = (path) => {
    const set = new Set(modal.pages)
    if (set.has(path)) set.delete(path)
    else set.add(path)
    setModal({ ...modal, pages: NAV.map((n) => n.path).filter((p) => set.has(p)) })
  }

  const save = async () => {
    if (!modal.name || !modal.email) { setError(t('required')); return }
    if (!modal.id && !modal.password) { setError(t('required')); return }
    if (!modal.pages || modal.pages.length === 0) { setError(t('selectAtLeastOnePage')); return }
    let pages = modal.pages
    if (me && modal.id === me.id && !pages.includes('/employees')) pages = [...pages, '/employees']
    setSaving(true)
    try {
      if (modal.id) {
        const body = { name: modal.name, email: modal.email, phone: modal.phone, role: modal.role, active: modal.active, pages }
        if (modal.password) body.password = modal.password
        await api.put('/employees/' + modal.id, body)
      } else {
        await api.post('/employees', { ...modal, pages })
      }
      setModal(null)
      load()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const remove = async () => {
    await api.del('/employees/' + deleting.id)
    setDeleting(null)
    load()
  }

  if (!users) return <Loader />

  return (
    <div>
      <div className="toolbar">
        <div>
          <h3 className="font-bold">{t('employeesTitle')}</h3>
        </div>
        <button className="btn ml-auto" onClick={openAdd}>＋ {t('addEmployee')}</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('email')}</th>
                <th>{t('phone')}</th>
                <th>{t('role')}</th>
                <th>{t('status')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && <tr><td colSpan={6}><EmptyState /></td></tr>}
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="font-bold">👤 {u.name}</td>
                  <td dir="ltr" className="text-muted">{u.email}</td>
                  <td dir="ltr">{u.phone || '—'}</td>
                  <td><span className="badge badge-purple">{t(u.role)}</span></td>
                  <td>
                    {u.active
                      ? <span className="badge badge-in">{t('active')}</span>
                      : <span className="badge badge-unpaid">{t('inactive')}</span>}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" onClick={() => openEdit(u)}>✏️</button>
                      <button className="icon-btn danger" onClick={() => setDeleting(u)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal
          title={modal.id ? t('editEmployee') : t('addEmployee')}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>{t('cancel')}</button>
              <button className="btn" onClick={save} disabled={saving}>{saving ? t('loading') : t('save')}</button>
            </>
          }
        >
          {error && <div className="form-error">{error}</div>}
          <div className="form-row">
            <div className="field">
              <label>{t('name')} *</label>
              <input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} />
            </div>
            <div className="field">
              <label>{t('phone')}</label>
              <input value={modal.phone} onChange={(e) => setModal({ ...modal, phone: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>{t('email')} *</label>
            <input type="email" value={modal.email} onChange={(e) => setModal({ ...modal, email: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="field">
              <label>{t('role')}</label>
              <select value={modal.role} onChange={(e) => setModal({ ...modal, role: e.target.value, pages: getRolePagePaths(e.target.value) })}>
                {ROLES.map((r) => <option key={r} value={r}>{t(r)}</option>)}
              </select>
            </div>
            <div className="field">
              <label>{modal.id ? t('newPassword') : t('password')} {modal.id ? '' : '*'}</label>
              <input type="password" value={modal.password} onChange={(e) => setModal({ ...modal, password: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>{t('rolePages')}</label>
            <div className="page-checks">
              {NAV.map((p) => {
                const locked = me && modal.id === me.id && p.path === '/employees'
                const checked = locked || modal.pages.includes(p.path)
                return (
                  <label key={p.path} className={`page-check ${checked ? 'checked' : ''} ${locked ? 'locked' : ''}`}>
                    <input type="checkbox" checked={checked} disabled={locked} onChange={() => togglePage(p.path)} />
                    <span>{p.icon} {t(p.key)}</span>
                  </label>
                )
              })}
            </div>
          </div>
          {modal.id && (
            <div className="field">
              <label>{t('status')}</label>
              <select value={modal.active ? 1 : 0} onChange={(e) => setModal({ ...modal, active: e.target.value === '1' })}>
                <option value={1}>{t('active')}</option>
                <option value={0}>{t('inactive')}</option>
              </select>
            </div>
          )}
        </Modal>
      )}

      <ConfirmModal open={!!deleting} title={t('delete')} onConfirm={remove} onCancel={() => setDeleting(null)} />
    </div>
  )
}
