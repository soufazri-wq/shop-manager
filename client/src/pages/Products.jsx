import React, { useState, useEffect, useMemo } from 'react'
import { api } from '../api.js'
import { useLang } from '../context/LangContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import Modal from '../components/Modal.jsx'
import { EmptyState, Loader, ConfirmModal } from '../components/UI.jsx'

const emptyProduct = {
  name: '', sku: '', barcode: '', category_id: '', unit: 'قطعة',
  cost_price: 0, sale_price: 0, min_stock: 0, quantity: '',
}

export default function Products() {
  const { t } = useLang()
  const { user } = useAuth()
  const [products, setProducts] = useState(null)
  const [categories, setCategories] = useState([])
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(null)
  const [catModal, setCatModal] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = () => {
    api.get('/products').then(setProducts).catch(() => setProducts([]))
    api.get('/products/categories').then(setCategories).catch(() => {})
  }

  useEffect(load, [])

  const filtered = useMemo(() => {
    if (!products) return []
    const q = query.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.barcode || '').toLowerCase().includes(q)
    )
  }, [products, query])

  const openAdd = () => { setError(''); setModal({ ...emptyProduct }) }
  const openEdit = (p) => {
    setError('')
    setModal({
      id: p.id, name: p.name, sku: p.sku || '', barcode: p.barcode || '',
      category_id: p.category_id || '', unit: p.unit, cost_price: p.cost_price,
      sale_price: p.sale_price, min_stock: p.min_stock, quantity: '',
    })
  }

  const genBarcode = () => {
    let code = '2'
    for (let i = 0; i < 12; i++) code += Math.floor(Math.random() * 10)
    setModal((m) => ({ ...m, barcode: code }))
  }

  const save = async () => {
    if (!modal.name.trim()) { setError(t('required')); return }
    setSaving(true)
    try {
      const body = { ...modal }
      if (body.id) delete body.quantity
      if (body.id) await api.put('/products/' + body.id, body)
      else await api.post('/products', body)
      setModal(null)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    await api.del('/products/' + deleting.id)
    setDeleting(null)
    load()
  }

  const saveCategory = async () => {
    const name = (document.getElementById('cat-name')?.value || '').trim()
    if (!name) return
    await api.post('/products/categories', { name })
    setCatModal(false)
    load()
  }

  if (!products) return <Loader />

  return (
    <div>
      <div className="toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search')} />
        </div>
        <button className="btn btn-outline" onClick={() => setCatModal(true)}>
          📁 {t('categories')}
        </button>
        <button className="btn" onClick={openAdd}>＋ {t('addProduct')}</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('product')}</th>
                <th>{t('sku')}</th>
                <th>{t('category')}</th>
                <th>{t('costPrice')}</th>
                <th>{t('salePrice')}</th>
                <th>{t('stock')}</th>
                <th>{t('minStock')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8}><EmptyState /></td></tr>
              )}
              {filtered.map((p) => {
                const low = Number(p.total_stock) <= Number(p.min_stock)
                return (
                  <tr key={p.id}>
                    <td className="font-bold">{p.name}</td>
                    <td className="text-muted">{p.sku || '—'}</td>
                    <td>{p.category_name || '—'}</td>
                    <td>{Number(p.cost_price).toLocaleString()}</td>
                    <td className="font-bold text-primary">{Number(p.sale_price).toLocaleString()}</td>
                    <td>
                      <span className={`badge ${low ? 'badge-out' : 'badge-gray'}`}>
                        {Number(p.total_stock).toLocaleString()} {p.unit}
                      </span>
                    </td>
                    <td>{Number(p.min_stock).toLocaleString()}</td>
                    <td>
                      <div className="row-actions">
                        <button className="icon-btn" title={t('edit')} onClick={() => openEdit(p)}>✏️</button>
                        <button className="icon-btn danger" title={t('delete')} onClick={() => setDeleting(p)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal
          title={modal.id ? t('editProduct') : t('addProduct')}
          onClose={() => setModal(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setModal(null)}>{t('cancel')}</button>
              <button className="btn" onClick={save} disabled={saving}>
                {saving ? t('loading') : t('save')}
              </button>
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
              <label>{t('category')}</label>
              <select value={modal.category_id || ''} onChange={(e) => setModal({ ...modal, category_id: e.target.value || null })}>
                <option value="">{t('all')}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>{t('sku')}</label>
              <input value={modal.sku} onChange={(e) => setModal({ ...modal, sku: e.target.value })} />
            </div>
            <div className="field">
              <label>{t('barcode')}</label>
              <div className="d-flex" style={{ gap: 8 }}>
                <input className="grow" value={modal.barcode} onChange={(e) => setModal({ ...modal, barcode: e.target.value })} />
                <button type="button" className="btn btn-outline" onClick={genBarcode} title={t('generateBarcode')}>🎲 {t('generateBarcode')}</button>
              </div>
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>{t('unit')}</label>
              <input value={modal.unit} onChange={(e) => setModal({ ...modal, unit: e.target.value })} />
            </div>
            <div className="field">
              <label>{t('minStock')}</label>
              <input type="number" min="0" value={modal.min_stock} onChange={(e) => setModal({ ...modal, min_stock: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>{t('costPrice')}</label>
              <input type="number" min="0" step="0.01" value={modal.cost_price} onChange={(e) => setModal({ ...modal, cost_price: e.target.value })} />
            </div>
            <div className="field">
              <label>{t('salePrice')} *</label>
              <input type="number" min="0" step="0.01" value={modal.sale_price} onChange={(e) => setModal({ ...modal, sale_price: e.target.value })} />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>{t('quantity')}</label>
              <input type="number" min="0" value={modal.quantity} onChange={(e) => setModal({ ...modal, quantity: e.target.value })} placeholder={t('stock')} />
            </div>
            <div className="field">
              <label>{t('warehouse')}</label>
              <div className="text-muted" style={{ paddingTop: 6 }}>سيُضاف الرصيد إلى أول مستودع تلقائياً</div>
            </div>
          </div>
        </Modal>
      )}

      {catModal && (
        <Modal
          title={t('categories')}
          onClose={() => setCatModal(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setCatModal(false)}>{t('close')}</button>
            </>
          }
        >
          <div className="d-flex mb-16">
            <input id="cat-name" className="grow" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px' }} placeholder={t('categoryName')} />
            <button className="btn" onClick={saveCategory}>{t('add')}</button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('name')}</th>
                  <th>{t('productCount')}</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td className="font-bold">{c.name}</td>
                    <td>{c.product_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      <ConfirmModal
        open={!!deleting}
        title={t('delete')}
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
