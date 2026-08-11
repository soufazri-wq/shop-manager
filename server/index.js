import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import inventoryRoutes from './routes/inventory.js';
import supplierRoutes from './routes/suppliers.js';
import customerRoutes from './routes/customers.js';
import saleRoutes from './routes/sales.js';
import purchaseRoutes from './routes/purchases.js';
import employeeRoutes from './routes/employees.js';
import reportRoutes from './routes/reports.js';
import licenseRoutes from './routes/license.js';
import db from './db.js';
import { checkLicense } from './license.js';

const app = express();
const PORT = process.env.PORT || 4000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));
app.get('/api/network', (req, res) => {
  const nets = os.networkInterfaces();
  let ip = null;
  for (const name of Object.keys(nets)) {
    for (const ni of nets[name]) {
      if (ni.family === 'IPv4' && !ni.internal) {
        if (ni.address.startsWith('192.168.')) { ip = ni.address; break; }
        if (!ip) ip = ni.address;
      }
    }
    if (ip && ip.startsWith('192.168.')) break;
  }
  const host = ip || 'localhost';
  const url = `http://${host}:${PORT}`;
  res.json({ ip, host, port: PORT, url, localUrl: `http://localhost:${PORT}` });
});
app.get('/api/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const r of rows) settings[r.key] = r.value;
  res.json(settings);
});

app.put('/api/settings', (req, res) => {
  const allowed = ['currency', 'appName'];
  const entries = Object.entries(req.body || {}).filter(([k]) => allowed.includes(k));
  if (!entries.length) return res.status(400).json({ error: 'No valid settings provided' });
  const stmt = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );
  const saveAll = db.transaction((list) => {
    for (const [k, v] of list) stmt.run(k, String(v ?? '').trim());
  });
  try {
    saveAll(entries);
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    res.json(settings);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.use('/api/license', licenseRoutes);

const PUBLIC_API = ['/api/health', '/api/network', '/api/auth/login', '/api/settings'];
app.use('/api', (req, res, next) => {
  const fullPath = req.originalUrl.split('?')[0];
  if (fullPath.startsWith('/api/license')) return next();
  if (req.method === 'GET' && PUBLIC_API.includes(fullPath)) return next();
  const lic = checkLicense();
  if (!lic.valid) return res.status(402).json({ error: 'license_required', license: lic });
  next();
});

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/reports', reportRoutes);

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html')) {
        res.setHeader('Cache-Control', 'no-cache, stale-if-error=600');
        res.setHeader('Pragma', 'no-cache');
      } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else {
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-if-error=600');
      }
    },
  }));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, stale-if-error=600');
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log('Shop Manager running on http://localhost:' + PORT);
});
