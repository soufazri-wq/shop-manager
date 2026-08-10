import express from 'express';
import db from '../db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth(), (req, res) => {
  const products = db.prepare(`
    SELECT p.*, c.name as category_name,
      COALESCE((SELECT SUM(s.quantity) FROM stock s WHERE s.product_id = p.id), 0) as total_stock
    FROM products p LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.active = 1
    ORDER BY p.name COLLATE NOCASE
  `).all();
  res.json(products);
});

router.post('/', auth('products'), (req, res) => {
  const { name, sku, barcode, category_id, unit, cost_price, sale_price, min_stock, quantity } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Product name is required' });
  try {
    const info = db.prepare(`
      INSERT INTO products (name, sku, barcode, category_id, unit, cost_price, sale_price, min_stock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name, sku || null, barcode || null, category_id || null,
      unit || 'قطعة', Number(cost_price) || 0, Number(sale_price) || 0, Number(min_stock) || 0
    );
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid);
    const qty = Number(quantity) || 0;
    if (qty > 0) {
      const wh = db.prepare('SELECT id FROM warehouses ORDER BY id LIMIT 1').get();
      if (wh) {
        db.prepare(`
          INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)
          ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = quantity + ?
        `).run(product.id, wh.id, qty, qty);
        db.prepare(`
          INSERT INTO stock_movements (product_id, warehouse_id, type, quantity, ref_type, ref_id, note, user_id)
          VALUES (?, ?, 'in', ?, 'product', ?, ?, ?)
        `).run(product.id, wh.id, qty, product.id, 'الرصيد الافتتاحي عند إنشاء المنتج', req.user.id);
      }
    }
    res.json(product);
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(400).json({ error: 'SKU already exists' });
    throw e;
  }
});

router.put('/:id', auth('products'), (req, res) => {
  const { name, sku, barcode, category_id, unit, cost_price, sale_price, min_stock, active } = req.body || {};
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found' });
  try {
    db.prepare(`
      UPDATE products SET name=?, sku=?, barcode=?, category_id=?, unit=?, cost_price=?, sale_price=?, min_stock=?, active=?
      WHERE id=?
    `).run(
      name ?? existing.name, sku ?? existing.sku, barcode ?? existing.barcode,
      category_id === undefined ? existing.category_id : category_id,
      unit ?? existing.unit,
      cost_price === undefined ? existing.cost_price : Number(cost_price),
      sale_price === undefined ? existing.sale_price : Number(sale_price),
      min_stock === undefined ? existing.min_stock : Number(min_stock),
      active === undefined ? existing.active : (active ? 1 : 0),
      existing.id
    );
    res.json({ success: true });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(400).json({ error: 'SKU already exists' });
    throw e;
  }
});

router.delete('/:id', auth('products'), (req, res) => {
  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/categories', auth(), (req, res) => {
  const categories = db.prepare(`
    SELECT c.*, COUNT(p.id) as product_count FROM categories c
    LEFT JOIN products p ON p.category_id = c.id AND p.active = 1
    GROUP BY c.id ORDER BY c.name COLLATE NOCASE
  `).all();
  res.json(categories);
});

router.post('/categories', auth('products'), (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Category name is required' });
  const info = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
  res.json(db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid));
});

router.delete('/categories/:id', auth('products'), (req, res) => {
  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

export default router;
