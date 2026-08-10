import express from 'express';
import db from '../db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

function nextPurchaseNo() {
  const row = db.prepare('SELECT purchase_no FROM purchases ORDER BY id DESC LIMIT 1').get();
  const n = row ? parseInt(String(row.purchase_no).replace(/\D/g, ''), 10) || 0 : 0;
  return 'PUR-' + String(n + 1).padStart(5, '0');
}

router.get('/', auth('purchases'), (req, res) => {
  const { from, to, status, supplier_id } = req.query;
  let sql = `
    SELECT p.*, s.name as supplier_name, u.name as user_name
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN users u ON u.id = p.user_id
    WHERE 1=1`;
  const params = [];
  if (from) { sql += ' AND date(p.date) >= date(?)'; params.push(from); }
  if (to) { sql += ' AND date(p.date) <= date(?)'; params.push(to); }
  if (status) { sql += ' AND p.status = ?'; params.push(status); }
  if (supplier_id) { sql += ' AND p.supplier_id = ?'; params.push(supplier_id); }
  sql += ' ORDER BY p.id DESC LIMIT 500';
  res.json(db.prepare(sql).all(...params));
});

router.get('/:id', auth('purchases'), (req, res) => {
  const purchase = db.prepare(`
    SELECT p.*, s.name as supplier_name, s.phone as supplier_phone, u.name as user_name
    FROM purchases p
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    LEFT JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
  `).get(req.params.id);
  if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
  purchase.items = db.prepare(`
    SELECT pi.*, pr.name as product_name, pr.sku FROM purchase_items pi
    JOIN products pr ON pr.id = pi.product_id WHERE pi.purchase_id = ?
  `).all(purchase.id);
  purchase.payments = db.prepare(`SELECT * FROM payments WHERE doc_type='purchase' AND doc_id = ? ORDER BY id`).all(purchase.id);
  res.json(purchase);
});

router.post('/', auth('purchases'), (req, res) => {
  const { supplier_id, items, discount, tax_rate, paid, payment_method, warehouse_id, notes } = req.body || {};
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items' });
  }
  if (!warehouse_id) return res.status(400).json({ error: 'Select a warehouse' });

  const create = db.transaction(() => {
    let subtotal = 0;
    const preparedItems = [];
    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
      if (!product) throw new Error('Product not found');
      const qty = Number(item.quantity);
      if (!qty || qty <= 0) throw new Error('Invalid quantity');
      const price = Number(item.price);
      if (!price || price < 0) throw new Error('Invalid price for ' + product.name);
      const total = +(qty * price).toFixed(2);
      preparedItems.push({ product, qty, price, total });
      subtotal += total;
    }

    const disc = Number(discount) || 0;
    const taxPct = Number(tax_rate) || 0;
    const taxable = Math.max(0, subtotal - disc);
    const tax = +((taxable * taxPct) / 100).toFixed(2);
    const total = +(taxable + tax).toFixed(2);
    const paidAmt = Number(paid) || 0;
    const paidValid = Math.max(0, Math.min(paidAmt, total));
    const status = paidValid >= total ? 'paid' : paidValid > 0 ? 'partial' : 'unpaid';

    const purchase_no = nextPurchaseNo();
    const info = db.prepare(`
      INSERT INTO purchases (purchase_no, supplier_id, subtotal, discount, tax, total, paid, status, payment_method, user_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(purchase_no, supplier_id || null, +subtotal.toFixed(2), disc, tax, total, paidValid,
      status, payment_method || 'cash', req.user.id, notes || null);

    const purchaseId = info.lastInsertRowid;
    for (const pi of preparedItems) {
      db.prepare('INSERT INTO purchase_items (purchase_id, product_id, quantity, price, total) VALUES (?, ?, ?, ?, ?)')
        .run(purchaseId, pi.product.id, pi.qty, pi.price, pi.total);
      db.prepare('INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?) ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = quantity + ?')
        .run(pi.product.id, warehouse_id, pi.qty, pi.qty);
      db.prepare("INSERT INTO stock_movements (product_id, warehouse_id, type, quantity, ref_type, ref_id, note, user_id) VALUES (?, ?, 'in', ?, 'purchase', ?, ?, ?)")
        .run(pi.product.id, warehouse_id, pi.qty, purchaseId, purchase_no, req.user.id);
    }

    if (paidValid > 0) {
      db.prepare('INSERT INTO payments (doc_type, doc_id, amount, method, user_id) VALUES (?, ?, ?, ?, ?)')
        .run('purchase', purchaseId, paidValid, payment_method || 'cash', req.user.id);
    }
    return purchaseId;
  });

  try {
    const id = create();
    res.json(db.prepare('SELECT * FROM purchases WHERE id = ?').get(id));
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

router.post('/:id/pay', auth('purchases'), (req, res) => {
  const { amount, method } = req.body || {};
  const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(req.params.id);
  if (!purchase) return res.status(404).json({ error: 'Purchase not found' });
  const amt = Number(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });
  const paidSoFar = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE doc_type='purchase' AND doc_id=?`).get(purchase.id).total;
  const remaining = +(purchase.total - paidSoFar).toFixed(2);
  if (amt > remaining) return res.status(400).json({ error: 'Amount exceeds remaining balance' });

  const tx = db.transaction(() => {
    db.prepare('INSERT INTO payments (doc_type, doc_id, amount, method, user_id) VALUES (?, ?, ?, ?, ?)')
      .run('purchase', purchase.id, amt, method || 'cash', req.user.id);
    const newPaid = +(paidSoFar + amt).toFixed(2);
    const status = newPaid >= purchase.total ? 'paid' : 'partial';
    db.prepare('UPDATE purchases SET paid = ?, status = ? WHERE id = ?').run(newPaid, status, purchase.id);
  });
  tx();
  res.json({ success: true });
});

router.delete('/:id', auth('purchases'), (req, res) => {
  const tx = db.transaction(() => {
    const items = db.prepare('SELECT * FROM purchase_items WHERE purchase_id = ?').all(req.params.id);
    db.prepare('DELETE FROM purchases WHERE id = ?').run(req.params.id);
    db.prepare("DELETE FROM payments WHERE doc_type = 'purchase' AND doc_id = ?").run(req.params.id);
    for (const item of items) {
      const mv = db.prepare(`SELECT * FROM stock_movements WHERE ref_type='purchase' AND ref_id=? AND product_id=?`)
        .get(req.params.id, item.product_id);
      const wid = mv ? mv.warehouse_id : null;
      if (wid) {
        db.prepare('UPDATE stock SET quantity = quantity - ? WHERE product_id = ? AND warehouse_id = ?')
          .run(item.quantity, item.product_id, wid);
        db.prepare(`DELETE FROM stock_movements WHERE ref_type='purchase' AND ref_id=? AND product_id=?`)
          .run(req.params.id, item.product_id);
      }
    }
  });
  tx();
  res.json({ success: true });
});

export default router;
