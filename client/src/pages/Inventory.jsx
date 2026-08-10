import React, { useState, useEffect, useMemo } from 'react'
import { api } from '../api.js'
import { useLang } from '../context/LangContext.jsx'
import Modal from '../components/Modal.jsx'
import { EmptyState, Loader } from '../components/UI.jsx'

export default function Inventory() {
  const { t } = useLang()
  const [tab, setTab] = useState('stock')
  const [warehouses, setWarehouses] = useState([])
  const [stock, setStock] = useState(null)
  const [movements, setMovements] = useState([])
  const [products, setProducts] = useState([])
  const [adjusting, setAdjusting] = useState(null)
  const [error, setError] = useState('')
  const [typeFilter, setTypeFilter] = useState('')

  const load = () => {
    api.get('/inventory/warehouses').then(setWarehouses).catch(() => setWarehouses([]))
    api.get('/inventory/stock').then(setStock).catch(() => setStock([]))
    api.get('/inventory/movements').then(setMovements).catch(() => setMovements([]))
    api.get('/products').then(setProducts).catch(() => setProducts([]))
  }

  useEffect(load, [])

  const filteredMovements = useMemo(() => {
    if (!typeFilter) return movements
    return movements.filter((m) => m.type === typeFilter)
  }, [movements, typeFilter])

  const totalStockValue = useMemo(() => {
    if (!stock) return 0
    return stock.reduce((sum, s) => {
      const p = products.find((pr) => pr.id === s.product_id)
      return sum + s.quantity * (p ? p.cost_price : 0)
    }, 0)
  }, [stock, products])

  const adjust = async () => {
    if (!adjusting.product_id || !adjusting.warehouse_id) { setError(t('required')); return }
    setError('')
    await api.post('/inventory/adjust', adjusting)
    setAdjusting(null)
    load()
  }

  return (
    <div>
      <div className="tabs">
        <button className={`tab-btn ${tab === 'stock' ? 'active' : ''}`} onClick={() => setTab('stock')}>
          {t('stockLevels')}
        </button>
        <button className={`tab-btn ${tab === 'warehouses' ? 'active' : ''}`} onClick={() => setTab('warehouses')}>
          {t('warehouses')}
        </button>
        <button className={`tab-btn ${tab === 'movements' ? 'active' : ''}`} onClick={() => setTab('movements')}>
          {t('movements')}
        </button>
      </div>

      {tab === 'stock' && (
        <>
          <div className="mini-stats mb-16">
            <div className="mini-stat">
              <div className="ms-value">{stock ? stock.length : 0}</div>
              <div className="ms-label">{t('products')}</div>
            </div>
            <div className="mini-stat">
              <div className="ms-value">{totalStockValue.toLocaleString()}</div>
              <div className="ms-label">{t('stockValue')}</div>
            </div>
          </div>
          <div className="card">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('product')}</th>
                    <th>{t('sku')}</th>
                    {warehouses.map((w) => (
                      <th key={w.id}>{w.name}</th>
                    ))}
                    <th>{t('stock')}</th>
                    <th>{t('actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {!stock || stock.length === 0 ? (
                    <tr><td colSpan={warehouses.length + 4}><EmptyState /></td></tr>
                  ) : (
                    (() => {
                      const byProduct = {}
                      stock.forEach((s) => {
                        if (!byProduct[s.product_id]) byProduct[s.product_id] = []
                        byProduct[s.product_id].push(s)
                      })
                      const productsWithStock = Object.keys(byProduct).map((pid) => ({
                        product_id: Number(pid),
                        product_name: byProduct[pid][0].product_name,
                        sku: byProduct[pid][0].sku,
                        rows: byProduct[pid],
                      }))
                      return productsWithStock.map((p) => {
                        const total = p.rows.reduce((s, r) => s + r.quantity, 0)
                        return (
                          <tr key={p.product_id}>
                            <td className="font-bold">{p.product_name}</td>
                            <td className="text-muted">{p.sku || '—'}</td>
                            {warehouses.map((w) => {
                              const row = p.rows.find((r) => r.warehouse_id === w.id)
                              return <td key={w.id}>{row ? Number(row.quantity).toLocaleString() : '0'}</td>
                            })}
                            <td className="font-bold">{total.toLocaleString()}</td>
                            <td>
                              <button className="btn btn-outline btn-sm" onClick={() => setAdjusting({ product_id: p.product_id, warehouse_id: warehouses[0]?.id || '', quantity: total })}>
                                ✏️ {t('adjustStock')}
                              </button>
                            </td>
                          </tr>
                        )
                      })
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'warehouses' && (
        <WarehousesTab warehouses={warehouses} onChanged={load} />
      )}

      {tab === 'movements' && (
        <div className="card">
          <div className="card-header">
            <h3>{t('movements')}</h3>
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px' }}>
              <option value="">{t('all')}</option>
              <option value="in">{t('in')}</option>
              <option value="out">{t('out')}</option>
              <option value="adjust">{t('adjustment')}</option>
            </select>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('date')}</th>
                  <th>{t('product')}</th>
                  <th>{t('warehouse')}</th>
                  <th>{t('type')}</th>
                  <th>{t('quantity')}</th>
                  <th>{t('ref')}</th>
                  <th>{t('notes')}</th>
                  <th>{t('cashier')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.length === 0 ? (
                  <tr><td colSpan={8}><EmptyState /></td></tr>
                ) : (
                  filteredMovements.slice(0, 200).map((m) => (
                    <tr key={m.id}>
                      <td className="text-muted">{String(m.created_at).slice(0, 16)}</td>
                      <td className="font-bold">{m.product_name}</td>
                      <td>{m.warehouse_name || '—'}</td>
                      <td>
                        <span className={`badge badge-${m.type}`}>
                          {t(m.type)}
                        </span>
                      </td>
                      <td className="font-bold">{Number(m.quantity).toLocaleString()}</td>
                      <td className="text-muted">{m.ref_id ? `#${m.ref_id}` : '—'}</td>
                      <td className="text-muted">{m.note || '—'}</td>
                      <td className="text-muted">{m.user_name || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {adjusting && (
        <Modal
          title={t('adjustStock')}
          onClose={() => setAdjusting(null)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setAdjusting(null)}>{t('cancel')}</button>
              <button className="btn" onClick={adjust}>{t('save')}</button>
            </>
          }
        >
          {error && <div className="form-error">{error}</div>}
          <div className="field">
            <label>{t('product')}</label>
            <select value={adjusting.product_id || ''} onChange={(e) => setAdjusting({ ...adjusting, product_id: Number(e.target.value) })}>
              <option value="">{t('all')}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="field">
              <label>{t('warehouse')}</label>
              <select value={adjusting.warehouse_id || ''} onChange={(e) => setAdjusting({ ...adjusting, warehouse_id: Number(e.target.value) })}>
                <option value="">{t('all')}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>{t('quantity')}</label>
              <input type="number" step="0.01" value={adjusting.quantity} onChange={(e) => setAdjusting({ ...adjusting, quantity: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>{t('notes')}</label>
            <textarea rows="2" value={adjusting.note || ''} onChange={(e) => setAdjusting({ ...adjusting, note: e.target.value })} />
          </div>
        </Modal>
      )}
    </div>
  )
}

function WarehousesTab({ warehouses, onChanged }) {
  const { t } = useLang()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')

  const add = async () => {
    if (!name.trim()) return
    await api.post('/inventory/warehouses', { name, location })
    setAdding(false)
    setName('')
    setLocation('')
    onChanged()
  }

  return (
    <div className="card">
      <div className="card-header">
        <h3>{t('warehouses')}</h3>
        <button className="btn" onClick={() => setAdding(true)}>＋ {t('addWarehouse')}</button>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>{t('name')}</th>
              <th>{t('location')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {warehouses.length === 0 ? (
              <tr><td colSpan={3}><EmptyState /></td></tr>
            ) : (
              warehouses.map((w) => (
                <tr key={w.id}>
                  <td className="font-bold">🏬 {w.name}</td>
                  <td>{w.location || '—'}</td>
                  <td>
                    <button className="icon-btn danger" onClick={async () => { await api.del('/inventory/warehouses/' + w.id); onChanged() }}>🗑️</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {adding && (
        <Modal
          title={t('addWarehouse')}
          onClose={() => setAdding(false)}
          footer={
            <>
              <button className="btn btn-ghost" onClick={() => setAdding(false)}>{t('cancel')}</button>
              <button className="btn" onClick={add}>{t('save')}</button>
            </>
          }
        >
          <div className="field">
            <label>{t('name')} *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>{t('location')}</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
        </Modal>
      )}
    </div>
  )
}
