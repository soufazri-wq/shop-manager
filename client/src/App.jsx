import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext.jsx'
import { useLang } from './context/LangContext.jsx'
import Layout from './components/Layout.jsx'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import POS from './pages/POS.jsx'
import Sales from './pages/Sales.jsx'
import Products from './pages/Products.jsx'
import Inventory from './pages/Inventory.jsx'
import Purchases from './pages/Purchases.jsx'
import Suppliers from './pages/Suppliers.jsx'
import Customers from './pages/Customers.jsx'
import Employees from './pages/Employees.jsx'
import Reports from './pages/Reports.jsx'
import Settings from './pages/Settings.jsx'
import NotFound from './pages/NotFound.jsx'
import OfflineNotice from './components/OfflineNotice.jsx'
import LicenseGate from './components/LicenseGate.jsx'

function Protected({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return <div className="page-loader">{'...'}</div>
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

function App() {
  const { t } = useLang()
  return (
    <>
      <OfflineNotice />
      <LicenseGate>
        <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="pos" element={<POS />} />
        <Route path="sales" element={<Sales />} />
        <Route path="products" element={<Products />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="customers" element={<Customers />} />
        <Route path="employees" element={<Employees />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      </Routes>
      </LicenseGate>
    </>
  )
}

export default App
