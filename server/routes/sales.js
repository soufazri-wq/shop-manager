import express from 'express';
import db from '../db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

function nextInvoiceNo() {
  const row = db.prepare('SELECT invoice_no FROM sales ORDER BY id DESC LIMIT 1').get();
  const n = row ? parseInt(String(row.invoice_no).replace(/\D/g, ''), 10) || 0 : 0;
  return 'FA' + String(n + 1).padStart(9, '0');
}

router.get('/', auth('sales_read'), (req, res) => {
  const { from, to, status, customer_id, q } = req.query;
  let sql = `
    SELECT s.*, c.name as customer_name, u.name as user_name,
      (SELECT COALESCE(SUM(p.amount),0) FROM payments p WHERE p.doc_type='sale' AND p.doc_id=s.id) as paid_total
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN users u ON u.id = s.user_id
    WHERE 1=1`;
  const params = [];
  if (from) { sql += ' AND date(s.date) >= date(?)'; params.push(from); }
  if (to) { sql += ' AND date(s.date) <= date(?)'; params.push(to); }
  if (status) { sql += ' AND s.status = ?'; params.push(status); }
  if (customer_id) { sql += ' AND s.customer_id = ?'; params.push(customer_id); }
  if (q) { sql += ' AND s.invoice_no LIKE ?'; params.push('%' + q + '%'); }
  sql += ' ORDER BY s.id DESC LIMIT 500';
  res.json(db.prepare(sql).all(...params));
});

router.get('/next-no', auth('pos'), (req, res) => {
  res.json({ invoice_no: nextInvoiceNo() });
});

router.get('/:id', auth('sales_read'), (req, res) => {
  const sale = db.prepare(`
    SELECT s.*, c.name as customer_name, c.phone as customer_phone, u.name as user_name
    FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    LEFT JOIN users u ON u.id = s.user_id
    WHERE s.id = ?
  `).get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });
  sale.items = db.prepare(`
    SELECT si.*, p.name as product_name, p.sku FROM sale_items si
    JOIN products p ON p.id = si.product_id WHERE si.sale_id = ?
  `).all(sale.id);
  sale.payments = db.prepare(`SELECT * FROM payments WHERE doc_type='sale' AND doc_id = ? ORDER BY id`).all(sale.id);
  const mv = db.prepare(`SELECT warehouse_id FROM stock_movements WHERE ref_type='sale' AND ref_id=? LIMIT 1`).get(sale.id);
  sale.warehouse_id = mv ? mv.warehouse_id : null;
  res.json(sale);
});

router.post('/', auth('pos'), (req, res) => {
  const { customer_id, items, discount, tax_rate, paid, payment_method, warehouse_id, notes } = req.body || {};
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items' });
  }
  if (!warehouse_id) return res.status(400).json({ error: 'Select a warehouse' });

  const create = db.transaction(() => {
    let subtotal = 0;
    const preparedItems = [];
    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(item.product_id);
      if (!product) throw new Error('Product not found: ' + item.product_id);
      const qty = Number(item.quantity);
      if (!qty || qty <= 0) throw new Error('Invalid quantity for ' + product.name);
      const price = item.price !== undefined ? Number(item.price) : product.sale_price;
      const stockRow = db.prepare('SELECT quantity FROM stock WHERE product_id=? AND warehouse_id=?')
        .get(item.product_id, warehouse_id);
      const available = stockRow ? stockRow.quantity : 0;
      if (available < qty) throw new Error('Insufficient stock for ' + product.name + ' (available: ' + available + ')');
      preparedItems.push({ product, qty, price, total: +(qty * price).toFixed(2) });
      subtotal += preparedItems[preparedItems.length - 1].total;
    }

    const disc = Number(discount) || 0;
    const taxPct = Number(tax_rate) || 0;
    const taxable = Math.max(0, subtotal - disc);
    const tax = +((taxable * taxPct) / 100).toFixed(2);
    const total = +((taxable + tax)).toFixed(2);
    const paidAmt = Number(paid);
    const paidValid = Math.max(0, Math.min(paidAmt, total));
    const status = paidValid >= total ? 'paid' : paidValid > 0 ? 'partial' : 'unpaid';

    const invoice_no = nextInvoiceNo();
    const saleInfo = db.prepare(`
      INSERT INTO sales (invoice_no, customer_id, subtotal, discount, tax, total, paid, status, payment_method, user_id, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(invoice_no, customer_id || null, +subtotal.toFixed(2), disc, tax, total, paidValid,
      status, payment_method || 'cash', req.user.id, notes || null);

    const saleId = saleInfo.lastInsertRowid;
    for (const pi of preparedItems) {
      db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, quantity, price, cost, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(saleId, pi.product.id, pi.qty, pi.price, pi.product.cost_price, pi.total);
      db.prepare(`
        INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)
        ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = quantity - ?
      `).run(pi.product.id, warehouse_id, -pi.qty, pi.qty);
      db.prepare(`
        INSERT INTO stock_movements (product_id, warehouse_id, type, quantity, ref_type, ref_id, note, user_id)
        VALUES (?, ?, 'out', ?, 'sale', ?, ?, ?)
      `).run(pi.product.id, warehouse_id, pi.qty, saleId, invoice_no, req.user.id);
    }

    if (paidValid > 0) {
      db.prepare('INSERT INTO payments (doc_type, doc_id, amount, method, user_id) VALUES (?, ?, ?, ?, ?)')
        .run('sale', saleId, paidValid, payment_method || 'cash', req.user.id);
    }
    return saleId;
  });

  try {
    const id = create();
    res.json(db.prepare('SELECT * FROM sales WHERE id = ?').get(id));
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

router.put('/:id', auth('pos'), (req, res) => {
  const { customer_id, items, discount, tax_rate, payment_method, warehouse_id, notes } = req.body || {};
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'No items' });
  }
  if (!warehouse_id) return res.status(400).json({ error: 'Select a warehouse' });
  const existing = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Sale not found' });

  const update = db.transaction(() => {
    const oldItems = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(existing.id);
    for (const item of oldItems) {
      const mv = db.prepare(`SELECT * FROM stock_movements WHERE ref_type='sale' AND ref_id=? AND product_id=?`)
        .get(existing.id, item.product_id);
      const wid = mv ? mv.warehouse_id : null;
      if (wid) {
        db.prepare('UPDATE stock SET quantity = quantity + ? WHERE product_id = ? AND warehouse_id = ?')
          .run(item.quantity, item.product_id, wid);
      }
    }
    db.prepare("DELETE FROM stock_movements WHERE ref_type='sale' AND ref_id=?").run(existing.id);
    db.prepare('DELETE FROM sale_items WHERE sale_id = ?').run(existing.id);

    let subtotal = 0;
    const preparedItems = [];
    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(item.product_id);
      if (!product) throw new Error('Product not found: ' + item.product_id);
      const qty = Number(item.quantity);
      if (!qty || qty <= 0) throw new Error('Invalid quantity for ' + product.name);
      const price = item.price !== undefined ? Number(item.price) : product.sale_price;
      const stockRow = db.prepare('SELECT quantity FROM stock WHERE product_id=? AND warehouse_id=?')
        .get(item.product_id, warehouse_id);
      const available = stockRow ? stockRow.quantity : 0;
      if (available < qty) throw new Error('Insufficient stock for ' + product.name + ' (available: ' + available + ')');
      preparedItems.push({ product, qty, price, total: +(qty * price).toFixed(2) });
      subtotal += preparedItems[preparedItems.length - 1].total;
    }

    const disc = Number(discount) || 0;
    const taxPct = Number(tax_rate) || 0;
    const taxable = Math.max(0, subtotal - disc);
    const tax = +((taxable * taxPct) / 100).toFixed(2);
    const total = +((taxable + tax)).toFixed(2);
    const paidAmt = db.prepare(`SELECT COALESCE(SUM(amount),0) as t FROM payments WHERE doc_type='sale' AND doc_id=?`).get(existing.id).t;
    const status = paidAmt >= total ? 'paid' : paidAmt > 0 ? 'partial' : 'unpaid';

    db.prepare(`
      UPDATE sales SET customer_id=?, subtotal=?, discount=?, tax=?, total=?, paid=?, status=?, payment_method=?, notes=?
      WHERE id=?
    `).run(customer_id || null, +subtotal.toFixed(2), disc, tax, total, paidAmt,
      status, payment_method || existing.payment_method || 'cash', notes !== undefined ? notes : existing.notes, existing.id);

    for (const pi of preparedItems) {
      db.prepare(`
        INSERT INTO sale_items (sale_id, product_id, quantity, price, cost, total)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(existing.id, pi.product.id, pi.qty, pi.price, pi.product.cost_price, pi.total);
      db.prepare(`
        INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)
        ON CONFLICT(product_id, warehouse_id) DO UPDATE SET quantity = quantity - ?
      `).run(pi.product.id, warehouse_id, -pi.qty, pi.qty);
      db.prepare(`
        INSERT INTO stock_movements (product_id, warehouse_id, type, quantity, ref_type, ref_id, note, user_id)
        VALUES (?, ?, 'out', ?, 'sale', ?, ?, ?)
      `).run(pi.product.id, warehouse_id, pi.qty, existing.id, existing.invoice_no, req.user.id);
    }
  });

  try {
    update();
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(existing.id);
    sale.items = db.prepare(`
      SELECT si.*, p.name as product_name, p.sku FROM sale_items si
      JOIN products p ON p.id = si.product_id WHERE si.sale_id = ?
    `).all(existing.id);
    res.json(sale);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
});

router.post('/:id/pay', auth('pos'), (req, res) => {
  const { amount, method } = req.body || {};
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });
  const amt = Number(amount);
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });
  const paidSoFar = db.prepare(`SELECT COALESCE(SUM(amount),0) as total FROM payments WHERE doc_type='sale' AND doc_id=?`).get(sale.id).total;
  const remaining = +(sale.total - paidSoFar).toFixed(2);
  if (amt > remaining) return res.status(400).json({ error: 'Amount exceeds remaining balance (' + remaining + ')' });

  const tx = db.transaction(() => {
    db.prepare('INSERT INTO payments (doc_type, doc_id, amount, method, user_id) VALUES (?, ?, ?, ?, ?)')
      .run('sale', sale.id, amt, method || 'cash', req.user.id);
    const newPaid = +(paidSoFar + amt).toFixed(2);
    const status = newPaid >= sale.total ? 'paid' : 'partial';
    db.prepare('UPDATE sales SET paid = ?, status = ? WHERE id = ?').run(newPaid, status, sale.id);
  });
  tx();
  res.json({ success: true });
});

router.delete('/:id', auth('sales_read'), (req, res) => {
  const tx = db.transaction(() => {
    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(req.params.id);
    db.prepare('DELETE FROM sales WHERE id = ?').run(req.params.id);
    db.prepare("DELETE FROM payments WHERE doc_type = 'sale' AND doc_id = ?").run(req.params.id);
    for (const item of items) {
      const mv = db.prepare(`SELECT * FROM stock_movements WHERE ref_type='sale' AND ref_id=? AND product_id=?`)
        .get(req.params.id, item.product_id);
      const wid = mv ? mv.warehouse_id : null;
      if (wid) {
        db.prepare('UPDATE stock SET quantity = quantity + ? WHERE product_id = ? AND warehouse_id = ?')
          .run(item.quantity, item.product_id, wid);
        db.prepare(`DELETE FROM stock_movements WHERE ref_type='sale' AND ref_id=? AND product_id=?`)
          .run(req.params.id, item.product_id);
      }
    }
  });
  tx();
  res.json({ success: true });
});

export default router;
