const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const { run, all, get, initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'shop-platform-secret-key';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- JWT 中间件 ---
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '请先登录' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

function roleMiddleware(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足' });
    }
    next();
  };
}

// --- 用户认证 API ---
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  if (username.length < 2 || username.length > 20) {
    return res.status(400).json({ error: '用户名长度需要2-20个字符' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少6个字符' });
  }
  try {
    const existing = await get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) return res.status(400).json({ error: '用户名已存在' });
    const hash = await bcrypt.hash(password, 10);
    const result = await run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, hash, 'user']);
    const token = jwt.sign({ id: result.lastID, username, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: result.lastID, username, role: 'user' } });
  } catch (err) {
    res.status(500).json({ error: '注册失败：' + err.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: '用户名和密码不能为空' });
  }
  try {
    const user = await get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) return res.status(400).json({ error: '用户名或密码错误' });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ error: '用户名或密码错误' });
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
  } catch (err) {
    res.status(500).json({ error: '登录失败：' + err.message });
  }
});

app.get('/api/me', authMiddleware, async (req, res) => {
  const user = await get('SELECT id, username, role, created_at FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json(user);
});

// --- 商品 API ---
app.get('/api/products', authMiddleware, async (req, res) => {
  try {
    let products;
    // 超级用户和管理员可以看到特殊商品
    if (req.user.role === 'super' || req.user.role === 'admin') {
      products = await all('SELECT * FROM products ORDER BY created_at DESC');
    } else {
      // 普通用户只看到非特殊商品
      products = await all('SELECT * FROM products WHERE is_special = 0 ORDER BY created_at DESC');
    }
    // 超级用户看到自动8.5折
    if (req.user.role === 'super') {
      products = products.map(p => ({ ...p, originalPrice: p.price, price: Math.round(p.price * 0.85 * 100) / 100 }));
    }
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: '获取商品列表失败' });
  }
});

app.get('/api/products/:id', authMiddleware, async (req, res) => {
  try {
    const product = await get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) return res.status(404).json({ error: '商品不存在' });
    if (product.is_special && req.user.role === 'user') {
      return res.status(403).json({ error: '该商品仅限超级用户购买' });
    }
    if (req.user.role === 'super') {
      product.originalPrice = product.price;
      product.price = Math.round(product.price * 0.85 * 100) / 100;
    }
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: '获取商品详情失败' });
  }
});

// 管理员：商品管理
app.post('/api/products', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  const { name, description, price, stock, category, is_special } = req.body;
  if (!name || !price) return res.status(400).json({ error: '商品名称和价格不能为空' });
  try {
    const result = await run(
      'INSERT INTO products (name, description, price, stock, category, is_special) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description || '', price, stock || 0, category || '', is_special ? 1 : 0]
    );
    res.json({ id: result.lastID, message: '商品创建成功' });
  } catch (err) {
    res.status(500).json({ error: '创建商品失败' });
  }
});

app.put('/api/products/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  const { name, description, price, stock, category, is_special } = req.body;
  try {
    const product = await get('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (!product) return res.status(404).json({ error: '商品不存在' });
    await run(
      'UPDATE products SET name=?, description=?, price=?, stock=?, category=?, is_special=? WHERE id=?',
      [name || product.name, description ?? product.description, price ?? product.price,
        stock ?? product.stock, category ?? product.category, is_special !== undefined ? (is_special ? 1 : 0) : product.is_special, req.params.id]
    );
    res.json({ message: '商品更新成功' });
  } catch (err) {
    res.status(500).json({ error: '更新商品失败' });
  }
});

app.delete('/api/products/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const result = await run('DELETE FROM products WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: '商品不存在' });
    res.json({ message: '商品删除成功' });
  } catch (err) {
    res.status(500).json({ error: '删除商品失败' });
  }
});

// --- 购物车 API ---
app.get('/api/cart', authMiddleware, async (req, res) => {
  try {
    const items = await all(
      `SELECT c.id, c.product_id, c.quantity, p.name, p.price, p.stock, p.image, p.is_special
       FROM cart_items c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?`,
      [req.user.id]
    );
    if (req.user.role === 'super') {
      items.forEach(item => {
        item.originalPrice = item.price;
        item.price = Math.round(item.price * 0.85 * 100) / 100;
      });
    }
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    res.json({ items, total: Math.round(total * 100) / 100 });
  } catch (err) {
    res.status(500).json({ error: '获取购物车失败' });
  }
});

app.post('/api/cart', authMiddleware, async (req, res) => {
  const { product_id, quantity } = req.body;
  if (!product_id) return res.status(400).json({ error: '请选择商品' });
  try {
    const product = await get('SELECT * FROM products WHERE id = ?', [product_id]);
    if (!product) return res.status(404).json({ error: '商品不存在' });
    if (product.is_special && req.user.role === 'user') {
      return res.status(403).json({ error: '该商品仅限超级用户购买' });
    }
    const qty = quantity || 1;
    if (qty > product.stock) return res.status(400).json({ error: '库存不足' });
    await run(
      'INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?) ON CONFLICT(user_id, product_id) DO UPDATE SET quantity = quantity + ?',
      [req.user.id, product_id, qty, qty]
    );
    res.json({ message: '已加入购物车' });
  } catch (err) {
    res.status(500).json({ error: '加入购物车失败' });
  }
});

app.put('/api/cart/:id', authMiddleware, async (req, res) => {
  const { quantity } = req.body;
  if (!quantity || quantity < 1) return res.status(400).json({ error: '数量至少为1' });
  try {
    const cartItem = await get('SELECT * FROM cart_items WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!cartItem) return res.status(404).json({ error: '购物车项不存在' });
    const product = await get('SELECT stock FROM products WHERE id = ?', [cartItem.product_id]);
    if (quantity > product.stock) return res.status(400).json({ error: '库存不足' });
    await run('UPDATE cart_items SET quantity = ? WHERE id = ?', [quantity, req.params.id]);
    res.json({ message: '数量已更新' });
  } catch (err) {
    res.status(500).json({ error: '更新购物车失败' });
  }
});

app.delete('/api/cart/:id', authMiddleware, async (req, res) => {
  try {
    const result = await run('DELETE FROM cart_items WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (result.changes === 0) return res.status(404).json({ error: '购物车项不存在' });
    res.json({ message: '已从购物车移除' });
  } catch (err) {
    res.status(500).json({ error: '移除失败' });
  }
});

// --- 订单 API ---
app.post('/api/orders', authMiddleware, async (req, res) => {
  try {
    const cartItems = await all(
      'SELECT c.product_id, c.quantity, p.name, p.price, p.stock, p.is_special FROM cart_items c JOIN products p ON c.product_id = p.id WHERE c.user_id = ?',
      [req.user.id]
    );
    if (cartItems.length === 0) return res.status(400).json({ error: '购物车为空' });
    // 校验库存
    for (const item of cartItems) {
      if (item.quantity > item.stock) {
        return res.status(400).json({ error: `${item.name} 库存不足，当前库存 ${item.stock}` });
      }
    }
    // 计算总价
    let total = 0;
    const orderItems = cartItems.map(item => {
      let price = item.price;
      if (req.user.role === 'super') price = Math.round(price * 0.85 * 100) / 100;
      total += price * item.quantity;
      return { ...item, finalPrice: price };
    });
    // 创建订单
    const orderResult = await run('INSERT INTO orders (user_id, total_price) VALUES (?, ?)', [req.user.id, Math.round(total * 100) / 100]);
    // 创建订单项并扣减库存
    for (const item of orderItems) {
      await run('INSERT INTO order_items (order_id, product_id, product_name, price, quantity) VALUES (?, ?, ?, ?, ?)',
        [orderResult.lastID, item.product_id, item.name, item.finalPrice, item.quantity]);
      await run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.product_id]);
    }
    // 清空购物车
    await run('DELETE FROM cart_items WHERE user_id = ?', [req.user.id]);
    res.json({ orderId: orderResult.lastID, message: '下单成功', totalPrice: Math.round(total * 100) / 100 });
  } catch (err) {
    res.status(500).json({ error: '下单失败：' + err.message });
  }
});

app.get('/api/orders', authMiddleware, async (req, res) => {
  try {
    let orders;
    if (req.user.role === 'admin') {
      orders = await all('SELECT o.*, u.username FROM orders o JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC');
    } else {
      orders = await all('SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
    }
    // 获取每个订单的商品列表
    for (const order of orders) {
      order.items = await all('SELECT * FROM order_items WHERE order_id = ?', [order.id]);
    }
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: '获取订单失败' });
  }
});

app.put('/api/orders/:id/status', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending', 'paid', 'shipped', 'cancelled'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: '无效的订单状态' });
  try {
    const result = await run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: '订单不存在' });
    res.json({ message: '订单状态已更新' });
  } catch (err) {
    res.status(500).json({ error: '更新订单状态失败' });
  }
});

// --- 用户管理 API（管理员） ---
app.get('/api/users', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const users = await all('SELECT id, username, role, created_at FROM users ORDER BY created_at DESC');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: '获取用户列表失败' });
  }
});

app.put('/api/users/:id/role', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  const { role } = req.body;
  if (!['admin', 'super', 'user'].includes(role)) {
    return res.status(400).json({ error: '无效的用户角色' });
  }
  try {
    const result = await run('UPDATE users SET role = ? WHERE id = ?', [role, req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: '用户不存在' });
    res.json({ message: '用户角色已更新' });
  } catch (err) {
    res.status(500).json({ error: '更新用户角色失败' });
  }
});

app.delete('/api/users/:id', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: '不能删除自己' });
  }
  try {
    await run('DELETE FROM cart_items WHERE user_id = ?', [req.params.id]);
    await run('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = ?)', [req.params.id]);
    await run('DELETE FROM orders WHERE user_id = ?', [req.params.id]);
    const result = await run('DELETE FROM users WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: '用户不存在' });
    res.json({ message: '用户已删除' });
  } catch (err) {
    res.status(500).json({ error: '删除用户失败' });
  }
});

// 统计数据（管理员仪表盘）
app.get('/api/stats', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const userCount = await get('SELECT COUNT(*) as count FROM users');
    const productCount = await get('SELECT COUNT(*) as count FROM products');
    const orderCount = await get('SELECT COUNT(*) as count FROM orders');
    const revenue = await get('SELECT COALESCE(SUM(total_price), 0) as total FROM orders WHERE status != ?' , ['cancelled']);
    res.json({
      users: userCount.count,
      products: productCount.count,
      orders: orderCount.count,
      revenue: revenue.total
    });
  } catch (err) {
    res.status(500).json({ error: '获取统计数据失败' });
  }
});

// 启动服务器
if (require.main === module) {
  initDatabase().then(() => {
    app.listen(PORT, () => {
      console.log(`Shop Platform running at http://localhost:${PORT}`);
    });
  });
}

module.exports = app;
