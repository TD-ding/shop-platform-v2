// --- 全局状态 ---
let currentUser = null;
let token = null;
let allProducts = [];
let currentPage = 'home';
let isLoading = false;

// --- 工具函数 ---
function api(method, url, data) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (token) opts.headers['Authorization'] = 'Bearer ' + token;
  if (data) opts.body = JSON.stringify(data);
  return fetch(url, opts).then(r => r.json());
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => { t.className = 'toast'; }, 2500);
}

function showLoading(show) {
  isLoading = show;
  let loader = document.getElementById('global-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'global-loader';
    loader.style.cssText = 'position:fixed;top:60px;left:0;right:0;height:3px;z-index:999;overflow:hidden;pointer-events:none';
    loader.innerHTML = '<div style="width:40%;height:100%;background:#4f46e5;animation:loader-bar 1s ease infinite"></div>';
    document.body.appendChild(loader);
    const style = document.createElement('style');
    style.textContent = '@keyframes loader-bar{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}';
    document.head.appendChild(style);
  }
  loader.style.display = show ? '' : 'none';
}

function navigate(page) {
  if (!currentUser && page !== 'home' && page !== 'products') {
    showToast('请先登录', 'error');
    showAuth('login');
    return;
  }
  document.querySelectorAll('.page').forEach(p => p.style.display = 'none');
  const el = document.getElementById('page-' + page);
  if (el) el.style.display = '';
  currentPage = page;

  if (page === 'products') loadProducts();
  if (page === 'cart') loadCart();
  if (page === 'orders') loadOrders();
  if (page === 'admin') loadAdmin();
}

// --- 认证 ---
function showAuth(mode) {
  const modal = document.getElementById('auth-modal');
  const form = document.getElementById('auth-form');
  modal.style.display = 'flex';

  if (mode === 'login') {
    form.innerHTML = `
      <h3>登录</h3>
      <div class="form-group"><label>用户名</label><input type="text" id="login-user" onkeydown="if(event.key==='Enter')doLogin()"></div>
      <div class="form-group">
        <label>密码</label>
        <div style="position:relative">
          <input type="password" id="login-pass" onkeydown="if(event.key==='Enter')doLogin()">
          <span class="toggle-pwd" onclick="togglePwd('login-pass', this)">👁</span>
        </div>
      </div>
      <button class="btn btn-primary" style="width:100%" onclick="doLogin()" id="login-btn">登录</button>
      <p style="margin-top:12px;text-align:center;font-size:13px;color:#888">没有账号？<a href="#" onclick="showAuth('register');return false">注册一个</a></p>
      <p style="margin-top:8px;text-align:center;font-size:12px;color:#aaa">测试账号: admin/admin123 · superuser/super123 · user1/user123</p>
    `;
  } else {
    form.innerHTML = `
      <h3>注册</h3>
      <div class="form-group"><label>用户名（字母、数字、下划线、中文）</label><input type="text" id="reg-user" onkeydown="if(event.key==='Enter')doRegister()"></div>
      <div class="form-group">
        <label>密码（至少6位）</label>
        <div style="position:relative">
          <input type="password" id="reg-pass" onkeydown="if(event.key==='Enter')doRegister()">
          <span class="toggle-pwd" onclick="togglePwd('reg-pass', this)">👁</span>
        </div>
      </div>
      <button class="btn btn-primary" style="width:100%" onclick="doRegister()" id="reg-btn">注册</button>
      <p style="margin-top:12px;text-align:center;font-size:13px;color:#888">已有账号？<a href="#" onclick="showAuth('login');return false">去登录</a></p>
    `;
  }
}

function togglePwd(inputId, el) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    el.textContent = '🔒';
  } else {
    input.type = 'password';
    el.textContent = '👁';
  }
}

function closeAuth() {
  document.getElementById('auth-modal').style.display = 'none';
}

async function doLogin() {
  const btn = document.getElementById('login-btn');
  btn.textContent = '登录中...';
  btn.disabled = true;
  const username = document.getElementById('login-user').value.trim();
  const password = document.getElementById('login-pass').value;
  const res = await api('POST', '/api/login', { username, password });
  if (res.error) { showToast(res.error, 'error'); btn.textContent = '登录'; btn.disabled = false; return; }
  token = res.token;
  currentUser = res.user;
  onLoginSuccess();
}

async function doRegister() {
  const btn = document.getElementById('reg-btn');
  btn.textContent = '注册中...';
  btn.disabled = true;
  const username = document.getElementById('reg-user').value.trim();
  const password = document.getElementById('reg-pass').value;
  const res = await api('POST', '/api/register', { username, password });
  if (res.error) { showToast(res.error, 'error'); btn.textContent = '注册'; btn.disabled = false; return; }
  token = res.token;
  currentUser = res.user;
  onLoginSuccess();
  showToast('注册成功！');
}

function onLoginSuccess() {
  closeAuth();
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(currentUser));
  updateNav();
  showToast('欢迎，' + currentUser.username + '！');
  navigate('products');
}

function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  updateNav();
  navigate('home');
  showToast('已退出登录');
}

function updateNav() {
  const userInfo = document.getElementById('user-info');
  const authBtns = document.getElementById('auth-buttons');
  const adminLink = document.getElementById('admin-link');
  if (currentUser) {
    userInfo.style.display = '';
    authBtns.style.display = 'none';
    document.getElementById('user-name').textContent = currentUser.username;
    const roleTag = document.getElementById('user-role');
    const roleNames = { admin: '管理员', super: '超级用户', user: '用户' };
    roleTag.textContent = roleNames[currentUser.role];
    roleTag.className = 'role-tag role-' + currentUser.role;
    adminLink.style.display = currentUser.role === 'admin' ? '' : 'none';
  } else {
    userInfo.style.display = 'none';
    authBtns.style.display = '';
    adminLink.style.display = 'none';
  }
  updateCartBadge();
}

async function updateCartBadge() {
  if (!currentUser) { document.getElementById('cart-badge').style.display = 'none'; return; }
  const res = await api('GET', '/api/cart');
  if (res.items) {
    const badge = document.getElementById('cart-badge');
    const count = res.items.reduce((s, i) => s + i.quantity, 0);
    badge.textContent = count;
    badge.style.display = count > 0 ? '' : 'none';
  }
}

// --- 商品 ---
async function loadProducts() {
  if (!currentUser) { showToast('请先登录', 'error'); return; }
  showLoading(true);
  const res = await api('GET', '/api/products');
  showLoading(false);
  if (Array.isArray(res)) {
    allProducts = res;
    renderProducts(res);
    updateCategoryFilter(res);
  }
}

function updateCategoryFilter(products) {
  const select = document.getElementById('category-filter');
  const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
  select.innerHTML = '<option value="">全部分类</option>' + cats.map(c => '<option value="' + c + '">' + c + '</option>').join('');
}

function filterProducts() {
  const search = document.getElementById('search-input').value.toLowerCase();
  const cat = document.getElementById('category-filter').value;
  let filtered = allProducts;
  if (search) filtered = filtered.filter(p => p.name.toLowerCase().includes(search) || (p.description && p.description.toLowerCase().includes(search)));
  if (cat) filtered = filtered.filter(p => p.category === cat);
  renderProducts(filtered);
}

function renderProducts(products) {
  const grid = document.getElementById('product-grid');
  if (products.length === 0) {
    grid.innerHTML = '<div class="empty-state"><div class="icon">📦</div><p>没有找到商品</p></div>';
    return;
  }
  grid.innerHTML = products.map(p => {
    const icons = { '手机': '📱', '电脑': '💻', '配件': '🎧', '平板': '📲', 'XR': '🥽' };
    const icon = icons[p.category] || '📦';
    let priceHtml = '<span class="price">&yen;' + p.price.toFixed(2) + '</span>';
    if (p.originalPrice) {
      priceHtml = '<span class="price">&yen;' + p.price.toFixed(2) + '</span><span class="original-price">&yen;' + p.originalPrice.toFixed(2) + '</span>';
    }
    const stockColor = p.stock <= 5 ? 'color:#ef4444' : '';
    return `
      <div class="product-card">
        <div class="product-img">${icon}</div>
        ${p.is_special ? '<span class="special-badge">VIP专属</span>' : ''}
        ${p.category ? '<span class="category-tag">' + p.category + '</span>' : ''}
        <h4>${escapeHtmlFE(p.name)}</h4>
        <p class="desc">${escapeHtmlFE(p.description || '')}</p>
        <p class="stock" style="${stockColor}">库存: ${p.stock}${p.stock <= 5 && p.stock > 0 ? ' (仅剩' + p.stock + '件)' : ''}${p.stock === 0 ? ' 已售罄' : ''}</p>
        <div class="price-row">
          ${priceHtml}
          <button class="btn btn-sm btn-primary" onclick="addToCart(${p.id})" ${p.stock === 0 ? 'disabled' : ''}>
            ${p.stock === 0 ? '缺货' : '加入购物车'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// 前端 XSS 防护
function escapeHtmlFE(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function addToCart(productId) {
  const res = await api('POST', '/api/cart', { product_id: productId });
  if (res.error) { showToast(res.error, 'error'); return; }
  showToast('已加入购物车！');
  updateCartBadge();
}

// --- 购物车 ---
async function loadCart() {
  showLoading(true);
  const res = await api('GET', '/api/cart');
  showLoading(false);
  const content = document.getElementById('cart-content');
  if (!res.items || res.items.length === 0) {
    content.innerHTML = '<div class="empty-state"><div class="icon">🛒</div><p>购物车是空的，去 <a href="#" onclick="navigate(\'products\');return false">逛逛</a> 吧</p></div>';
    return;
  }
  let html = res.items.map(item => {
    let priceLine = '&yen;' + (item.price * item.quantity).toFixed(2);
    if (item.originalPrice) priceLine = '<span style="text-decoration:line-through;color:#999;font-size:13px">&yen;' + (item.originalPrice * item.quantity).toFixed(2) + '</span> ' + priceLine;
    return `
      <div class="cart-item">
        <div class="item-info">
          <h4>${escapeHtmlFE(item.name)}</h4>
          <span class="stock">&yen;${item.price.toFixed(2)}/件${item.originalPrice ? ' (VIP价)' : ''}</span>
        </div>
        <div class="item-qty">
          <button onclick="changeQty(${item.id}, ${item.quantity - 1})" ${item.quantity <= 1 ? 'disabled' : ''}>-</button>
          <span>${item.quantity}</span>
          <button onclick="changeQty(${item.id}, ${item.quantity + 1})">+</button>
        </div>
        <div class="item-price">${priceLine}</div>
        <button class="btn btn-sm btn-danger" onclick="removeFromCart(${item.id})">删除</button>
      </div>
    `;
  }).join('');

  html += `
    <div class="cart-summary">
      <p>合计: <span class="total">&yen;${res.total.toFixed(2)}</span></p>
      ${currentUser && currentUser.role === 'super' ? '<p style="font-size:13px;color:#ca8a04">已享超级用户 8.5 折优惠</p>' : ''}
      <button class="btn btn-primary btn-lg" onclick="checkout()">结算下单</button>
    </div>
  `;
  content.innerHTML = html;
}

async function changeQty(cartId, qty) {
  if (qty < 1) { removeFromCart(cartId); return; }
  const res = await api('PUT', '/api/cart/' + cartId, { quantity: qty });
  if (res.error) { showToast(res.error, 'error'); return; }
  loadCart();
  updateCartBadge();
}

async function removeFromCart(cartId) {
  const res = await api('DELETE', '/api/cart/' + cartId);
  if (res.error) { showToast(res.error, 'error'); return; }
  showToast('已移除');
  loadCart();
  updateCartBadge();
}

async function checkout() {
  if (!confirm('确认下单？')) return;
  showLoading(true);
  const res = await api('POST', '/api/orders');
  showLoading(false);
  if (res.error) { showToast(res.error, 'error'); return; }
  showToast('下单成功！订单号: ' + res.orderId);
  updateCartBadge();
  navigate('orders');
}

// --- 订单 ---
async function loadOrders() {
  showLoading(true);
  const res = await api('GET', '/api/orders');
  showLoading(false);
  const content = document.getElementById('orders-content');
  if (!Array.isArray(res) || res.length === 0) {
    content.innerHTML = '<div class="empty-state"><div class="icon">📋</div><p>暂无订单</p></div>';
    return;
  }
  const statusNames = { pending: '待支付', paid: '已支付', shipped: '已发货', cancelled: '已取消' };
  content.innerHTML = res.map(order => `
    <div class="order-card">
      <div class="order-header">
        <span class="order-id">订单 #${order.id}</span>
        <span class="order-date">${new Date(order.created_at).toLocaleString('zh-CN')}</span>
        ${order.username ? '<span>用户: ' + escapeHtmlFE(order.username) + '</span>' : ''}
        <span class="status-tag status-${order.status}">${statusNames[order.status]}</span>
        ${!order.username && order.status === 'pending' ? '<button class="btn btn-sm btn-danger" onclick="cancelOrder(' + order.id + ')">取消订单</button>' : ''}
      </div>
      <div class="order-items">
        ${order.items.map(i => `
          <div class="order-item">
            <span>${escapeHtmlFE(i.product_name)} x${i.quantity}</span>
            <span>&yen;${(i.price * i.quantity).toFixed(2)}</span>
          </div>
        `).join('')}
      </div>
      <div class="order-total">总计: &yen;${order.total_price.toFixed(2)}</div>
    </div>
  `).join('');
}

// --- 管理后台 ---
async function cancelOrder(orderId) {
  if (!confirm('确定取消该订单？库存将恢复。')) return;
  const res = await api('PUT', '/api/orders/' + orderId + '/cancel');
  if (res.error) { showToast(res.error, 'error'); return; }
  showToast('订单已取消');
  loadOrders();
}

async function loadAdmin() {
  if (currentUser.role !== 'admin') { navigate('home'); return; }
  loadAdminStats();
  loadAdminProducts();
  loadAdminUsers();
  loadAdminOrders();
}

async function loadAdminStats() {
  const res = await api('GET', '/api/stats');
  if (res.error) return;
  document.getElementById('admin-stats').innerHTML = `
    <div class="stat-card"><div class="stat-value">${res.users}</div><div class="stat-label">用户数</div></div>
    <div class="stat-card"><div class="stat-value">${res.products}</div><div class="stat-label">商品数</div></div>
    <div class="stat-card"><div class="stat-value">${res.orders}</div><div class="stat-label">订单数</div></div>
    <div class="stat-card"><div class="stat-value">&yen;${res.revenue.toFixed(2)}</div><div class="stat-label">总收入</div></div>
  `;
}

function switchAdminTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.admin-panel').forEach(p => p.style.display = 'none');
  event.target.classList.add('active');
  document.getElementById('admin-' + tab).style.display = '';
}

async function loadAdminProducts() {
  const res = await api('GET', '/api/products');
  if (!Array.isArray(res)) return;
  const panel = document.getElementById('admin-products');
  panel.innerHTML = `
    <button class="btn btn-primary" onclick="showProductModal()" style="margin-bottom:16px">添加商品</button>
    <table class="data-table">
      <thead><tr><th>ID</th><th>名称</th><th>价格</th><th>库存</th><th>分类</th><th>特殊</th><th>操作</th></tr></thead>
      <tbody>
        ${res.map(p => `
          <tr>
            <td>${p.id}</td><td>${escapeHtmlFE(p.name)}</td><td>&yen;${p.price.toFixed(2)}</td>
            <td>${p.stock}</td><td>${escapeHtmlFE(p.category || '-')}</td>
            <td>${p.is_special ? '✅' : '—'}</td>
            <td>
              <button class="btn btn-sm" onclick='editProduct(${JSON.stringify(p).replace(/'/g, "&#39;")})'>编辑</button>
              <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">删除</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function showProductModal(product) {
  document.getElementById('product-modal').style.display = 'flex';
  document.getElementById('product-modal-title').textContent = product ? '编辑商品' : '添加商品';
  document.getElementById('pf-id').value = product ? product.id : '';
  document.getElementById('pf-name').value = product ? product.name : '';
  document.getElementById('pf-desc').value = product ? product.description : '';
  document.getElementById('pf-price').value = product ? product.price : '';
  document.getElementById('pf-stock').value = product ? product.stock : '';
  document.getElementById('pf-category').value = product ? product.category : '';
  document.getElementById('pf-special').checked = product ? !!product.is_special : false;
}

function closeProductModal() {
  document.getElementById('product-modal').style.display = 'none';
}

function editProduct(product) {
  showProductModal(product);
}

async function saveProduct(e) {
  e.preventDefault();
  const id = document.getElementById('pf-id').value;
  const data = {
    name: document.getElementById('pf-name').value,
    description: document.getElementById('pf-desc').value,
    price: parseFloat(document.getElementById('pf-price').value),
    stock: parseInt(document.getElementById('pf-stock').value),
    category: document.getElementById('pf-category').value,
    is_special: document.getElementById('pf-special').checked
  };
  let res;
  if (id) {
    res = await api('PUT', '/api/products/' + id, data);
  } else {
    res = await api('POST', '/api/products', data);
  }
  if (res.error) { showToast(res.error, 'error'); return; }
  showToast(id ? '商品已更新' : '商品已创建');
  closeProductModal();
  loadAdminProducts();
}

async function deleteProduct(id) {
  if (!confirm('确定删除该商品？')) return;
  const res = await api('DELETE', '/api/products/' + id);
  if (res.error) { showToast(res.error, 'error'); return; }
  showToast('商品已删除');
  loadAdminProducts();
  loadAdminStats();
}

async function loadAdminUsers() {
  const res = await api('GET', '/api/users');
  if (!Array.isArray(res)) return;
  const panel = document.getElementById('admin-users');
  const roleNames = { admin: '管理员', super: '超级用户', user: '普通用户' };
  panel.innerHTML = `
    <table class="data-table">
      <thead><tr><th>ID</th><th>用户名</th><th>角色</th><th>注册时间</th><th>操作</th></tr></thead>
      <tbody>
        ${res.map(u => `
          <tr>
            <td>${u.id}</td><td>${escapeHtmlFE(u.username)}</td>
            <td><span class="role-tag role-${u.role}">${roleNames[u.role]}</span></td>
            <td>${new Date(u.created_at).toLocaleString('zh-CN')}</td>
            <td>
              <select onchange="changeUserRole(${u.id}, this.value)" class="btn btn-sm">
                <option value="user" ${u.role === 'user' ? 'selected' : ''}>普通用户</option>
                <option value="super" ${u.role === 'super' ? 'selected' : ''}>超级用户</option>
                <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>管理员</option>
              </select>
              <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">删除</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function changeUserRole(userId, role) {
  const res = await api('PUT', '/api/users/' + userId + '/role', { role });
  if (res.error) { showToast(res.error, 'error'); return; }
  showToast('角色已更新');
  loadAdminUsers();
}

async function deleteUser(id) {
  if (!confirm('确定删除该用户？相关订单也会被删除。')) return;
  const res = await api('DELETE', '/api/users/' + id);
  if (res.error) { showToast(res.error, 'error'); return; }
  showToast('用户已删除');
  loadAdminUsers();
  loadAdminStats();
}

async function loadAdminOrders() {
  const res = await api('GET', '/api/orders');
  if (!Array.isArray(res)) return;
  const panel = document.getElementById('admin-orders');
  const statusNames = { pending: '待支付', paid: '已支付', shipped: '已发货', cancelled: '已取消' };
  panel.innerHTML = `
    <table class="data-table">
      <thead><tr><th>订单号</th><th>用户</th><th>金额</th><th>状态</th><th>时间</th><th>操作</th></tr></thead>
      <tbody>
        ${res.map(o => `
          <tr>
            <td>#${o.id}</td><td>${escapeHtmlFE(o.username || '-')}</td>
            <td>&yen;${o.total_price.toFixed(2)}</td>
            <td><span class="status-tag status-${o.status}">${statusNames[o.status]}</span></td>
            <td>${new Date(o.created_at).toLocaleString('zh-CN')}</td>
            <td>
              <select onchange="changeOrderStatus(${o.id}, this.value)" class="btn btn-sm">
                <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>待支付</option>
                <option value="paid" ${o.status === 'paid' ? 'selected' : ''}>已支付</option>
                <option value="shipped" ${o.status === 'shipped' ? 'selected' : ''}>已发货</option>
                <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>已取消</option>
              </select>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

async function changeOrderStatus(orderId, status) {
  const res = await api('PUT', '/api/orders/' + orderId + '/status', { status });
  if (res.error) { showToast(res.error, 'error'); return; }
  showToast('订单状态已更新');
  loadAdminOrders();
  loadAdminStats();
}

// --- 初始化 ---
function init() {
  const savedToken = localStorage.getItem('token');
  const savedUser = localStorage.getItem('user');
  if (savedToken && savedUser) {
    token = savedToken;
    currentUser = JSON.parse(savedUser);
    updateNav();
  }
}

init();
