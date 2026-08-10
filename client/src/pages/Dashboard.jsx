import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useLang } from '../context/LangContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { Loader, EmptyState } from '../components/UI.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'

function StatCard({ icon, color, value, label }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon icon-${color}`}>{icon}</div>
      <div>
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}

function fmt(n) {
  return (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export default function Dashboard() {
  const { t } = useLang()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [overview, setOverview] = useState([])
  const [recent, setRecent] = useState([])
  const [lowStock, setLowStock] = useState([])
  const [currency, setCurrency] = useState('ر.س')

  useEffect(() => {
    api.get('/reports/dashboard').then(setData).catch(() => {})
    api.get('/reports/sales-overview?days=14').then(setOverview).catch(() => {})
    api.get('/sales?from=&to=').then((s) => setRecent(s.slice(0, 6))).catch(() => {})
    api.get('/inventory/low-stock').then(setLowStock).catch(() => {})
    api.get('/settings').then((s) => s.currency && setCurrency(s.currency)).catch(() => {})
  }, [])

  if (!data) return <Loader />

  const chartData = overview.map((r) => ({
    day: r.day,
    [t('sales')]: Number(r.total),
  }))

  return (
    <div>
      <div className="stats-grid">
        <StatCard
          icon="💰"
          color="green"
          value={`${fmt(data.salesToday)} ${currency}`}
          label={t('salesToday')}
        />
        <StatCard
          icon="🧾"
          color="blue"
          value={fmt(data.salesCountToday)}
          label={t('salesCountToday')}
        />
        <StatCard
          icon="📈"
          color="purple"
          value={`${fmt(data.salesMonth)} ${currency}`}
          label={t('salesMonth')}
        />
        <StatCard
          icon="🏆"
          color="amber"
          value={`${fmt(data.profitMonth)} ${currency}`}
          label={t('profitMonth')}
        />
        <StatCard
          icon="📦"
          color="cyan"
          value={fmt(data.productCount)}
          label={t('totalProducts')}
        />
        <StatCard
          icon="👥"
          color="pink"
          value={fmt(data.customerCount)}
          label={t('totalCustomers')}
        />
        <StatCard
          icon="⚠️"
          color="red"
          value={fmt(data.lowStock)}
          label={t('lowStockAlert')}
        />
        <StatCard
          icon="🏦"
          color="teal"
          value={`${fmt(data.receivable)} ${currency}`}
          label={t('receivable')}
        />
      </div>

      <div className="grid-2 mb-16">
        <div className="card">
          <div className="card-header">
            <h3>{t('salesOverview')}</h3>
          </div>
          <div className="card-pad">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 13 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 13 }} stroke="#94a3b8" />
                  <Tooltip />
                  <Area type="monotone" dataKey={t('sales')} stroke="#4f46e5" strokeWidth={2.5} fill="url(#colorSales)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState />
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>{t('recentSales')}</h3>
          </div>
          <div className="card-pad" style={{ maxHeight: 320, overflowY: 'auto' }}>
            {recent.length === 0 ? (
              <EmptyState />
            ) : (
              recent.map((s) => (
                <div
                  key={s.id}
                  className="cart-line"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate('/sales')}
                >
                  <div className="cl-info">
                    <div className="cl-name">{s.invoice_no}</div>
                    <div className="cl-price">
                      {s.customer_name || t('walkin')} · {String(s.date).slice(0, 10)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold">{fmt(s.total)} {currency}</div>
                    <StatusBadge status={s.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="card mb-16">
          <div className="card-header">
            <h3>⚠️ {t('lowStockAlert')}</h3>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/inventory')}>
              {t('inventoryTitle')}
            </button>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('product')}</th>
                  <th>{t('sku')}</th>
                  <th>{t('stock')}</th>
                  <th>{t('minStock')}</th>
                </tr>
              </thead>
              <tbody>
                {lowStock.slice(0, 8).map((p) => (
                  <tr key={p.id}>
                    <td className="font-bold">{p.name}</td>
                    <td className="text-muted">{p.sku}</td>
                    <td>
                      <span className="badge badge-out">{fmt(p.total_stock)}</span>
                    </td>
                    <td>{fmt(p.min_stock)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {user.role !== 'cashier' && (
        <div className="card">
          <div className="card-header">
            <h3>{t('salesReport')}</h3>
            <button className="btn btn-outline btn-sm" onClick={() => navigate('/reports')}>
              {t('reports')} →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
