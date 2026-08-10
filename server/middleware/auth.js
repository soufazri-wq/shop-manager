import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'shop-manager-secret-key-2026';
export const ROLES = ['admin', 'manager', 'cashier', 'warehouse'];

export const PERMISSIONS = {
  admin: ['*'],
  manager: ['dashboard', 'products', 'inventory', 'sales', 'pos', 'purchases', 'suppliers', 'customers', 'reports', 'employees_read'],
  cashier: ['dashboard', 'pos', 'sales_read', 'customers'],
  warehouse: ['dashboard', 'products', 'inventory'],
};

export function hasPermission(role, perm) {
  if (!role) return false;
  const perms = PERMISSIONS[role] || [];
  return perms.includes('*') || perms.includes(perm);
}

export function auth(required = null) {
  return (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = payload;
      if (required && !hasPermission(payload.role, required)) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      next();
    } catch (e) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}
