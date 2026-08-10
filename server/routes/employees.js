import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { auth, ROLES } from '../middleware/auth.js';

const router = express.Router();

router.get('/', auth('employees_read'), (req, res) => {
  const users = db.prepare(`
    SELECT id, name, email, phone, role, active, created_at
    FROM users WHERE active = 1 ORDER BY name COLLATE NOCASE
  `).all();
  res.json(users);
});

router.post('/', auth('employees_read'), (req, res) => {
  const { name, email, phone, password, role } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
  const hash = bcrypt.hashSync(password, 10);
  try {
    const info = db.prepare('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)')
      .run(name, String(email).toLowerCase(), phone || null, hash, role);
    res.json(db.prepare('SELECT id, name, email, phone, role, active FROM users WHERE id = ?').get(info.lastInsertRowid));
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(400).json({ error: 'Email already exists' });
    throw e;
  }
});

router.put('/:id', auth('employees_read'), (req, res) => {
  const { name, email, phone, password, role, active } = req.body || {};
  const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'User not found' });
  try {
    if (password) {
      const hash = bcrypt.hashSync(password, 10);
      db.prepare('UPDATE users SET name=?, email=?, phone=?, role=?, active=?, password_hash=? WHERE id=?')
        .run(name ?? existing.name, (email || existing.email).toLowerCase(), phone ?? existing.phone,
          role ?? existing.role, active === undefined ? existing.active : (active ? 1 : 0), hash, existing.id);
    } else {
      db.prepare('UPDATE users SET name=?, email=?, phone=?, role=?, active=? WHERE id=?')
        .run(name ?? existing.name, (email || existing.email).toLowerCase(), phone ?? existing.phone,
          role ?? existing.role, active === undefined ? existing.active : (active ? 1 : 0), existing.id);
    }
    res.json({ success: true });
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return res.status(400).json({ error: 'Email already exists' });
    throw e;
  }
});

router.delete('/:id', auth('employees_read'), (req, res) => {
  if (String(req.params.id) === String(req.user.id)) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }
  db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/roles', auth(), (req, res) => {
  res.json(ROLES);
});

export default router;
