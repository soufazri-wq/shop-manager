import React, { useState, useEffect, useMemo } from 'react'
import { api } from '../api.js'
import { useLang } from '../context/LangContext.jsx'
import Modal from '../components/Modal.jsx'
import { EmptyState, Loader, ConfirmModal } from '../components/UI.jsx'

const empty = { name: '', phone: '', email: '', address: '', tax_no: '', notes: '' }

export default function Suppliers() {
  const { t } = useLang()
  const [suppliers, setSuppliers] = useState(null)
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => api.get('/suppliers').then(setSuppliers).catch(() => setSuppliers([]))
  useEffect(load, [])

  const filtered = useMemo(() => {
    if (!suppliers) return []
    const q = query.trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter((s) =>
      s.name.toLowerCase().includes(q) ||
      (s.phone || '').includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    )
  }, [suppliers, query])

  const openAdd = () => { setError(''); setModal({ ...empty }) }
  const openEdit = (s) => { setError(''); setModal({ id: s.id, ...s }) }

  const save = async () => {
    if (!modal.name.trim()) { setError(t('required')); return }
    setSaving(true)
    try {
      if (modal.id) await api.put('/suppliers/' + modal.id, modal)
      else await api.post('/suppliers', modal)
      setModal(null)
      load()
    } catch (e) { setError(e.message) }
    finally { setSaving(false) }
  }

  const remove = async () => {
    await api.del('/suppliers/' + deleting.id)
    setDeleting(null)
    load()
  }

  if (!suppliers) return <Loader />

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
                <th>{t('due')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7}><EmptyState /></td></tr>}
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td className="font-bold">🏭 {s.name}</td>
                  <td dir="ltr">{s.phone || '—'}</td>
                  <td className="text-muted">{s.email || '—'}</td>
                  <td className="text-muted">{s.address || '—'}</td>
                  <td>{s.purchase_count || 0}</td>
                  <td>
                    {Number(s.outstanding) > 0
                      ? <span className="badge badge-out">{Number(s.outstanding).toLocaleString()}</span>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" onClick={() => openEdit(s)}>✏️</button>
                      <button className="icon-btn danger" onClick={() => setDeleting(s)}>🗑️</button>
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
          <div className="form-row">
            <div className="field">
              <label>{t('address')}</label>
              <input value={modal.address} onChange={(e) => setModal({ ...modal, address: e.target.value })} />
            </div>
            <div className="field">
              <label>{t('tax_no')}</label>
              <input value={modal.tax_no} onChange={(e) => setModal({ ...modal, tax_no: e.target.value })} />
            </div>
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
