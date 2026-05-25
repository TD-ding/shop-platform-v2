const request = require('supertest');
const app = require('../server');
const { run, initDatabase } = require('../database');

let adminToken, userToken, superToken;

beforeAll(async () => {
  await initDatabase();
});

// --- 用户认证测试 ---
describe('用户认证', () => {
  test('管理员登录成功', async () => {
    const res = await request(app).post('/api/login').send({ username: 'admin', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('admin');
    adminToken = res.body.token;
  });

  test('超级用户登录成功', async () => {
    const res = await request(app).post('/api/login').send({ username: 'superuser', password: 'super123' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('super');
    superToken = res.body.token;
  });

  test('普通用户登录成功', async () => {
    const res = await request(app).post('/api/login').send({ username: 'user1', password: 'user123' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('user');
    userToken = res.body.token;
  });

  test('登录失败 - 密码错误', async () => {
    const res = await request(app).post('/api/login').send({ username: 'admin', password: 'wrong' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('登录失败 - 用户不存在', async () => {
    const res = await request(app).post('/api/login').send({ username: 'nobody', password: 'test' });
    expect(res.status).toBe(400);
  });

  test('注册新用户成功', async () => {
    const res = await request(app).post('/api/register').send({ username: 'test_new', password: 'test1234' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('user');
  });

  test('注册失败 - 用户名已存在', async () => {
    const res = await request(app).post('/api/register').send({ username: 'admin', password: 'test1234' });
    expect(res.status).toBe(400);
  });

  test('注册失败 - 密码太短', async () => {
    const res = await request(app).post('/api/register').send({ username: 'shortpwd', password: '12' });
    expect(res.status).toBe(400);
  });

  test('注册失败 - 空字段', async () => {
    const res = await request(app).post('/api/register').send({ username: '', password: '' });
    expect(res.status).toBe(400);
  });
});

// --- 权限测试 ---
describe('权限控制', () => {
  test('未登录访问商品列表被拒绝', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(401);
  });

  test('未登录访问购物车被拒绝', async () => {
    const res = await request(app).get('/api/cart');
    expect(res.status).toBe(401);
  });

  test('普通用户不能创建商品', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', 'Bearer ' + userToken)
      .send({ name: 'test', price: 100 });
    expect(res.status).toBe(403);
  });

  test('普通用户不能访问管理后台', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', 'Bearer ' + userToken);
    expect(res.status).toBe(403);
  });

  test('管理员可以创建商品', async () => {
    const res = await request(app)
      .post('/api/products')
      .set('Authorization', 'Bearer ' + adminToken)
      .send({ name: '测试商品', price: 99.9, stock: 50, category: '测试' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBeDefined();
  });
});

// --- 商品测试 ---
describe('商品功能', () => {
  test('普通用户获取商品列表', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', 'Bearer ' + userToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // 普通用户不应该看到特殊商品
    res.body.forEach(p => expect(p.is_special).toBeFalsy());
  });

  test('超级用户可以看到特殊商品且有折扣', async () => {
    const res = await request(app)
      .get('/api/products')
      .set('Authorization', 'Bearer ' + superToken);
    expect(res.status).toBe(200);
    const special = res.body.find(p => p.is_special);
    if (special) {
      expect(special.originalPrice).toBeDefined();
      expect(special.price).toBeLessThan(special.originalPrice);
    }
  });

  test('健康检查端点', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// --- 购物车测试 ---
describe('购物车功能', () => {
  test('加入购物车', async () => {
    const products = await request(app)
      .get('/api/products')
      .set('Authorization', 'Bearer ' + userToken);
    const product = products.body[0];
    if (product) {
      const res = await request(app)
        .post('/api/cart')
        .set('Authorization', 'Bearer ' + userToken)
        .send({ product_id: product.id, quantity: 2 });
      expect(res.status).toBe(200);
    }
  });

  test('获取购物车', async () => {
    const res = await request(app)
      .get('/api/cart')
      .set('Authorization', 'Bearer ' + userToken);
    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(res.body.total).toBeDefined();
  });
});

// --- 管理员测试 ---
describe('管理员功能', () => {
  test('获取统计数据', async () => {
    const res = await request(app)
      .get('/api/stats')
      .set('Authorization', 'Bearer ' + adminToken);
    expect(res.status).toBe(200);
    expect(res.body.users).toBeDefined();
    expect(res.body.products).toBeDefined();
    expect(res.body.orders).toBeDefined();
    expect(res.body.revenue).toBeDefined();
  });

  test('获取用户列表', async () => {
    const res = await request(app)
      .get('/api/users')
      .set('Authorization', 'Bearer ' + adminToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  test('不能删除自己', async () => {
    const res = await request(app)
      .delete('/api/users/1')
      .set('Authorization', 'Bearer ' + adminToken);
    expect(res.status).toBe(400);
  });
});
