# 服务器部署文档

## 一、架构概览

```
┌─────────────────┐
│  Vercel (CDN)   │
├─────────────────┤
│ Front (3001)    │  用户端 Next.js
│ Admin (3500)    │  管理后台 Next.js
└─────────────────┘
         │
         ↓ API 调用
┌─────────────────┐
│  自建服务器      │
├─────────────────┤
│ Backend (3000)  │  NestJS REST API
│ PostgreSQL      │  主数据库
│ Redis           │  缓存
└─────────────────┘
```

---

## 二、Backend 部署（自建服务器）

### 2.1 环境要求

| 组件       | 版本要求 | 说明              |
| ---------- | -------- | ----------------- |
| Node.js    | >= 20.x  | 推荐使用 LTS 版本 |
| pnpm       | >= 9.x   | 包管理器          |
| PostgreSQL | >= 15.x  | 主数据库          |
| Redis      | >= 7.x   | 缓存数据库        |

### 2.2 首次部署流程

#### 步骤 1：克隆代码

```bash
git clone <repository-url>
cd <project-directory>
```

#### 步骤 2：安装依赖

```bash
pnpm install
```

#### 步骤 3：配置环境变量

创建生产环境配置文件：

```bash
cp .env.example .env.production.local
```

编辑 `.env.production.local`，配置以下关键变量：

```env
# 数据库（必填）
DATABASE_URL=postgresql://user:password@host:5432/dbname

# Redis（必填）
REDIS_URL=redis://:password@host:6379/0

# 应用密钥（必填，使用强随机字符串）
APP_SECRET=<生成的随机字符串>
JWT_SECRET=<生成的随机字符串>

# 邮件服务（必填）
RESEND_API_KEY=<resend-api-key>
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=YourApp

# 交易所账户加密（必填）
EXCHANGE_ACCOUNT_CRYPTO_KEY=<32字节随机字符串>

# 外部 API（按需配置）
COINGLASS_API_KEY=<coinglass-api-key>
POLYMARKET_GAMMA_API_KEY=<polymarket-gamma-key>
POLYMARKET_CLOB_API_KEY=<polymarket-clob-key>
BBX_ACCESS_KEY_ID=<bbx-key-id>
BBX_ACCESS_SECRET=<bbx-secret>
HYPERLIQUID_API_URL=https://api.hyperliquid.xyz
```

**生成随机密钥示例**：

```bash
# 生成 APP_SECRET 和 JWT_SECRET
openssl rand -base64 32

# 生成 EXCHANGE_ACCOUNT_CRYPTO_KEY（32字节）
openssl rand -hex 32
```

#### 步骤 4：生成 Prisma Client 与构建

```bash
# 1. 生成 Prisma Client（必须先执行）
dx db generate

# 2. 构建后端（编译 TypeScript → JavaScript）
dx build backend --prod

 # 3. 生成 API Contracts（SDK）
 dx build contracts --prod
```

**说明**：

- `db generate` 生成 Prisma Client，后端代码依赖此步骤
- `build backend` 编译 TypeScript 代码到 `dist/` 目录，并生成 OpenAPI 规范
- `build contracts` 基于 OpenAPI 生成 Zod 模型和 HTTP 客户端，供前端使用
- `build contracts` 基于 OpenAPI 生成 Zod 模型和 HTTP 客户端，供前端使用
- 注意：合约生成依赖 `dotenv-cli`，它会把 `--` 后面的内容当作“可执行文件+参数”运行，因此命令本身不能以 `set -euo pipefail; ...` 这类 shell 语句开头；当前实现会用 `bash -lc` 包裹执行
- 注意：`openapi-zod-client` 对递归 schema（DTO 自引用）支持不稳定；如遇到生成失败，需避免在 Swagger Schema 中直接输出递归引用（可改成宽松 object/unknown，并由前端在运行时自行递归处理）
- 虽然 `start` 命令会自动触发 build（如需要），但**显式构建是最佳实践**，确保构建过程可控和可追踪

#### 步骤 5：数据库迁移

```bash
# 应用数据库迁移
dx db deploy --prod

# 初始化种子数据（仅首次部署）
dx db seed --prod
```

**⚠️ 注意**：

- `db seed` 会创建默认管理员账号（用户名：admin，密码：admin123）
- 生产环境建议通过环境变量覆盖默认账号：

```env
SEED_ADMIN_USERNAME=your_admin
SEED_ADMIN_PASSWORD=your_strong_password
SEED_ADMIN_EMAIL=admin@yourdomain.com
```

#### 步骤 6：启动服务

**生产环境推荐使用 PM2 进程管理器**：

```bash
# 安装 PM2（如未安装）
npm install -g pm2

# 启动服务
pm2 start dx --name "backend" -- start backend --prod

# 保存 PM2 配置
pm2 save

# 设置开机自启
pm2 startup
```

**临时测试可使用前台启动**：

```bash
dx start backend --prod
```

**⚠️ 注意**：前台启动会占用终端，关闭终端后服务停止，仅适合临时测试。

#### 步骤 7：验证部署

```bash
# 检查服务状态
curl http://localhost:3000/api/v1/health

# 预期返回
{
  "status": "ok",
  "info": {
    "database": { "status": "up" },
    "redis": { "status": "up" }
  }
}
```

### 2.3 更新部署流程

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 安装新依赖（如有）
pnpm install

# 3. 构建后端
dx build backend --prod

# 4. 构建 API Contracts（如后端 API 有变更）
dx build contracts --prod

# 5. 应用数据库迁移（如有）
dx db deploy --prod

# 6. 重启服务
pm2 restart backend

# 7. 验证服务
curl http://localhost:3000/health
```

**说明**：

- 如果仅修改了后端业务逻辑，无 API 变更，可跳过步骤 4
- 如果有新增/修改 API 接口或 DTO，必须执行步骤 4 重新生成 SDK

### 2.4 常见问题排查

| 问题           | 排查方法                                    |
| -------------- | ------------------------------------------- |
| 服务启动失败   | 检查 `DATABASE_URL` 和 `REDIS_URL` 是否正确 |
| 数据库连接失败 | 确认 PostgreSQL 服务运行中，防火墙允许连接  |
| Redis 连接失败 | 确认 Redis 服务运行中，密码正确             |
| 迁移失败       | 检查数据库用户权限，查看错误日志            |

**查看日志**：

```bash
# PM2 日志
pm2 logs backend

# 应用日志（如配置了文件日志）
tail -f logs/app.log
```

---

## 三、Front & Admin 部署（Vercel）

### 3.1 Front（用户端）部署

#### Vercel 项目配置

**Root Directory**: `apps/front`

**Build Command**:

```bash
cd ../.. && dx build backend --prod && dx build contracts --prod && dx build front --prod
```

**说明**：

- 必须先构建 backend 生成 OpenAPI 规范
- 然后构建 contracts 生成 SDK（`@ai/api-contracts`）
- 最后构建 front（依赖 SDK）

**Output Directory**: `apps/front/.next`

**Install Command**:

```bash
pnpm install
```

#### 环境变量配置

在 Vercel 项目设置中添加以下环境变量：

```env
# Backend API 地址（必填）
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# 日志级别（可选，默认 WARN）
NEXT_PUBLIC_LOG_LEVEL=WARN

# Hyperliquid API（可选）
NEXT_PUBLIC_HYPERLIQUID_API_URL=https://api.hyperliquid.xyz
```

### 3.2 Admin（管理后台）部署

#### Vercel 项目配置

**Root Directory**: `apps/admin-front`

**Build Command**:

```bash
cd ../.. && dx build backend --prod && dx build contracts --prod && dx build admin --prod
```

**说明**：

- 必须先构建 backend 生成 OpenAPI 规范
- 然后构建 contracts 生成 SDK（`@ai/api-contracts`）
- 最后构建 admin（依赖 SDK）

**Output Directory**: `apps/admin-front/.next`

**Install Command**:

```bash
pnpm install
```

#### 环境变量配置

在 Vercel 项目设置中添加以下环境变量：

```env
# Backend API 地址（必填）
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# 日志级别（可选，默认 WARN）
NEXT_PUBLIC_LOG_LEVEL=WARN
```

### 3.3 Vercel 部署流程

1. **连接 Git 仓库**：在 Vercel 控制台导入项目
2. **配置构建设置**：按上述配置填写
3. **添加环境变量**：在 Settings → Environment Variables 添加
4. **触发部署**：推送代码到 main 分支自动触发部署

### 3.4 手动触发部署

```bash
# 安装 Vercel CLI
pnpm add -g vercel

# 登录
vercel login

# 部署 Front
cd apps/front
vercel --prod

# 部署 Admin
cd apps/admin-front
vercel --prod
```

---

## 四、部署检查清单

### Backend 首次部署

- [ ] 服务器环境满足要求（Node.js、PostgreSQL、Redis）
- [ ] 克隆代码并安装依赖
- [ ] 配置 `.env.production.local`（所有必填项）
- [ ] 生成强随机密钥（APP_SECRET、JWT_SECRET、EXCHANGE_ACCOUNT_CRYPTO_KEY）
- [ ] 构建后端（`dx build backend --prod`）
- [ ] 构建 API Contracts（`dx build contracts --prod`）
- [ ] 应用数据库迁移（`dx db deploy --prod`）
- [ ] 初始化种子数据（`dx db seed --prod`）
- [ ] 启动服务并配置 PM2
- [ ] 验证健康检查接口（`/health`）
- [ ] 修改默认管理员密码

### Backend 更新部署

- [ ] 拉取最新代码
- [ ] 安装新依赖（如有）
- [ ] 构建后端（`dx build backend --prod`）
- [ ] 构建 API Contracts（如后端 API 有变更：`dx build contracts --prod`）
- [ ] 应用数据库迁移（如有）
- [ ] 重启服务
- [ ] 验证健康检查接口

### Front & Admin 部署

- [ ] Vercel 项目配置正确（Root Directory、Build Command）
- [ ] 环境变量配置完整（NEXT_PUBLIC_API_URL 等）
- [ ] 触发部署并验证
- [ ] 测试前后端连通性

---

## 五、安全建议

1. **密钥管理**：
   - 所有密钥使用强随机字符串
   - 定期轮换 JWT_SECRET 和 APP_SECRET
   - 不要在代码中硬编码密钥

2. **数据库安全**：
   - 使用专用数据库用户，限制权限
   - 启用 SSL 连接（生产环境）
   - 定期备份数据库

3. **网络安全**：
   - 配置防火墙，仅开放必要端口
   - 使用反向代理（Nginx/Caddy）处理 HTTPS
   - 启用 CORS 白名单

4. **监控告警**：
   - 配置服务监控（PM2、Uptime 监控）
   - 设置日志告警（错误日志、异常流量）
   - 定期检查服务健康状态

---

## 六、回滚流程

### Backend 回滚

```bash
# 1. 切换到上一个稳定版本
git checkout <previous-stable-tag>

# 2. 重新构建
dx build backend --prod

# 3. 重新生成 SDK（如 API 有变化）
dx build contracts --prod

# 4. 回滚数据库迁移（如需要，谨慎操作）
# 手动执行回滚 SQL 或恢复数据库备份

# 5. 重启服务
pm2 restart backend
```

### Vercel 回滚

在 Vercel 控制台：

1. 进入 Deployments 页面
2. 找到上一个稳定部署
3. 点击 "Promote to Production"

---

## 七、联系与支持

- **技术文档**：`ruler/` 目录下的开发规范
- **命令参考**：`dx/config/commands.json`
- **问题反馈**：提交 GitHub Issue
