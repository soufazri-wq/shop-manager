import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useLang } from '../context/LangContext.jsx'
import Modal from '../components/Modal.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import { EmptyState, Loader, ConfirmModal } from '../components/UI.jsx'

export default function Sales() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [sales, setSales] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [viewing, setViewing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [currency, setCurrency] = useState('ر.س')

  const load = () => {
    api.get('/sales').then(setSales).catch(() => setSales([]))
    api.get('/settings').then((s) => s.currency && setCurrency(s.currency)).catch(() => {})
  }

  useEffect(load, [])

  const filtered = useMemo(() => {
    if (!sales) return []
    const q = query.trim().toLowerCase()
    return sales.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false
      if (!q) return true
      return s.invoice_no.toLowerCase().includes(q) || (s.customer_name || '').toLowerCase().includes(q)
    })
  }, [sales, query, statusFilter])

  const remove = async () => {
    await api.del('/sales/' + deleting.id)
    setDeleting(null)
    load()
  }

  if (!sales) return <Loader />

  return (
    <div>
      <div className="toolbar">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search')} />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '9px 12px' }}>
          <option value="">{t('all')}</option>
          <option value="paid">{t('paid')}</option>
          <option value="partial">{t('partial')}</option>
          <option value="unpaid">{t('unpaid')}</option>
        </select>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('invoiceNo')}</th>
                <th>{t('date')}</th>
                <th>{t('customer')}</th>
                <th>{t('cashier')}</th>
                <th>{t('total')}</th>
                <th>{t('paid')}</th>
                <th>{t('status')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8}><EmptyState /></td></tr>
              )}
              {filtered.map((s) => (
                <tr key={s.id}>
                  <td className="font-bold">{s.invoice_no}</td>
                  <td className="text-muted">{String(s.date).slice(0, 10)}</td>
                  <td>{s.customer_name || t('walkin')}</td>
                  <td className="text-muted">{s.user_name || '—'}</td>
                  <td className="font-bold">{Number(s.total).toLocaleString()} {currency}</td>
                  <td>{Number(s.paid_total || s.paid).toLocaleString()}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-btn" title={t('viewInvoice')} onClick={() => setViewing(s)}>👁️</button>
                      <button className="icon-btn" title={t('edit')} onClick={() => navigate('/pos?edit=' + s.id)}>✏️</button>
                      <button className="icon-btn" title={t('print')} onClick={() => { setViewing(s); setTimeout(() => window.print(), 300) }}>🖨️</button>
                      <button className="icon-btn danger" title={t('delete')} onClick={() => setDeleting(s)}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {viewing && (
        <InvoiceModal
          id={viewing.id}
          onClose={() => setViewing(null)}
          onChanged={load}
        />
      )}

      <ConfirmModal open={!!deleting} title={t('delete')} onConfirm={remove} onCancel={() => setDeleting(null)} />
    </div>
  )
}

function InvoiceModal({ id, onClose, onChanged }) {
  const { t } = useLang()
  const [sale, setSale] = useState(null)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('cash')
  const [error, setError] = useState('')
  const [currency, setCurrency] = useState('ر.س')

  useEffect(() => {
    api.get('/sales/' + id).then(setSale).catch(() => {})
    api.get('/settings').then((s) => s.currency && setCurrency(s.currency)).catch(() => {})
  }, [id])

  if (!sale) return <Loader />

  const paidTotal = sale.payments.reduce((s, p) => s + p.amount, 0)
  const remaining = Math.max(0, sale.total - paidTotal)

  const addPayment = async () => {
    if (!payAmount || Number(payAmount) <= 0) { setError(t('required')); return }
    setError('')
    try {
      await api.post(`/sales/${id}/pay`, { amount: Number(payAmount), method: payMethod })
      setPayAmount('')
      const fresh = await api.get('/sales/' + id)
      setSale(fresh)
      onChanged && onChanged()
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <Modal title={`${t('invoice')} ${sale.invoice_no}`} onClose={onClose} size="lg">
      <div className="invoice-meta no-print">
        <div className="meta-item"><span className="meta-label">{t('date')}:</span><span className="meta-value">{String(sale.date).slice(0, 16)}</span></div>
        <div className="meta-item"><span className="meta-label">{t('customer')}:</span><span className="meta-value">{sale.customer_name || t('walkin')}</span></div>
        <div className="meta-item"><span className="meta-label">{t('cashier')}:</span><span className="meta-value">{sale.user_name || '—'}</span></div>
        <div className="meta-item"><span className="meta-label">{t('status')}:</span><StatusBadge status={sale.status} /></div>
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
            {sale.items.map((it) => (
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
            <div className="ms-value">{Number(sale.subtotal).toLocaleString()}</div>
          </div>
          <div className="mini-stat">
            <div className="ms-label">{t('discount')}</div>
            <div className="ms-value">{Number(sale.discount).toLocaleString()}</div>
          </div>
          <div className="mini-stat">
            <div className="ms-label">{t('tax')}</div>
            <div className="ms-value">{Number(sale.tax).toLocaleString()}</div>
          </div>
          <div className="mini-stat">
            <div className="ms-label">{t('totalDue')}</div>
            <div className="ms-value text-primary">{Number(sale.total).toLocaleString()} {currency}</div>
          </div>
        </div>
      </div>

      <div className="d-flex justify-between mt-16 no-print">
        <h4 className="font-bold">{t('payment')}</h4>
        <button className="btn btn-outline btn-sm" onClick={() => window.print()}>🖨️ {t('print')}</button>
      </div>

      {sale.payments.length > 0 && (
        <div className="table-wrap mt-16 no-print">
          <table className="table">
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('amount')}</th>
                <th>{t('paymentMethod')}</th>
              </tr>
            </thead>
            <tbody>
              {sale.payments.map((p) => (
                <tr key={p.id}>
                  <td className="text-muted">{String(p.date).slice(0, 16)}</td>
                  <td className="font-bold">{Number(p.amount).toLocaleString()}</td>
                  <td>{t(p.method)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {remaining > 0 && (
        <div className="card-pad mt-16 no-print" style={{ background: 'var(--bg)', borderRadius: 12 }}>
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
              <button className="btn btn-success btn-block" onClick={addPayment}>
                ＋ {t('addPayment')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
