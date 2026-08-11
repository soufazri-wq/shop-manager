import express from 'express';
import { checkLicense, activate } from '../license.js';

const router = express.Router();

router.get('/', (req, res) => {
  res.json(checkLicense());
});

router.post('/activate', (req, res) => {
  const { key } = req.body || {};
  if (!key) return res.status(400).json({ error: 'Key required' });
  const r = activate(key);
  if (!r.ok) return res.status(400).json({ error: r.reason });
  res.json(r);
});

export default router;
