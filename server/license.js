import crypto from 'crypto';
import db from './db.js';

export const LICENSE_ENABLED = String(process.env.LICENSE_ENABLED ?? '1') !== '0';
export const MASTER_KEY = process.env.LICENSE_MASTER_KEY || 'shop-master-2026';
export const TRIAL_DAYS = Math.max(1, parseInt(process.env.TRIAL_DAYS || '14', 10));

const ALPH = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CHARS = {};
for (let i = 0; i < ALPH.length; i++) CHARS[ALPH[i]] = i;

function base32encode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPH[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPH[(value << (5 - bits)) & 31];
  return out;
}

function base32decode(str) {
  const clean = String(str).toUpperCase().replace(/[^0-9A-Z]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const c of clean) {
    const v = CHARS[c];
    if (v === undefined) continue;
    value = (value << 5) | v;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function getSetting(k) {
  const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(k);
  return r ? r.value : null;
}
function setSetting(k, v) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, v);
}

const todayStr = () => new Date().toISOString().slice(0, 10);
function addDaysStr(base, days) {
  const d = new Date(base + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function ensureInstall() {
  let id = getSetting('install_id');
  if (!id) {
    id = 'SHOP-' + crypto.randomBytes(5).toString('hex').toUpperCase();
    setSetting('install_id', id);
  }
  let at = getSetting('installed_at');
  if (!at) {
    at = todayStr();
    setSetting('installed_at', at);
  }
  return { id, at };
}

export function buildKey(installId, days) {
  const expiry = addDaysStr(todayStr(), days);
  const payload = `${installId}|${expiry}`;
  const sig = crypto.createHmac('sha256', MASTER_KEY).update(payload).digest('hex').slice(0, 12);
  return base32encode(Buffer.from(`${payload}|${sig}`, 'utf8'));
}

export function validateKey(key, installId) {
  let decoded;
  try {
    decoded = base32decode(key).toString('utf8');
  } catch {
    return { ok: false, reason: 'format' };
  }
  const parts = decoded.split('|');
  if (parts.length !== 3) return { ok: false, reason: 'format' };
  const [id, exp, sig] = parts;
  if (id !== installId) return { ok: false, reason: 'install' };
  const expect = crypto.createHmac('sha256', MASTER_KEY).update(`${id}|${exp}`).digest('hex').slice(0, 12);
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, reason: 'signature' };
  if (exp < todayStr()) return { ok: false, reason: 'expired' };
  return { ok: true, expiry: exp };
}

export function checkLicense() {
  if (!LICENSE_ENABLED) {
    return { enabled: false, valid: true, activated: false, trial: false };
  }
  const { id, at } = ensureInstall();
  const stored = getSetting('activation_key');
  if (stored) {
    const v = validateKey(stored, id);
    if (v.ok) {
      return { enabled: true, valid: true, activated: true, trial: false, installId: id, expiry: v.expiry, message: 'activated' };
    }
  }
  const trialEnds = addDaysStr(at, TRIAL_DAYS);
  const valid = todayStr() <= trialEnds;
  const daysLeft = Math.max(0, Math.floor((new Date(trialEnds + 'T00:00:00Z') - new Date()) / 86400000) + 1);
  return {
    enabled: true, valid, activated: false, trial: true,
    installId: id, installedAt: at, trialEnds, daysLeft,
    message: valid ? 'trial' : 'expired',
  };
}

export function activate(key) {
  if (!LICENSE_ENABLED) return { ok: true, reason: 'disabled' };
  const { id } = ensureInstall();
  const v = validateKey(key, id);
  if (!v.ok) return { ok: false, reason: v.reason };
  setSetting('activation_key', String(key).trim());
  return { ok: true, expiry: v.expiry };
}

export function generateKey(installId, days, master) {
  if (master !== MASTER_KEY) return { ok: false, reason: 'master' };
  if (!/^SHOP-[0-9A-F]{10}$/i.test(String(installId).trim())) return { ok: false, reason: 'install' };
  const n = parseInt(days, 10);
  if (!Number.isFinite(n) || n < 1 || n > 3650) return { ok: false, reason: 'days' };
  return { ok: true, key: buildKey(String(installId).trim(), n), expiry: addDaysStr(todayStr(), n) };
}
