import db from './db.js';
import bcrypt from 'bcryptjs';

function seed() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (existing > 0) {
    console.log('Database already has data. Skip seeding.');
    return;
  }

  const tx = db.transaction(() => {
    const setSetting = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    setSetting.run('shop_name', 'متجري');
    setSetting.run('currency', 'ر.س');
    setSetting.run('tax_rate', '0');
    setSetting.run('receipt_footer', 'شكراً لزيارتكم');

    const adminHash = bcrypt.hashSync('admin123', 10);
    const managerHash = bcrypt.hashSync('manager123', 10);
    const cashierHash = bcrypt.hashSync('cashier123', 10);
    const whHash = bcrypt.hashSync('warehouse123', 10);

    db.prepare('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?,?,?,?,?)')
      .run('مدير النظام', 'admin@shop.com', '0500000000', adminHash, 'admin');
    db.prepare('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?,?,?,?,?)')
      .run('المدير العام', 'manager@shop.com', '0500000001', managerHash, 'manager');
    db.prepare('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?,?,?,?,?)')
      .run('موظف الكاشير', 'cashier@shop.com', '0500000002', cashierHash, 'cashier');
    db.prepare('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?,?,?,?,?)')
      .run('أمين المستودع', 'warehouse@shop.com', '0500000003', whHash, 'warehouse');

    const cats = ['مشروبات', 'مواد غذائية', 'منظفات', 'منتجات الألبان', 'حلويات'];
    for (const c of cats) db.prepare('INSERT INTO categories (name) VALUES (?)').run(c);

    const wh = db.prepare('INSERT INTO warehouses (name, location) VALUES (?, ?)').run('المستودع الرئيسي', 'المدينة');
    const warehouseId = wh.lastInsertRowid;

    const products = [
      ['مياه معدنية 1.5 لتر', 'WATER-001', '6281000021', 1, 'عبوة', 1.2, 2.5, 50],
      ['حليب طازج 1 لتر', 'MILK-001', '6281000022', 4, 'عبوة', 4.5, 7, 30],
      ['أرز بسمتي 5 كيلو', 'RICE-001', '6281000023', 2, 'كيس', 25, 35, 20],
      ['زيت عباد الشمس 1 لتر', 'OIL-001', '6281000024', 2, 'قنينة', 9, 14, 25],
      ['سكر أبيض 1 كيلو', 'SUGAR-001', '6281000025', 2, 'كيس', 4.5, 7, 40],
      ['شاي أخضر 200 غرام', 'TEA-001', '6281000026', 2, 'علبة', 6, 10, 30],
      ['قهوة عربية 250 غرام', 'COF-001', '6281000027', 2, 'علبة', 14, 22, 20],
      ['عصير برتقال 1 لتر', 'JUICE-001', '6281000028', 1, 'عبوة', 5, 9, 25],
      ['صابون سائل للجسم', 'SOAP-001', '6281000029', 3, 'قنينة', 7, 12, 15],
      ['معجون أسنان', 'PASTE-001', '6281000030', 3, 'أنبوب', 4, 8, 20],
      ['شامبو 400 مل', 'SHAMPOO-001', '6281000031', 3, 'قنينة', 11, 18, 15],
      ['مبيض ملابس 2 لتر', 'BLEACH-001', '6281000032', 3, 'قنينة', 5, 9, 25],
      ['بسكويت بالشوكولاتة', 'BISCUIT-001', '6281000033', 5, 'علبة', 3, 6, 35],
      ['حلويات مشكلة', 'SWEETS-001', '6281000034', 5, 'علبة', 8, 14, 20],
      ['دقيق قمح 1 كيلو', 'FLOUR-001', '6281000035', 2, 'كيس', 2.5, 4.5, 40],
    ];

    const productIds = [];
    for (const [name, sku, barcode, catIdx, unit, cost, sale, minStock] of products) {
      const info = db.prepare(`
        INSERT INTO products (name, sku, barcode, category_id, unit, cost_price, sale_price, min_stock)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name, sku, barcode, catIdx, unit, cost, sale, minStock);
      productIds.push(info.lastInsertRowid);
    }

    for (const pid of productIds) {
      const qty = Math.floor(Math.random() * 80) + 30;
      db.prepare('INSERT INTO stock (product_id, warehouse_id, quantity) VALUES (?, ?, ?)').run(pid, warehouseId, qty);
    }

    const suppliers = [
      ['شركة التوزيع الوطنية', '0501111111', 'info@dist.com', 'الرياض', '3101234567', 'توزيع عام'],
      ['مصنع الألبان الحديث', '0502222222', 'sales@dairy.com', 'جدة', '3107654321', 'منتجات ألبان'],
      ['شركة الغذاء المتميز', '0503333333', 'orders@food.com', 'الدمام', '3109876543', 'مواد غذائية'],
      ['مؤسسة النظافة المتكاملة', '0504444444', 'support@clean.com', 'الرياض', '3102468101', 'منظفات'],
    ];
    for (const [name, phone, email, address, tax, notes] of suppliers) {
      db.prepare('INSERT INTO suppliers (name, phone, email, address, tax_no, notes) VALUES (?,?,?,?,?,?)')
        .run(name, phone, email, address, tax, notes);
    }

    const customers = [
      ['أحمد محمد', '0551111111', '', 'الرياض', 'عميل دائماً'],
      ['فاطمة العلي', '0552222222', '', 'جدة', ''],
      ['محمد السالم', '0553333333', '', 'الخبر', ''],
      ['شركة النور التجارية', '0554444444', 'info@noor.com', 'الرياض', 'عميل شركة'],
    ];
    for (const [name, phone, email, address, notes] of customers) {
      db.prepare('INSERT INTO customers (name, phone, email, address, notes) VALUES (?,?,?,?,?)')
        .run(name, phone, email || null, address, notes || null);
    }

    const adminId = 1;
    const now = new Date();

    function addSale(daysAgo, items, discount = 0, paidRatio = 1, customerId = null) {
      const date = new Date(now.getTime() - daysAgo * 86400000);
      const dateStr = date.toISOString().replace('T', ' ').slice(0, 19);
      let subtotal = 0;
      for (const it of items) subtotal += it[2] * it[1];
      const total = +(subtotal - discount).toFixed(2);
      const paid = +(total * paidRatio).toFixed(2);
      const status = paid >= total ? 'paid' : paid > 0 ? 'partial' : 'unpaid';
      const seq = db.prepare('SELECT COUNT(*) as c FROM sales').get().c + 1;
      const invoice_no = 'INV-' + String(seq).padStart(5, '0');
      const info = db.prepare(`
        INSERT INTO sales (invoice_no, customer_id, date, subtotal, discount, tax, total, paid, status, payment_method, user_id)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, 'cash', ?)
      `).run(invoice_no, customerId, dateStr, +subtotal.toFixed(2), discount, total, paid, status, adminId);
      const saleId = info.lastInsertRowid;
      for (const [pid, qty, price] of items) {
        const cost = db.prepare('SELECT cost_price FROM products WHERE id = ?').get(pid).cost_price;
        db.prepare('INSERT INTO sale_items (sale_id, product_id, quantity, price, cost, total) VALUES (?,?,?,?,?,?)')
          .run(saleId, pid, qty, price, cost, +(qty * price).toFixed(2));
        db.prepare('UPDATE stock SET quantity = quantity - ? WHERE product_id = ? AND warehouse_id = ?')
          .run(qty, pid, warehouseId);
        db.prepare("INSERT INTO stock_movements (product_id, warehouse_id, type, quantity, ref_type, ref_id, note, user_id, created_at) VALUES (?,?,?,?,?,?,?,?,?)")
          .run(pid, warehouseId, 'out', qty, 'sale', saleId, invoice_no, adminId, dateStr);
      }
      if (paid > 0) {
        db.prepare('INSERT INTO payments (doc_type, doc_id, amount, method, user_id, date) VALUES (?,?,?,?,?,?)')
          .run('sale', saleId, paid, 'cash', adminId, dateStr);
      }
    }

    function addPurchase(daysAgo, items, discount = 0) {
      const date = new Date(now.getTime() - daysAgo * 86400000);
      const dateStr = date.toISOString().replace('T', ' ').slice(0, 19);
      let subtotal = 0;
      for (const it of items) subtotal += it[2] * it[1];
      const total = +(subtotal - discount).toFixed(2);
      const seq = db.prepare('SELECT COUNT(*) as c FROM purchases').get().c + 1;
      const purchase_no = 'PUR-' + String(seq).padStart(5, '0');
      const supplierId = (daysAgo % suppliers.length) + 1;
      const info = db.prepare(`
        INSERT INTO purchases (purchase_no, supplier_id, date, subtotal, discount, tax, total, paid, status, payment_method, user_id)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?, 'paid', 'cash', ?)
      `).run(purchase_no, supplierId, dateStr, +subtotal.toFixed(2), discount, total, total, adminId);
      const purchaseId = info.lastInsertRowid;
      for (const [pid, qty, price] of items) {
        db.prepare('INSERT INTO purchase_items (purchase_id, product_id, quantity, price, total) VALUES (?,?,?,?,?)')
          .run(purchaseId, pid, qty, price, +(qty * price).toFixed(2));
        db.prepare('UPDATE stock SET quantity = quantity + ? WHERE product_id = ? AND warehouse_id = ?')
          .run(qty, pid, warehouseId);
        db.prepare("INSERT INTO stock_movements (product_id, warehouse_id, type, quantity, ref_type, ref_id, note, user_id, created_at) VALUES (?,?,?,?,?,?,?,?,?)")
          .run(pid, warehouseId, 'in', qty, 'purchase', purchaseId, purchase_no, adminId, dateStr);
      }
      db.prepare('INSERT INTO payments (doc_type, doc_id, amount, method, user_id, date) VALUES (?,?,?,?,?,?)')
        .run('purchase', purchaseId, total, 'cash', adminId, dateStr);
    }

    const P = (i) => productIds[i - 1];
    addSale(28, [[P(1), 10, 2.5], [P(2), 5, 7], [P(6), 3, 10]], 0, 1, 1);
    addSale(25, [[P(3), 4, 35], [P(4), 6, 14]], 5, 1, 2);
    addSale(21, [[P(5), 8, 7], [P(7), 4, 22], [P(13), 6, 6]], 0, 1, 3);
    addSale(18, [[P(1), 12, 2.5], [P(8), 7, 9]], 0, 0.5, 4);
    addSale(15, [[P(2), 4, 7], [P(9), 5, 12], [P(10), 10, 8]], 3, 1, 1);
    addSale(12, [[P(3), 3, 35], [P(4), 8, 14], [P(11), 4, 18]], 0, 1, 2);
    addSale(9, [[P(14), 6, 14], [P(15), 10, 4.5]], 0, 1, 3);
    addSale(7, [[P(1), 20, 2.5], [P(5), 10, 7], [P(6), 8, 10]], 0, 0.75, 4);
    addSale(5, [[P(7), 5, 22], [P(12), 8, 9], [P(13), 4, 6]], 2, 1, 1);
    addSale(4, [[P(2), 6, 7], [P(8), 10, 9]], 0, 0.5, 2);
    addSale(3, [[P(1), 15, 2.5], [P(3), 5, 35], [P(9), 3, 12]], 0, 1, 3);
    addSale(2, [[P(4), 10, 14], [P(11), 6, 18], [P(5), 12, 7]], 5, 1, 1);
    addSale(1, [[P(6), 10, 10], [P(7), 8, 22], [P(14), 12, 14]], 0, 0.6, 4);
    addSale(0, [[P(1), 25, 2.5], [P(2), 8, 7], [P(13), 10, 6], [P(15), 15, 4.5]], 0, 1, 1);
    addSale(0, [[P(3), 2, 35], [P(8), 5, 9], [P(12), 4, 9]], 0, 1, 3);

    addPurchase(26, [[P(1), 100, 1.1], [P(2), 50, 4.2], [P(5), 100, 4.2]]);
    addPurchase(19, [[P(3), 40, 23], [P(4), 60, 8.5]]);
    addPurchase(13, [[P(6), 60, 5.5], [P(7), 40, 13]]);
    addPurchase(6, [[P(1), 150, 1.1], [P(8), 60, 4.5], [P(9), 50, 6.5]]);
    addPurchase(2, [[P(3), 30, 23], [P(4), 40, 8.5], [P(10), 60, 3.5]]);

    console.log('Seed data created successfully.');
  });

  tx();
  console.log('==============================================');
  console.log('Users:');
  console.log('  admin     -> admin@shop.com / admin123');
  console.log('  manager   -> manager@shop.com / manager123');
  console.log('  cashier   -> cashier@shop.com / cashier123');
  console.log('  warehouse -> warehouse@shop.com / warehouse123');
  console.log('==============================================');
}

seed();
