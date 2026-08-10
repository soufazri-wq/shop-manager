import React, { useState, useEffect, useMemo } from 'react'
import { api } from '../api.js'
import { useLang } from '../context/LangContext.jsx'
import Modal from '../components/Modal.jsx'
import { EmptyState, Loader, ConfirmModal } from '../components/UI.jsx'

const empty = { name: '', phone: '', email: '', address: '', notes: '' }

export default function Customers() {
  const { t } = useLang()
  const [customers, setCustomers] = useState(null)
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => api.get('/customers').then(setCustomers).catch(() => setCustomers([]))
  useEffect(load, [])

  const filtered = useMemo(() => {
    if (!customers) return []
    const q = query.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.phone || '').includes(q) ||
      (c.email || '').toLowerCase().includes(q)
    )
  }, [customers, query])

  const openAdd = () => { setError(''); setModal({ ...empty }) }
  const openEdit = (c) => { setError(''); setModal({ id: c.id, ...c }) }

  const save = async () => {
    if (!modal.name.trim()) { setError(t('required')); return }
    setSaving(true)
    try {
      if (modal.id) await api.put('/customers/' + modal.id, modal)
      else await api.post('/customers', modal)
      setModal(null)
      load()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const remove = async () => {
    await api.del('/customers/' + deleting.id)
    setDeleting(null)
    load()
  }

  if (!customers) return <Loader />

  return (
    <div>
      <div className="toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search')} />
        </div>
        <button className="btn" onClick={openAdd}>＋ {t('add')}</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('name')}</th>
                <th>{t('phone')}</th>
                <th>{t('email')}</th>
                <th>{t('address')}</th>
                <th>{t('purchases')}</th>
                <th>{t('total')}</th>
                <th>{t('due')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={8}><EmptyState /></td></tr>}
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td className="font-bold">👤 {c.name}</td>
                  <td dir="ltr">{c.phone || '—'}</td>
                  <td className="text-muted">{c.email || '—'}</td>
                  <td className="text-muted">{c.address || '—'}</td>
                  <td>{c.sales_count || 0}</td>
                  <td>{Number(c.total_spent || 0).toLocaleString()}</td>
                  <td>
                    {Number(c.outstanding) > 0
                      ? <span className="badge badge-out">{Number(c.outstanding).toLocaleString()}</span>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" onClick={() => openEdit(c)}>✏️</button>
                      <button className="icon-btn danger" onClick={() => setDeleting(c)}>🗑️</button>
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
          title={modal.id ? t('edit') : t('add')}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>{t('cancel')}</button>
              <button className="btn" onClick={save} disabled={saving}>{saving ? t('loading') : t('save')}</button>
            </>
          }
        >
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label>{t('name')} *</label>
            <input value={modal.name} onChange={(e) => setModal({ ...modal, name: e.target.value })} />
          </div>
          <div className="form-row">
            <div className="field">
              <label>{t('phone')}</label>
              <input value={modal.phone} onChange={(e) => setModal({ ...modal, phone: e.target.value })} />
            </div>
            <div className="field">
              <label>{t('email')}</label>
              <input type="email" value={modal.email} onChange={(e) => setModal({ ...modal, email: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>{t('address')}</label>
            <input value={modal.address} onChange={(e) => setModal({ ...modal, address: e.target.value })} />
          </div>
          <div className="field">
            <label>{t('notes')}</label>
            <textarea rows="2" value={modal.notes} onChange={(e) => setModal({ ...modal, notes: e.target.value })} />
          </div>
        </Modal>
      )}

      <ConfirmModal open={!!deleting} title={t('delete')} onConfirm={remove} onCancel={() => setDeleting(null)} />
    </div>
  )
}
