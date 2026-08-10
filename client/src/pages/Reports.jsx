import React, { useState, useEffect } from 'react'
import { api } from '../api.js'
import { useLang } from '../context/LangContext.jsx'
import { Loader } from '../components/UI.jsx'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, Legend, PieChart, Pie, Cell,
} from 'recharts'

const COLORS = ['#4f46e5', '#7c3aed', '#0891b2', '#16a34a', '#d97706', '#dc2626', '#db2777', '#9333ea']

export default function Reports() {
  const { t } = useLang()
  const [overview, setOverview] = useState(null)
  const [topProducts, setTopProducts] = useState([])
  const [profit, setProfit] = useState(null)
  const [currency, setCurrency] = useState('ر.س')

  useEffect(() => {
    api.get('/reports/sales-overview?days=30').then(setOverview).catch(() => setOverview([]))
    api.get('/reports/top-products?limit=10').then(setTopProducts).catch(() => setTopProducts([]))
    api.get('/reports/profit?months=6').then(setProfit).catch(() => setProfit([]))
    api.get('/settings').then((s) => s.currency && setCurrency(s.currency)).catch(() => {})
  }, [])

  if (!overview || !profit) return <Loader />

  const salesData = overview.map((r) => ({ day: r.day, [t('sales')]: Number(r.total), [t('count')]: r.count }))
  const profitData = profit.map((r) => ({
    month: r.month,
    [t('revenue')]: Number(r.sales),
    [t('profit')]: Number(r.profit),
  }))

  return (
    <div>
      <h3 className="font-bold mb-16">{t('reportsTitle')}</h3>

      <div className="grid-2 mb-16">
        <div className="card">
          <div className="card-header"><h3>{t('salesReport')} · {t('last30Days')}</h3></div>
          <div className="card-pad">
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={salesData}>
                <defs>
                  <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="day" tick={{ fontSize: 13 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 13 }} stroke="#94a3b8" />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey={t('sales')} stroke="#4f46e5" strokeWidth={2.5} fill="url(#gSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>{t('profitReport')}</h3></div>
          <div className="card-pad">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={profitData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 13 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 13 }} stroke="#94a3b8" />
                <Tooltip />
                <Legend />
                <Bar dataKey={t('revenue')} fill="#a5b4fc" radius={[4, 4, 0, 0]} />
                <Bar dataKey={t('profit')} fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-header"><h3>{t('topProducts')}</h3></div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('product')}</th>
                  <th>{t('quantity')}</th>
                  <th>{t('revenue')}</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.length === 0 && <tr><td colSpan={4} className="text-center text-muted">{t('noData')}</td></tr>}
                {topProducts.map((p, i) => (
                  <tr key={i}>
                    <td><span className="badge badge-gray">{i + 1}</span></td>
                    <td className="font-bold">{p.name}</td>
                    <td>{Number(p.qty).toLocaleString()}</td>
                    <td className="font-bold">{Number(p.revenue).toLocaleString()} {currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>{t('topProducts')} %</h3></div>
          <div className="card-pad">
            {topProducts.length ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={topProducts.slice(0, 6)}
                    dataKey="revenue"
                    nameKey="name"
                    cx="50%" cy="50%"
                    outerRadius={110}
                    label={({ name }) => (name.length > 14 ? name.slice(0, 12) + '…' : name)}
                    labelLine={false}
                  >
                    {topProducts.slice(0, 6).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">{t('noData')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
