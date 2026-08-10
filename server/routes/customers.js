import express from 'express';
import db from '../db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth('customers'), (req, res) => {
  const customers = db.prepare(`
    SELECT c.*,
      (SELECT COUNT(*) FROM sales s WHERE s.customer_id = c.id) as sales_count,
      (SELECT COALESCE(SUM(s.total), 0) FROM sales s WHERE s.customer_id = c.id) as total_spent,
      (SELECT COALESCE(SUM(s.total - s.paid), 0) FROM sales s WHERE s.customer_id = c.id AND s.paid < s.total) as outstanding
    FROM customers c ORDER BY c.name COLLATE NOCASE
  `).all();
  res.json(customers);
});

router.post('/', auth('customers'), (req, res) => {
  const { name, phone, email, address, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Customer name is required' });
  const info = db.prepare(`
    INSERT INTO customers (name, phone, email, address, notes) VALUES (?, ?, ?, ?, ?)
  `).run(name, phone || null, email || null, address || null, notes || null);
  res.json(db.prepare('SELECT * FROM customers WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', auth('customers'), (req, res) => {
  const { name, phone, email, address, notes } = req.body || {};
  const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Customer not found' });
  db.prepare('UPDATE customers SET name=?, phone=?, email=?, address=?, notes=? WHERE id=?')
    .run(name ?? existing.name, phone ?? existing.phone, email ?? existing.email,
      address ?? existing.address, notes ?? existing.notes, existing.id);
  res.json({ success: true });
});

router.delete('/:id', auth('customers'), (req, res) => {
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
