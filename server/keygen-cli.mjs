import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALPH = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

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

const todayStr = () => new Date().toISOString().slice(0, 10);
function addDaysStr(base, days) {
  const d = new Date(base + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function loadPrivateKey() {
  const fromEnv = process.env.LICENSE_PRIVATE_KEY;
  if (fromEnv && fromEnv.includes('PRIVATE KEY')) return fromEnv;
  const file = process.env.LICENSE_KEY_FILE || path.join(__dirname, '..', 'seller_private.pem');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8');
  return null;
}

const usage = () => {
  console.log('توليد مفتاح تفعيل — استخدم على جهازك أنت فقط (لا يصل للعملاء)');
  console.log('');
  console.log('  الاستخدام:');
  console.log('    node keygen-cli.mjs <installId> <days>');
  console.log('');
  console.log('  المفتاح الخاص يُقرأ من (أي واحد):');
  console.log('    - متغير البيئة  LICENSE_PRIVATE_KEY');
  console.log('    - ملف          seller_private.pem  (بجانب مجلد server)');
  console.log('');
  console.log('  أمثلة:');
  console.log('    node keygen-cli.mjs SHOP-85C6571D13 365');
  console.log('    node keygen-cli.mjs SHOP-85C6571D13 30');
  process.exit(1);
};

const [installId, daysStr] = process.argv.slice(2);
if (!installId || !daysStr) usage();
if (!/^SHOP-[0-9A-F]{10}$/i.test(installId)) {
  console.log('خطأ: رقم التثبيت غير صالح — يجب أن يكون بصيغة SHOP-XXXXXXXXXX');
  process.exit(1);
}
const days = parseInt(daysStr, 10);
if (!Number.isFinite(days) || days < 1 || days > 3650) {
  console.log('خطأ: عدد الأيام يجب أن يكون بين 1 و 3650');
  process.exit(1);
}

const privateKey = loadPrivateKey();
if (!privateKey) {
  console.log('خطأ: لم أجد المفتاح الخاص. ضعه في LICENSE_PRIVATE_KEY أو ملف seller_private.pem');
  process.exit(1);
}

const expiry = addDaysStr(todayStr(), days);
const payload = Buffer.from(`${installId}|${expiry}`, 'utf8');
const sig = crypto.sign(null, payload, privateKey);
const key = base32encode(Buffer.concat([payload, sig]));

console.log('');
console.log('Install ID :', installId);
console.log('Valid until:', expiry);
console.log('KEY        :', key);
console.log('');
console.log('أرسل هذا المفتاح للعميل ليضعه في شاشة التفعيل.');
