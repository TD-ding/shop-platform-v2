# Shop Platform 购物平台

一个前后端交互的购物平台，支持三种用户角色：管理员、超级用户、普通用户。

## 功能

### 用户认证
- 注册/登录（JWT Token，7天有效期）
- 密码修改
- 角色权限控制

### 普通用户
- 浏览商品、搜索、分类筛选
- 购物车（增删改查）
- 下单、查看订单
- 取消待支付订单

### 超级用户
- 普通用户所有功能
- 专属 8.5 折优惠
- VIP 专属特殊商品
- 折扣价/原价对比展示

### 管理员
- 超级用户所有功能
- 管理后台：商品管理（CRUD）
- 用户管理（角色切换、删除）
- 订单管理（状态流转）
- 统计仪表盘（用户/商品/订单/收入）

## 技术栈

- 前端：HTML / CSS / JavaScript（原生单页应用）
- 后端：Node.js 18+ / Express 4.x
- 数据库：SQLite 3
- 认证：JWT（HS256）
- 部署：Docker / Docker Compose
- CI：GitHub Actions

## 快速开始

```bash
npm install
cp .env.example .env
npm start
```

访问 http://localhost:3000

### 默认账号

| 用户名 | 密码 | 角色 |
|--------|------|------|
| admin | admin123 | 管理员 |
| superuser | super123 | 超级用户 |
| user1 | user123 | 普通用户 |

## 开发

```bash
npm run lint    # ESLint 检查
npm test        # 运行 22 个单元测试
npm start       # 启动开发服务器
```

## Docker

```bash
docker compose up -d
```

## 文档

- [前端文档](docs/frontend.md)
- [后端 API 文档](docs/backend.md)
- [部署文档](docs/deployment.md)

## 开发迭代记录

| 轮次 | 类型 | PR | 说明 |
|------|------|-----|------|
| 1 | feat | #1 | 初始版本 - 基础功能实现 |
| 2 | refactor | #2 | 代码质量优化 |
| 3 | feat | #3 | 用户体验优化 |
| 4 | feat | #4 | 功能增强 |
| 5 | fix | #5 | Bug修复 + Lint/测试/Docker/CI |

## 仓库

https://github.com/TD-ding/shop-platform-v2
