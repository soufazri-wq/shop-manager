import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { useLang } from '../context/LangContext.jsx'
import { Loader } from '../components/UI.jsx'

function useNow() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

export default function POS() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')
  const now = useNow()

  const toLatin = (s) => String(s).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))

  const [products, setProducts] = useState(null)
  const [warehouses, setWarehouses] = useState([])
  const [customers, setCustomers] = useState([])
  const [categories, setCategories] = useState([])
  const [currency, setCurrency] = useState('ر.س')
  const [taxRate, setTaxRate] = useState(0)
  const [warehouseId, setWarehouseId] = useState(null)
  const [customerId, setCustomerId] = useState('')
  const [invoiceNo, setInvoiceNo] = useState('FA000000001')

  const [cart, setCart] = useState({})
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [discount, setDiscount] = useState(0)
  const [paid, setPaid] = useState('')
  const [method, setMethod] = useState('cash')
  const [selectedId, setSelectedId] = useState(null)

  const [toast, setToast] = useState('')
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [customerOpen, setCustomerOpen] = useState(false)
  const [success, setSuccess] = useState(null)
  const [receipt, setReceipt] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [showDiscount, setShowDiscount] = useState(false)
  const [showCats, setShowCats] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [error, setError] = useState('')
  const [minimized, setMinimized] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editingInvoice, setEditingInvoice] = useState('')

  const searchRef = useRef(null)
  const tableRef = useRef(null)

  useEffect(() => {
    api.get('/products').then(setProducts).catch(() => setProducts([]))
    api.get('/inventory/warehouses').then((w) => {
      setWarehouses(w)
      if (w.length) setWarehouseId(w[0].id)
    }).catch(() => {})
    api.get('/customers').then(setCustomers).catch(() => setCustomers([]))
    api.get('/products/categories').then(setCategories).catch(() => {})
    api.get('/settings').then((s) => {
      if (s.currency) setCurrency(s.currency)
      if (s.tax_rate !== undefined) setTaxRate(Number(s.tax_rate) || 0)
    }).catch(() => {})
    api.get('/sales/next-no').then((d) => d.invoice_no && !editId && setInvoiceNo(d.invoice_no)).catch(() => {})
  }, [])

  useEffect(() => {
    if (!editId) return
    let cancelled = false
    api.get('/sales/' + editId).then((sale) => {
      if (cancelled || !sale) return
      const cart = {}
      ;(sale.items || []).forEach((it) => {
        cart[it.product_id] = {
          id: it.product_id,
          name: it.product_name || '',
          sku: it.sku || it.product_id,
          sale_price: Number(it.price),
          qty: Number(it.quantity),
          lineTotal: Number(it.total),
        }
      })
      setCart(cart)
      setCustomerId(sale.customer_id ? String(sale.customer_id) : '')
      setDiscount(Number(sale.discount) || 0)
      const taxable = Math.max(0, (Number(sale.subtotal) || 0) - (Number(sale.discount) || 0))
      setTaxRate(taxable > 0 ? +((Number(sale.tax) || 0) / taxable * 100).toFixed(2) : 0)
      if (sale.warehouse_id) setWarehouseId(sale.warehouse_id)
      setInvoiceNo(sale.invoice_no)
      setEditingId(sale.id)
      setEditingInvoice(sale.invoice_no)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [editId])

  useEffect(() => {
    if (!editId && editingId) {
      setEditingId(null)
      setEditingInvoice('')
    }
  }, [editId, editingId])

  const showToast = useCallback((m) => {
    setToast(m)
    setTimeout(() => setToast(''), 2500)
  }, [])

  const stockByProduct = useMemo(() => {
    const map = {}
    if (!products) return map
    products.forEach((p) => { map[p.id] = Number(p.total_stock) || 0 })
    return map
  }, [products])

  const filtered = useMemo(() => {
    if (!products) return []
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      if (category && Number(p.category_id) !== Number(category)) return false
      if (!q) return true
      return p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q) || (p.barcode || '').includes(q)
    }).slice(0, 8)
  }, [products, query, category])

  const addToCart = useCallback((p) => {
    const available = stockByProduct[p.id] || 0
    const current = cart[p.id] ? cart[p.id].qty : 0
    if (available <= current) { showToast('الكمية غير متوفرة'); return }
    setCart((c) => {
      const qty = current + 1
      return { ...c, [p.id]: { ...p, qty, lineTotal: +(qty * p.sale_price).toFixed(2) } }
    })
    setSelectedId(p.id)
  }, [cart, stockByProduct, showToast])

  const setQty = (id, qty) => {
    const p = cart[id]
    if (!p) return
    const available = stockByProduct[id] || 0
    if (qty <= 0) {
      setCart((c) => { const n = { ...c }; delete n[id]; return n })
      if (selectedId === id) setSelectedId(null)
      return
    }
    if (qty > available) { showToast('الكمية غير متوفرة'); return }
    setCart((c) => ({ ...c, [id]: { ...p, qty, lineTotal: +(qty * p.sale_price).toFixed(2) } }))
  }

  const removeItem = (id) => {
    setCart((c) => { const n = { ...c }; delete n[id]; return n })
    if (selectedId === id) setSelectedId(null)
  }

  const items = Object.values(cart)
  const subtotal = items.reduce((s, i) => s + i.lineTotal, 0)
  const disc = Number(discount) || 0
  const taxable = Math.max(0, subtotal - disc)
  const tax = +(taxable * (Number(taxRate) || 0) / 100).toFixed(2)
  const total = +(taxable + tax).toFixed(2)
  const paidNum = paid === '' ? total : Number(paid)
  const change = Math.max(0, paidNum - total)

  const displayText = items.length ? `${total.toLocaleString()} ${currency}` : 'أهلاً بكم في المتجر 👋'

  const clearCart = () => {
    setCart({})
    setPaid('')
    setDiscount(0)
    setSelectedId(null)
    setConfirmClear(false)
    setEditingId(null)
    setEditingInvoice('')
  }

  const openPayment = (m) => {
    if (!items.length) { showToast('السلة فارغة'); return }
    setMethod(m)
    setPaid('')
    setPaymentOpen(true)
  }

  const checkout = async () => {
    await postSale(paidNum, method)
  }

  const postSale = async (paidAmount, payMethod) => {
    if (!items.length) return null
    if (!warehouseId) { setError('اختر مستودعاً'); return null }
    setError('')
    setCheckingOut(true)
    const snapshot = { invoiceNo: editingInvoice || invoiceNo, date: toLatin(now.toLocaleString('ar-EG')), items, total, currency }
    try {
      const body = {
        customer_id: customerId ? Number(customerId) : null,
        items: items.map((i) => ({ product_id: i.id, quantity: i.qty, price: i.sale_price })),
        discount: disc,
        tax_rate: Number(taxRate) || 0,
        warehouse_id: Number(warehouseId),
      }
      let sale
      if (editingId) {
        sale = await api.put('/sales/' + editingId, body)
      } else {
        body.paid = paidAmount
        body.payment_method = payMethod
        sale = await api.post('/sales', body)
      }
      setSuccess({ id: sale.id, invoice_no: sale.invoice_no, total: sale.total, change: editingId ? 0 : Math.max(0, paidAmount - sale.total) })
      setInvoiceNo(sale.invoice_no)
      api.get('/sales/next-no').then((d) => d.invoice_no && setInvoiceNo(d.invoice_no)).catch(() => {})
      setCart({})
      setPaid('')
      setDiscount(0)
      setSelectedId(null)
      setPaymentOpen(false)
      if (editingId) {
        setEditingId(null)
        setEditingInvoice('')
        navigate('/pos', { replace: true })
      }
      return { sale, snapshot }
    } catch (e) {
      setError(e.message)
      showToast(e.message)
      return null
    } finally {
      setCheckingOut(false)
    }
  }

  const saveAndPrint = async () => {
    const res = await postSale(total, 'cash')
    if (res) setReceipt({ ...res.snapshot, invoiceNo: res.sale.invoice_no, total: res.sale.total })
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F4') {
        e.preventDefault()
        if (editingId) { postSale(total, 'cash'); return }
        if (items.length) openPayment('cash')
        else showToast('السلة فارغة')
      } else if (e.key === 'F5') {
        e.preventDefault()
        saveAndPrint()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [items.length, showToast, saveAndPrint, editingId, total])

  const exportCart = () => {
    if (!items.length) { showToast('السلة فارغة'); return }
    const lines = items.map((i) => `${i.sku || i.id}\t${i.name}\t${i.qty}\t${i.sale_price}\t${i.lineTotal}`)
    const text = ['نظام تسيير المحلات', invoiceNo, now.toLocaleString(), '', ...lines, '', `الإجمالي: ${total} ${currency}`].join('\n')
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${invoiceNo}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
    showToast('تم تصدير الفاتورة')
  }

  const handleKey = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered.length) addToCart(filtered[0])
    } else if (e.key === 'Escape') {
      setQuery('')
    }
  }

  if (!products) return <Loader />

  return (
    <div className={`pos-window ${fullscreen ? 'full' : ''} ${minimized ? 'minimized' : ''}`}>
      {/* 1. Title bar */}
      <div className="pos-titlebar">
        <div className="pos-title">{editingInvoice ? `✏️ تعديل ${editingInvoice}` : 'comptoirrrs'}</div>
        <div className="pos-title-controls">
          <button className="pos-tc" title="تصغير" onClick={() => setMinimized((v) => !v)}>─</button>
          <button className="pos-tc" title="استعادة الحجم" onClick={() => setFullscreen((v) => !v)}>▢</button>
          <button className="pos-tc close" title="إغلاق" onClick={() => navigate('/')}>✕</button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Edit banner */}
          {editingInvoice && (
            <div className="pos-edit-banner">✏️ تعديل الفاتورة <b>{editingInvoice}</b> — بعد الحفظ تُحدَّث الفاتورة بدل إنشاء فاتورة جديدة</div>
          )}

          {/* 2. Info bar */}
          <div className="pos-infobar">
            <div className="pos-infobuttons">
              <button className="pos-infobtn" title="العميل" onClick={() => setCustomerOpen(true)}>🪪</button>
              <button className="pos-infobtn" title="المستخدم">{'👤'}</button>
              <button className="pos-infobtn" title="المفضلة">{'❤️'}</button>
            </div>
            <div className="pos-sale-info">
              <div className="pos-info-item">
                <span className="pos-info-label">رقم البيع</span>
                <span className="pos-info-value fa-no">{invoiceNo}</span>
              </div>
              <div className="pos-info-item">
                <span className="pos-info-label">تاريخ البيع</span>
                <span className="pos-info-value date">
                  {toLatin(now.toLocaleDateString('ar-EG'))} — {toLatin(now.toLocaleTimeString('ar-EG'))}
                </span>
              </div>
            </div>
            <div className={`pos-display ${items.length ? 'pos-display-total' : ''}`}>{displayText}</div>
            <div className="pos-side-info">
              <div className="pos-side-row">{t('warehouse')}: <b>{warehouses.find((w) => w.id === warehouseId)?.name || '—'}</b></div>
              <div className="pos-side-row">عميل: <b>{customers.find((c) => c.id === Number(customerId))?.name || 'متفرج'}</b></div>
              <div className="pos-side-row">{t('items')}: <b>{items.length}</b></div>
            </div>
          </div>

          {/* 3. Toolbar */}
          <div className="pos-toolbar">
            <button className="pos-tool-btn" title="مساعدة" onClick={() => showToast('مساعدة: استخدم البحث ثم Enter لإضافة المنتج')}>؟</button>
            <button className="pos-tool-btn" title="T9 / بحث سريع" onClick={() => searchRef.current && searchRef.current.focus()}>T9</button>
            <button className="pos-tool-btn" title="تعديل" onClick={() => { if (selectedId) { const el = document.querySelector(`.pos-qty-${selectedId}`); if (el) { el.focus(); el.select() } } else showToast('اختر سطراً أولاً') }}>✏️</button>
            <button className="pos-tool-btn cancel" title="إلغاء" onClick={() => setConfirmClear(true)}>✕</button>
            <button className="pos-tool-btn" title="طباعة" onClick={() => { if (items.length) setReceipt({ invoiceNo, date: toLatin(now.toLocaleString('ar-EG')), items, total, currency }); else showToast('السلة فارغة') }}>🖨️</button>
            <button className="pos-tool-btn" title="عروض" onClick={() => setShowDiscount((v) => !v)}>🏷️</button>
            <button className="pos-tool-btn" title="تصدير" onClick={exportCart}>📤</button>
            <button className="pos-tool-btn" title="إضافة إلى السلة" onClick={() => searchRef.current && searchRef.current.focus()}>🛒</button>
            <button className="pos-tool-btn box" title="المنتجات" onClick={() => setShowCats((v) => !v)}>📦</button>
          </div>

          {/* 4. Search bar */}
          <div className="pos-searchbar">
            <button className="pos-barcode-btn" title="مسح الباركود" onClick={() => { searchRef.current && searchRef.current.focus(); showToast('امسح الباركود ثم اضغط Enter') }}>▣</button>
            <div className="pos-search-wrap">
              <input
                ref={searchRef}
                className="pos-search-input"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKey}
                placeholder="ابحث عن منتج بالاسم أو الرمز أو الباركود…"
              />
              {query.trim() !== '' && (
                <div className="pos-search-dropdown">
                  {filtered.length === 0 && <div className="pos-sd-empty">لا توجد نتائج</div>}
                  {filtered.map((p) => (
                    <div key={p.id} className="pos-sd-item" onClick={() => { addToCart(p); setQuery('') }}>
                      <span className="pos-sd-name">{p.name}</span>
                      <span className="pos-sd-sku">{p.sku || p.id}</span>
                      <span className="pos-sd-price">{Number(p.sale_price).toLocaleString()} {currency} · متاح {stockByProduct[p.id] || 0}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Category chips */}
          {showCats && (
            <div className="pos-cat-chips">
              <button className={`pos-cat-chip ${category === '' ? 'active' : ''}`} onClick={() => setCategory('')}>{t('all')}</button>
              {categories.map((c) => (
                <button key={c.id} className={`pos-cat-chip ${category === String(c.id) ? 'active' : ''}`} onClick={() => setCategory(String(c.id))}>{c.name}</button>
              ))}
            </div>
          )}

          {/* 5+6. Body */}
          <div className="pos-body">
            <div className="pos-main">
              <div className="pos-table-wrap" ref={tableRef}>
                <table className="pos-table">
                  <thead>
                    <tr>
                      <th className="th-id"><span className="th-search-icon">🔍</span> {t('posColId')}</th>
                      <th>{t('posColName')}</th>
                      <th className="th-qty">{t('posColQty')}</th>
                      <th className="th-prix">{t('posColPrice')}</th>
                      <th className="th-montant">{t('posColAmount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && (
                      <tr className="pos-empty-row">
                        <td colSpan={5}>
                          <div className="pos-empty">
                            <div className="pos-empty-icon">🧾</div>
                            <div>الفاتورة فارغة — ابحث عن منتج وأضفه</div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {items.map((i) => (
                      <tr key={i.id} className={`pos-row ${selectedId === i.id ? 'selected' : ''}`} onClick={() => setSelectedId(i.id)}>
                        <td className="td-id">{i.sku || i.id}</td>
                        <td className="td-name">{i.name}</td>
                        <td className="td-qty">
                          <div className="pos-qtyctl">
                            <button onClick={(e) => { e.stopPropagation(); setQty(i.id, i.qty - 1) }}>−</button>
                            <input className={`pos-qty-input pos-qty-${i.id}`} value={i.qty} onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setQty(i.id, parseInt(e.target.value) || 0)} />
                            <button onClick={(e) => { e.stopPropagation(); setQty(i.id, i.qty + 1) }}>+</button>
                          </div>
                        </td>
                        <td className="td-prix">{Number(i.sale_price).toLocaleString()}</td>
                        <td className="td-montant">
                          <span>{i.lineTotal.toLocaleString()}</span>
                          <button className="pos-row-del" title="حذف" onClick={(e) => { e.stopPropagation(); removeItem(i.id) }}>🗑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>

            <div className="pos-side">
              <div className="pos-side-head">{t('cart')}</div>
              <div className="pos-sum-row"><span>{t('subtotal')}</span><span>{subtotal.toLocaleString()} {currency}</span></div>
              <div className="pos-sum-row"><span>{t('discount')}</span><span>−{disc.toLocaleString()}</span></div>
              <div className="pos-sum-row"><span>{t('tax')}</span><span>{tax.toLocaleString()}</span></div>
              <div className="pos-sum-row grand"><span>{t('totalDue')}</span><span>{total.toLocaleString()} {currency}</span></div>
              {change > 0 && <div className="pos-sum-row change"><span>{t('changeDue')}</span><span>{change.toLocaleString()}</span></div>}

              <button className="pos-totals-btn" onClick={() => setShowDiscount((v) => !v)}>🏷️ عروض</button>
              {showDiscount && (
                <div className="pos-discount-box">
                  <label>{t('discount')}</label>
                  <input type="number" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
                  <label>{t('tax')} %</label>
                  <input type="number" min="0" value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
                </div>
              )}

              <button className="pos-save" onClick={() => editingId ? postSale(total, 'cash') : openPayment('cash')}>
                <span>💾 {editingId ? 'حفظ التعديل' : t('save')}</span>
                <kbd>F4</kbd>
              </button>
              <button className="pos-save-print" onClick={saveAndPrint}>
                <span>💾🖨 حفظ مع الطباعة</span>
                <kbd>F5</kbd>
              </button>
            </div>
          </div>

          {error && <div className="pos-error-bar">{error}</div>}
          {toast && <div className="pos-toast">{toast}</div>}
        </>
      )}

      {/* Payment modal */}
      {paymentOpen && (
        <div className="modal-overlay" onClick={() => setPaymentOpen(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{method === 'eur' ? '💶 الدفع باليورو' : `💵 ${t('checkout')}`}</h3>
              <button className="icon-btn" onClick={() => setPaymentOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="pos-pay-total">
                <div className="pos-pay-label">{t('totalDue')}</div>
                <div className="pos-pay-amount">{total.toLocaleString()} {method === 'eur' ? '€' : currency}</div>
              </div>
              <div className="field">
                <label>{t('paidAmount')}</label>
                <input type="number" min="0" step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder={total.toFixed(2)} autoFocus />
              </div>
              {change > 0 && <div className="pos-pay-change">الباقي: <b>{change.toLocaleString()} {method === 'eur' ? '€' : currency}</b></div>}
              {error && <div className="form-error" style={{ marginTop: 8 }}>{error}</div>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setPaymentOpen(false)}>{t('cancel')}</button>
              <button className="btn btn-success" disabled={checkingOut} onClick={checkout}>
                {checkingOut ? t('loading') : `تأكيد الدفع · ${total.toLocaleString()}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Customer modal */}
      {customerOpen && (
        <div className="modal-overlay" onClick={() => setCustomerOpen(false)}>
          <div className="modal" style={{ maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🪪 {t('customer')}</h3>
              <button className="icon-btn" onClick={() => setCustomerOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="field">
                <label>{t('customer')}</label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">{t('walkin')}</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>{t('warehouse')}</label>
                <select value={warehouseId || ''} onChange={(e) => setWarehouseId(Number(e.target.value))}>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn" onClick={() => setCustomerOpen(false)}>{t('close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm clear */}
      {confirmClear && (
        <div className="modal-overlay" onClick={() => setConfirmClear(false)}>
          <div className="modal" style={{ maxWidth: 340, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-body" style={{ padding: '24px' }}>
              <div style={{ fontSize: 40 }}>⚠️</div>
              <h3 style={{ marginTop: 10 }}>إلغاء الفاتورة الحالية؟</h3>
              <div className="text-muted" style={{ marginTop: 6 }}>سيتم حذف كل المنتجات من السلة.</div>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmClear(false)}>{t('cancel')}</button>
              <button className="btn btn-danger" onClick={clearCart}>نعم، ألغِ</button>
            </div>
          </div>
        </div>
      )}

      {/* Success modal */}
      {success && (
        <div className="modal-overlay" onClick={() => setSuccess(null)}>
          <div className="modal" style={{ maxWidth: 420, textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-body" style={{ padding: '30px' }}>
              <div style={{ fontSize: 52 }}>✅</div>
              <h3 style={{ margin: '12px 0 6px' }}>{success.invoice_no}</h3>
              <div className="text-muted mb-16">{t('salesTitle')}</div>
              <div className="stat-value text-primary">{success.total.toLocaleString()} {currency}</div>
              {success.change > 0 && (
                <div className="pos-sum-row grand mt-16" style={{ justifyContent: 'center' }}>
                  <span>{t('changeDue')}: </span><span className="text-success font-bold">{success.change.toLocaleString()}</span>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center' }}>
              <button className="btn btn-ghost" onClick={() => setSuccess(null)}>{t('close')}</button>
              <button className="btn btn-primary" onClick={() => { setSuccess(null); navigate('/sales') }}>{t('salesTitle')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt print modal */}
      {receipt && (
        <div className="modal-overlay" onClick={() => setReceipt(null)}>
          <div className="modal" style={{ maxWidth: 340 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🧾 الطباعة</h3>
              <button className="icon-btn" onClick={() => setReceipt(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="receipt-print">
                <div className="rp-head">
                  <div className="rp-title">نظام تسيير المحلات</div>
                  <div>{receipt.invoiceNo}</div>
                  <div>{receipt.date}</div>
                </div>
                <hr />
                {receipt.items.map((i) => (
                  <div className="rp-line" key={i.id}>
                    <span>{i.name}</span>
                    <span>{i.qty} × {Number(i.sale_price).toLocaleString()} = {i.lineTotal.toLocaleString()}</span>
                  </div>
                ))}
                <hr />
                <div className="rp-total"><span>الإجمالي</span><span>{receipt.total.toLocaleString()} {receipt.currency}</span></div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setReceipt(null)}>{t('close')}</button>
              <button className="btn btn-primary" onClick={() => window.print()}>🖨 طباعة</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
