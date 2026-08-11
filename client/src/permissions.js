export const NAV = [
  { path: '/', key: 'dashboard', icon: '📊' },
  { path: '/pos', key: 'pos', icon: '🛒' },
  { path: '/sales', key: 'sales', icon: '🧾' },
  { path: '/products', key: 'products', icon: '📦' },
  { path: '/inventory', key: 'inventory', icon: '🏬' },
  { path: '/purchases', key: 'purchases', icon: '🚚' },
  { path: '/suppliers', key: 'suppliers', icon: '🏭' },
  { path: '/customers', key: 'customers', icon: '👥' },
  { path: '/employees', key: 'employees', icon: '🛡️' },
  { path: '/reports', key: 'reports', icon: '📈' },
  { path: '/settings', key: 'settings', icon: '⚙️' },
]

export const ROLE_ACCESS = {
  admin: NAV.map((n) => n.path),
  manager: NAV.map((n) => n.path),
  cashier: ['/', '/pos', '/sales', '/customers', '/settings'],
  warehouse: ['/', '/products', '/inventory', '/settings'],
}

export function getRolePages(role) {
  const allowed = ROLE_ACCESS[role] || []
  return NAV.filter((n) => allowed.includes(n.path))
}
