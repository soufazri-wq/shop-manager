import React, { useState, useEffect, useMemo } from 'react'
import { api } from '../api.js'
import { useLang } from '../context/LangContext.jsx'
import Modal from '../components/Modal.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { EmptyState, Loader, ConfirmModal } from '../components/UI.jsx'

export default function Purchases() {
  const { t } = useLang()
  const [purchases, setPurchases] = useState(null)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [currency, setCurrency] = useState('ر.س')

  const load = () => {
    api.get('/purchases').then(setPurchases).catch(() => setPurchases([]))
    api.get('/settings').then((s) => s.currency && setCurrency(s.currency)).catch(() => {})
  }

  useEffect(load, [])

  const filtered = useMemo(() => {
    if (!purchases) return []
    const q = query.trim().toLowerCase()
    return purchases.filter((p) => !q || p.purchase_no.toLowerCase().includes(q) || (p.supplier_name || '').toLowerCase().includes(q))
  }, [purchases, query])

  const remove = async () => {
    await api.del('/purchases/' + deleting.id)
    setDeleting(null)
    load()
  }

  if (!purchases) return <Loader />

  return (
    <div>
      <div className="toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search')} />
        </div>
        <button className="btn" onClick={() => setCreating(true)}>＋ {t('newPurchase')}</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('purchaseNo')}</th>
                <th>{t('date')}</th>
                <th>{t('supplier')}</th>
                <th>{t('total')}</th>
                <th>{t('paid')}</th>
                <th>{t('status')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7}><EmptyState /></td></tr>
              )}
              {filtered.map((p) => (
                <tr key={p.id}>
                  <td className="font-bold">{p.purchase_no}</td>
                  <td className="text-muted">{String(p.date).slice(0, 10)}</td>
                  <td>{p.supplier_name || '—'}</td>
                  <td className="font-bold">{Number(p.total).toLocaleString()} {currency}</td>
                  <td>{Number(p.paid).toLocaleString()}</td>
                  <td><StatusBadge status={p.status} /></td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" title={t('viewInvoice')} onClick={() => setViewing(p)}>👁️</button>
                      <button className="icon-btn danger" title={t('delete')} onClick={() => setDeleting(p)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {creating && <PurchaseForm onClose={() => setCreating(false)} onSaved={load} />}
      {viewing && <PurchaseView id={viewing.id} onClose={() => setViewing(null)} onChanged={load} />}
      <ConfirmModal open={!!deleting} title={t('delete')} onConfirm={remove} onCancel={() => setDeleting(null)} />
    </div>
  )
}

function PurchaseForm({ onClose, onSaved }) {
  const { t } = useLang()
  const [products, setProducts] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [warehouses, setWarehouses] = useState([])
  const [supplierId, setSupplierId] = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [items, setItems] = useState([])
  const [productId, setProductId] = useState('')
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState('')
  const [discount, setDiscount] = useState(0)
  const [taxRate, setTaxRate] = useState(0)
  const [paid, setPaid] = useState(0)
  const [method, setMethod] = useState('cash')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/products').then(setProducts).catch(() => {})
    api.get('/suppliers').then(setSuppliers).catch(() => {})
    api.get('/inventory/warehouses').then((w) => {
      setWarehouses(w)
      if (w.length) setWarehouseId(w[0].id)
    }).catch(() => {})
  }, [])

  const addItem = () => {
    if (!productId || !qty || qty <= 0) return
    const p = products.find((pr) => pr.id === Number(productId))
    const unitPrice = price === '' ? p.sale_price : Number(price)
    const exists = items.findIndex((i) => i.product_id === Number(productId))
    if (exists >= 0) {
      const next = [...items]
      next[exists].qty += Number(qty)
      next[exists].lineTotal = next[exists].qty * unitPrice
      setItems(next)
    } else {
      setItems([...items, { product_id: p.id, name: p.name, qty: Number(qty), price: unitPrice, lineTotal: Number(qty) * unitPrice }])
    }
    setProductId('')
    setQty(1)
    setPrice('')
  }

  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0)
  const disc = Number(discount) || 0
  const tax = (Math.max(0, subtotal - disc) * (Number(taxRate) || 0)) / 100
  const total = Math.max(0, subtotal - disc) + tax

  const save = async () => {
    if (!items.length) { setError(t('required')); return }
    if (!warehouseId) { setError(t('required')); return }
    setSaving(true)
    try {
      await api.post('/purchases', {
        supplier_id: supplierId ? Number(supplierId) : null,
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.qty, price: i.price })),
        discount: disc,
        tax_rate: Number(taxRate) || 0,
        paid: Number(paid) || 0,
        payment_method: method,
        warehouse_id: Number(warehouseId),
      })
      onSaved()
      onClose()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={t('newPurchase')} onClose={onClose} size="lg"
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose}>{t('cancel')}</button>
          <button className="btn btn-success" onClick={save} disabled={saving}>{saving ? t('loading') : t('save')}</button>
        </>
      }
    >
      {error && <div className="form-error">{error}</div>}
      <div className="form-row">
        <div className="field">
          <label>{t('supplier')}</label>
          <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">{t('all')}</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="field">
          <label>{t('warehouse')}</label>
          <select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
      </div>

      <div className="card-pad" style={{ background: 'var(--bg)', borderRadius: 12, marginBottom: 16 }}>
        <div className="form-row-3">
          <div className="field">
            <label>{t('product')}</label>
            <select value={productId} onChange={(e) => { setProductId(e.target.value); const p = products.find((pr) => pr.id === Number(e.target.value)); if (p) setPrice(p.cost_price || '') }}>
              <option value="">—</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>{t('quantity')}</label>
            <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div className="field">
            <label>{t('price')}</label>
            <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </div>
        <button className="btn btn-sm" onClick={addItem}>＋ {t('add')}</button>

        {items.length > 0 && (
          <div className="table-wrap mt-16">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('product')}</th>
                  <th>{t('quantity')}</th>
                  <th>{t('price')}</th>
                  <th>{t('total')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((i, idx) => (
                  <tr key={idx}>
                    <td className="font-bold">{i.name}</td>
                    <td>{i.qty}</td>
                    <td>{i.price}</td>
                    <td className="font-bold">{i.lineTotal.toLocaleString()}</td>
                    <td><button className="icon-btn danger" onClick={() => setItems(items.filter((_, k) => k !== idx))}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="form-row-3">
        <div className="field">
          <label>{t('discount')}</label>
          <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
        </div>
        <div className="field">
          <label>{t('tax')} %</label>
          <input type="number" min="0" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
        </div>
        <div className="field">
          <label>{t('paidAmount')}</label>
          <input type="number" min="0" value={paid} onChange={(e) => setPaid(e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label>{t('paymentMethod')}</label>
        <select value={method} onChange={(e) => setMethod(e.target.value)}>
          <option value="cash">{t('cash')}</option>
          <option value="card">{t('card')}</option>
          <option value="transfer">{t('transfer')}</option>
        </select>
      </div>

      <div className="summary-row"><span>{t('subtotal')}</span><span>{subtotal.toLocaleString()}</span></div>
      <div className="summary-row grand"><span>{t('totalDue')}</span><span>{total.toLocaleString()}</span></div>
    </Modal>
  )
}

function PurchaseView({ id, onClose, onChanged }) {
  const { t } = useLang()
  const [purchase, setPurchase] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [error, setError] = useState('')
  const [currency, setCurrency] = useState('ر.س')

  useEffect(() => {
    api.get('/purchases/' + id).then(setPurchase).catch(() => {})
    api.get('/settings').then((s) => s.currency && setCurrency(s.currency)).catch(() => {})
  }, [id])

  if (!purchase) return <Loader />

  const paidTotal = purchase.payments.reduce((s, p) => s + p.amount, 0)
  const remaining = Math.max(0, purchase.total - paidTotal)

  const addPayment = async () => {
    if (!payAmount || Number(payAmount) <= 0) { setError(t('required')); return }
    setError('')
    try {
      await api.post(`/purchases/${id}/pay`, { amount: Number(payAmount), method: payMethod })
      setPayAmount('')
      const fresh = await api.get('/purchases/' + id)
      setPurchase(fresh)
      onChanged && onChanged()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <Modal title={`${t('purchaseNo')} ${purchase.purchase_no}`} onClose={onClose} size="lg">
      <div className="invoice-meta">
        <div className="meta-item"><span className="meta-label">{t('date')}:</span><span className="meta-value">{String(purchase.date).slice(0, 16)}</span></div>
        <div className="meta-item"><span className="meta-label">{t('supplier')}:</span><span className="meta-value">{purchase.supplier_name || '—'}</span></div>
        <div className="meta-item"><span className="meta-label">{t('status')}:</span><StatusBadge status={purchase.status} /></div>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t('product')}</th>
              <th>{t('price')}</th>
              <th>{t('quantity')}</th>
              <th>{t('total')}</th>
            </tr>
          </thead>
          <tbody>
            {purchase.items.map((it) => (
              <tr key={it.id}>
                <td className="font-bold">{it.product_name}</td>
                <td>{Number(it.price).toLocaleString()}</td>
                <td>{Number(it.quantity).toLocaleString()}</td>
                <td className="font-bold">{Number(it.total).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="invoice-meta">
        <div className="mini-stats">
          <div className="mini-stat">
            <div className="ms-label">{t('subtotal')}</div>
            <div className="ms-value">{Number(purchase.subtotal).toLocaleString()}</div>
          </div>
          <div className="mini-stat">
            <div className="ms-label">{t('discount')}</div>
            <div className="ms-value">{Number(purchase.discount).toLocaleString()}</div>
          </div>
          <div className="mini-stat">
            <div className="ms-label">{t('totalDue')}</div>
            <div className="ms-value text-primary">{Number(purchase.total).toLocaleString()} {currency}</div>
          </div>
        </div>
      </div>

      {remaining > 0 && (
        <div className="card-pad mt-16" style={{ background: 'var(--bg)', borderRadius: 12 }}>
          <div className="summary-row">
            <span className="font-bold">{t('due')}:</span>
            <span className="font-bold text-danger">{remaining.toLocaleString()} {currency}</span>
          </div>
          {error && <div className="form-error" style={{ marginTop: 8 }}>{error}</div>}
          <div className="form-row-3 mt-16">
            <div className="field">
              <label>{t('amount')}</label>
              <input type="number" min="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
            </div>
            <div className="field">
              <label>{t('paymentMethod')}</label>
              <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                <option value="cash">{t('cash')}</option>
                <option value="card">{t('card')}</option>
                <option value="transfer">{t('transfer')}</option>
              </select>
            </div>
            <div className="field" style={{ alignSelf: 'flex-end' }}>
              <button className="btn btn-success btn-block" onClick={addPayment}>＋ {t('addPayment')}</button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
