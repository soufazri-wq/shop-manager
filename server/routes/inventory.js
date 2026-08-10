import express from 'express';
import db from '../db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.get('/warehouses', auth('inventory'), (req, res) => {
  res.json(db.prepare('SELECT * FROM warehouses ORDER BY name').all());
});

router.post('/warehouses', auth('inventory'), (req, res) => {
  const { name, location } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Warehouse name is required' });
  const info = db.prepare('INSERT INTO warehouses (name, location) VALUES (?, ?)').run(name, location || null);
  res.json(db.prepare('SELECT * FROM warehouses WHERE id = ?').get(info.lastInsertRowid));
});

router.delete('/warehouses/:id', auth('inventory'), (req, res) => {
  db.prepare('DELETE FROM warehouses WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/stock', auth('inventory'), (req, res) => {
  const rows = db.prepare(`
    SELECT s.product_id, s.warehouse_id, s.quantity, w.name as warehouse_name, p.name as product_name, p.sku
    FROM stock s
    JOIN products p ON p.id = s.product_id AND p.active = 1
    JOIN warehouses w ON w.id = s.warehouse_id
    WHERE s.quantity != 0
    ORDER BY p.name COLLATE NOCASE
  `).all();
  res.json(rows);
});

router.get('/low-stock', auth('inventory'), (req, res) => {
  const rows = db.prepare(`
    SELECT p.id, p.name, p.sku, p.min_stock,
      COALESCE((SELECT SUM(s.quantity) FROM stock s WHERE s.product_id = p.id), 0) as total_stock,
      p.unit
    FROM products p
    WHERE p.active = 1 AND COALESCE((SELECT SUM(s.quantity) FROM stock s WHERE s.product_id = p.id), 0) <= p.min_stock
    ORDER BY total_stock ASC
  `).all();
  res.json(rows);
});

router.get('/movements', auth('inventory'), (req, res) => {
  const { from, to, product_id, type } = req.query;
  let sql = `
    SELECT m.*, p.name as product_name, w.name as warehouse_name, u.name as user_name
    FROM stock_movements m
    JOIN products p ON p.id = m.product_id
    LEFT JOIN warehouses w ON w.id = m.warehouse_id
    LEFT JOIN users u ON u.id = m.user_id
    WHERE 1=1`;
  const params = [];
  if (from) { sql += ' AND date(m.created_at) >= date(?)'; params.push(from); }
  if (to) { sql += ' AND date(m.created_at) <= date(?)'; params.push(to); }
  if (product_id) { sql += ' AND m.product_id = ?'; params.push(product_id); }
  if (type) { sql += ' AND m.type = ?'; params.push(type); }
  sql += ' ORDER BY m.id DESC LIMIT 500';
  res.json(db.prepare(sql).all(...params));
});

router.post('/adjust', auth('inventory'), (req, res) => {
  const { product_id, warehouse_id, quantity, note } = req.body || {};
  if (!product_id || !warehouse_id || quantity === undefined) {
    return res.status(400).json({ error: 'product_id, warehouse_id and quantity are required' });
  }
  const qty = Number(quantity);
  db.prepare(`
    INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)
    ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = ?
  `).run(product_id, warehouse_id, qty, qty);
  db.prepare(`
    INSERT INTO stock_movements (product_id, warehouse_id, type, quantity, note, user_id)
    VALUES (?, ?, 'adjust', ?, ?, ?)
  `).run(product_id, warehouse_id, qty, note || 'تسوية جرد', req.user.id);
  res.json({ success: true });
});

export default router;
