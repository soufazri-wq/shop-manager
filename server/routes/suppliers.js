import express from 'express';
import db from '../db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth('suppliers'), (req, res) => {
  const suppliers = db.prepare(`
    SELECT s.*,
      (SELECT COUNT(*) FROM purchases p WHERE p.supplier_id = s.id) as purchase_count,
      (SELECT COALESCE(SUM(p.total - p.paid), 0) FROM purchases p WHERE p.supplier_id = s.id AND p.paid < p.total) as outstanding
    FROM suppliers s ORDER BY s.name COLLATE NOCASE
  `).all();
  res.json(suppliers);
});

router.post('/', auth('suppliers'), (req, res) => {
  const { name, phone, email, address, tax_no, notes } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Supplier name is required' });
  const info = db.prepare(`
    INSERT INTO suppliers (name, phone, email, address, tax_no, notes) VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, phone || null, email || null, address || null, tax_no || null, notes || null);
  res.json(db.prepare('SELECT * FROM suppliers WHERE id = ?').get(info.lastInsertRowid));
});

router.put('/:id', auth('suppliers'), (req, res) => {
  const { name, phone, email, address, tax_no, notes } = req.body || {};
  const existing = db.prepare('SELECT * FROM suppliers WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Supplier not found' });
  db.prepare('UPDATE suppliers SET name=?, phone=?, email=?, address=?, tax_no=?, notes=? WHERE id=?')
    .run(name ?? existing.name, phone ?? existing.phone, email ?? existing.email,
      address ?? existing.address, tax_no ?? existing.tax_no, notes ?? existing.notes, existing.id);
  res.json({ success: true });
});

router.delete('/:id', auth('suppliers'), (req, res) => {
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
