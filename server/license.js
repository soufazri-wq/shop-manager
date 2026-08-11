import crypto from 'crypto';
import db from './db.js';

const TRIAL_DAYS = Math.max(0, parseInt(process.env.TRIAL_DAYS || '14', 10));

export const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEACKFabnj16kI5I0m9Z7qY0hc6PBRBT9ZiQBzUJ3LKxhQ=
-----END PUBLIC KEY-----`;

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

// ---------- الإيقاف (Revocation) ----------
// 1) LICENSE_REVOKED=1  : إيقاف فوري (للمستضافين عندك: Render…)
// 2) LICENSE_REVOKE_URL : قائمة إيقاف موقّعة تُجلب من الخادم (للمستضافين بأنفسهم)
const REVOKED_ENV = process.env.LICENSE_REVOKED === '1';
const REVOKE_URL = process.env.LICENSE_REVOKE_URL || '';
const REVOKE_REFRESH_MS = Math.max(30000, parseInt(process.env.LICENSE_REVOKE_REFRESH_MS || '300000', 10));
const REVOKED = new Set();

function verifyRevokeList(list, sigHex) {
  if (!Array.isArray(list)) return false;
  const sorted = list.map((x) => String(x).trim()).filter(Boolean).sort();
  const payload = Buffer.from(`REVOKE|${sorted.length}|${sorted.join(',')}`, 'utf8');
  const sig = Buffer.from(String(sigHex || ''), 'hex');
  if (!sig.length) return false;
  try {
    return crypto.verify(null, payload, { key: PUBLIC_KEY, format: 'pem', type: 'spki' }, sig);
  } catch {
    return false;
  }
}

async function refreshRevokeList() {
  if (!REVOKE_URL) return;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch(REVOKE_URL, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return;
    const j = await r.json();
    if (verifyRevokeList(j.list, j.sig)) {
      REVOKED.clear();
      for (const id of j.list) REVOKED.add(String(id).trim());
      console.log(`[license] قائمة الإيقاف محدّثة: ${REVOKED.size} معرّف`);
    }
  } catch {
    /* offline-first: نبقي آخر قائمة صحيحة */
  }
}

if (REVOKE_URL) {
  refreshRevokeList();
  setInterval(refreshRevokeList, REVOKE_REFRESH_MS);
}

function isRevoked(installId) {
  return REVOKED_ENV || REVOKED.has(installId);
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

function verifyLicenseKey(key, installId) {
  let decoded;
  try {
    decoded = base32decode(key);
  } catch {
    return { ok: false, reason: 'format' };
  }
  if (decoded.length <= 64) return { ok: false, reason: 'format' };
  const payload = decoded.subarray(0, decoded.length - 64);
  const sig = decoded.subarray(decoded.length - 64);
  const text = payload.toString('utf8');
  const parts = text.split('|');
  if (parts.length !== 2) return { ok: false, reason: 'format' };
  const [id, exp] = parts;
  if (id !== installId) return { ok: false, reason: 'install' };
  try {
    const ok = crypto.verify(null, payload, { key: PUBLIC_KEY, format: 'pem', type: 'spki' }, sig);
    if (!ok) return { ok: false, reason: 'signature' };
  } catch {
    return { ok: false, reason: 'signature' };
  }
  if (exp < todayStr()) return { ok: false, reason: 'expired' };
  return { ok: true, expiry: exp };
}

export function checkLicense() {
  const { id, at } = ensureInstall();
  if (isRevoked(id)) {
    return { valid: false, activated: false, trial: false, installId: id, message: 'revoked', revoked: true };
  }
  const stored = getSetting('activation_key');
  if (stored) {
    const v = verifyLicenseKey(stored, id);
    if (v.ok) {
      return { valid: true, activated: true, trial: false, installId: id, expiry: v.expiry, message: 'activated' };
    }
  }
  const trialEnds = TRIAL_DAYS > 0 ? addDaysStr(at, TRIAL_DAYS) : at;
  const valid = TRIAL_DAYS > 0 && todayStr() <= trialEnds;
  const daysLeft = Math.max(0, Math.floor((new Date(trialEnds + 'T00:00:00Z') - new Date()) / 86400000) + 1);
  return {
    valid, activated: false, trial: true,
    installId: id, installedAt: at, trialEnds, daysLeft,
    message: valid ? 'trial' : 'expired',
  };
}

export function activate(key) {
  const { id } = ensureInstall();
  if (isRevoked(id)) return { ok: false, reason: 'revoked' };
  const v = verifyLicenseKey(key, id);
  if (!v.ok) return { ok: false, reason: v.reason };
  setSetting('activation_key', String(key).trim());
  return { ok: true, expiry: v.expiry };
}
