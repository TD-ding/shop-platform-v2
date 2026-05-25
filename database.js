const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'shop.db');

let db = null;

function getDb() {
  if (!db) {
    db = new sqlite3.Database(DB_PATH);
    db.serialize(() => {
      db.run('PRAGMA journal_mode = WAL');
      db.run('PRAGMA foreign_keys = ON');
    });
  }
  return db;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// 用户表
const CREATE_USERS = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('admin','super','user')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`;

// 商品表
const CREATE_PRODUCTS = `
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL NOT NULL CHECK(price > 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock >= 0),
  image TEXT DEFAULT '',
  category TEXT DEFAULT '',
  is_special INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`;

// 购物车表
const CREATE_CART = `
CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE(user_id, product_id)
)`;

// 订单表
const CREATE_ORDERS = `
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  total_price REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','shipped','cancelled')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
)`;

// 订单详情表
const CREATE_ORDER_ITEMS = `
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  price REAL NOT NULL,
  quantity INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
)`;

async function initDatabase() {
  await run(CREATE_USERS);
  await run(CREATE_PRODUCTS);
  await run(CREATE_CART);
  await run(CREATE_ORDERS);
  await run(CREATE_ORDER_ITEMS);

  // 插入默认用户
  const bcrypt = require('bcryptjs');
  const userCount = await get('SELECT COUNT(*) as count FROM users');
  if (userCount.count === 0) {
    const adminHash = await bcrypt.hash('admin123', 10);
    const superHash = await bcrypt.hash('super123', 10);
    const userHash = await bcrypt.hash('user123', 10);
    await run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', adminHash, 'admin']);
    await run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['superuser', superHash, 'super']);
    await run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['user1', userHash, 'user']);
  }

  // 插入示例商品
  const prodCount = await get('SELECT COUNT(*) as count FROM products');
  if (prodCount.count === 0) {
    const products = [
      ['iPhone 15 Pro', '最新款苹果手机，A17 Pro芯片', 8999, 50, '手机', 0],
      ['MacBook Air M3', '轻薄笔记本，M3芯片', 9999, 30, '电脑', 0],
      ['AirPods Pro 2', '主动降噪耳机', 1899, 100, '配件', 0],
      ['iPad Air', '10.9英寸平板电脑', 4799, 40, '平板', 0],
      ['Apple Watch Ultra 2', '高端运动手表', 5999, 20, '配件', 1],
      ['Mac Pro', '专业工作站，M2 Ultra', 29999, 5, '电脑', 1],
      ['Vision Pro', '空间计算设备', 27999, 10, 'XR', 1],
      ['小米14 Ultra', '徕卡影像旗舰', 5999, 60, '手机', 0],
      ['华为 MatePad Pro', '13.2英寸OLED屏', 4299, 35, '平板', 0],
      ['Sony WH-1000XM5', '降噪耳机旗舰', 2499, 80, '配件', 0],
    ];
    for (const p of products) {
      await run(
        'INSERT INTO products (name, description, price, stock, category, is_special) VALUES (?, ?, ?, ?, ?, ?)',
        p
      );
    }
  }
}

module.exports = { getDb, run, all, get, initDatabase };
