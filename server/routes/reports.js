import express from 'express';
import db from '../db.js';
import { auth } from '../middleware/auth.js';

const router = express.Router();

router.get('/dashboard', auth('dashboard'), (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);

  const salesToday = db.prepare('SELECT COALESCE(SUM(total),0) as total FROM sales WHERE date(date) = ?').get(today).total;
  const salesCountToday = db.prepare('SELECT COUNT(*) as c FROM sales WHERE date(date) = ?').get(today).c;
  const salesMonth = db.prepare(`SELECT COALESCE(SUM(total),0) as total FROM sales WHERE strftime('%Y-%m', date) = ?`).get(month).total;
  const purchasesMonth = db.prepare(`SELECT COALESCE(SUM(total),0) as total FROM purchases WHERE strftime('%Y-%m', date) = ?`).get(month).total;
  const profitMonth = db.prepare(`
    SELECT COALESCE(SUM(si.total - si.cost * si.quantity),0) as profit
    FROM sale_items si JOIN sales s ON s.id = si.sale_id
    WHERE strftime('%Y-%m', s.date) = ?
  `).get(month).profit;

  const productCount = db.prepare('SELECT COUNT(*) as c FROM products WHERE active = 1').get().c;
  const customerCount = db.prepare('SELECT COUNT(*) as c FROM customers').get().c;
  const supplierCount = db.prepare('SELECT COUNT(*) as c FROM suppliers').get().c;

  const lowStock = db.prepare(`
    SELECT COUNT(*) as c FROM products p WHERE p.active = 1
    AND COALESCE((SELECT SUM(s.quantity) FROM stock s WHERE s.product_id = p.id), 0) <= p.min_stock
  `).get().c;

  const receivable = db.prepare(`SELECT COALESCE(SUM(total - paid),0) as total FROM sales WHERE paid < total`).get().total;
  const payable = db.prepare(`SELECT COALESCE(SUM(total - paid),0) as total FROM purchases WHERE paid < total`).get().total;

  res.json({
    salesToday, salesCountToday, salesMonth, purchasesMonth, profitMonth,
    productCount, customerCount, supplierCount, lowStock, receivable, payable
  });
});

router.get('/sales-overview', auth('reports'), (req, res) => {
  const days = Number(req.query.days) || 30;
  const rows = db.prepare(`
    SELECT date(date) as day, COALESCE(SUM(total),0) as total, COUNT(*) as count
    FROM sales WHERE date(date) >= date('now', ?)
    GROUP BY day ORDER BY day
  `).all('-' + (days - 1) + ' days');
  res.json(rows);
});

router.get('/top-products', auth('reports'), (req, res) => {
  const limit = Number(req.query.limit) || 10;
  const rows = db.prepare(`
    SELECT p.name, SUM(si.quantity) as qty, SUM(si.total) as revenue
    FROM sale_items si JOIN products p ON p.id = si.product_id
    GROUP BY si.product_id ORDER BY revenue DESC LIMIT ?
  `).all(limit);
  res.json(rows);
});

router.get('/profit', auth('reports'), (req, res) => {
  const months = Number(req.query.months) || 6;
  const rows = db.prepare(`
    SELECT strftime('%Y-%m', s.date) as month,
      COALESCE(SUM(s.total),0) as sales,
      COALESCE(SUM(si.total - si.cost * si.quantity),0) as profit
    FROM sales s JOIN sale_items si ON si.sale_id = s.id
    WHERE date(s.date) >= date('now', 'start of month', ?)
    GROUP BY month ORDER BY month
  `).all('-' + (months - 1) + ' months');
  res.json(rows);
});

export default router;
