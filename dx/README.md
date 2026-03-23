# dx 命令系统 — 部署配置说明

本目录是 `dx` 全局工具的项目级配置根目录，定义了构建、启动、数据库、测试、部署等所有命令。

## 目录结构

```text
dx/
├── config/
│   ├── commands.json      # 所有 dx 命令定义（核心）
│   ├── env-layers.json    # 环境文件分层映射
│   └── env-policy.jsonc   # 环境变量治理策略
├── deploy/
│   ├── ecosystem.backend.config.cjs   # backend 部署专用 PM2 配置
│   └── ecosystem.quantify.config.cjs  # quantify 部署专用 PM2 配置
└── README.md
```

## 部署架构

本项目有两类部署目标：

| 目标 | 部署方式 | 部署命令 |
|------|---------|---------|
| `backend` | dx `backend-artifact-deploy` → SSH → PM2 | `dx deploy backend --staging/--prod` |
| `quantify` | dx `backend-artifact-deploy` → SSH → PM2 | `dx deploy quantify --staging/--prod` |
| `front` | Vercel CLI | `dx deploy front --staging/--prod` |
| `admin` | Vercel CLI | `dx deploy admin --staging/--prod` |

### 后端制品部署流程 (backend / quantify)

`dx deploy backend --prod` 执行的完整流程：

1. **本地构建** — `npx nx build backend --configuration=production`
2. **打包制品** — 将 `dist/backend` + `package.json` + `pnpm-lock.yaml` + Prisma schema 打包为 `release/backend/backend-bundle.tar.gz`
3. **SSH 上传** — 通过 SSH 将制品上传到远端服务器
4. **远端安装** — `pnpm install --prod --no-frozen-lockfile --ignore-workspace`
5. **Prisma 迁移** — `prisma generate` + `prisma migrate deploy`（+ 可选 seed）
6. **PM2 重启** — 使用 `dx/deploy/ecosystem.backend.config.cjs` 重启服务
7. **版本保留** — 保留最近 5 个 release，旧版本自动清理

quantify 流程相同，使用独立的 Prisma schema 和 PM2 配置。

### 前端 Vercel 部署 (front / admin)

`dx deploy front --prod` 会调用 Vercel CLI：

```bash
vercel deploy --yes --prod --local-config vercel.front.json
```

Vercel 项目配置文件位于仓库根目录：`vercel.front.json`、`vercel.admin.json`。

## 部署前置配置

### 1. SSH 配置

后端部署需要 SSH 免密访问远端服务器。在 `~/.ssh/config` 中添加：

```
Host stats-server
    HostName <your-server-ip>
    Port <ssh-port>
    User root
    IdentityFile ~/.ssh/<your-key>
```

`commands.json` 中 `deploy.backend.backendDeploy.remote.host` 默认值为 `stats-server`，需与 SSH config 中的 Host 名称一致。

> 在 CI 环境中，host 信息从 GitHub Secrets 注入，不依赖本地 SSH config。

### 2. 远端服务器准备

在目标服务器上确保：

```bash
# 项目目录
mkdir -p /opt/stats

# 必要工具
node -v    # >= 22.12
pnpm -v    # 已安装
pm2 -v     # 已安装

# 环境变量文件（敏感值）
# 在 /opt/stats 下提前放好：
#   .env.production.local   — backend 生产环境敏感变量
#   .env.staging.local      — backend 预发环境敏感变量
```

### 3. GitHub Secrets 配置

在仓库 Settings → Secrets and variables → Actions 中配置：

| Secret 名称 | 说明 | 示例 |
|-------------|------|------|
| `DEPLOY_ENVIRONMENT` | 部署环境 | `staging` 或 `prod` |
| `AWS_SSH_PRIVATE_KEY` | SSH 私钥（完整 PEM） | `-----BEGIN OPENSSH...` |
| `AWS_SSH_HOST` | 服务器 IP / 域名 | `1.2.3.4` |
| `AWS_SSH_PORT` | SSH 端口 | `22` |
| `AWS_SSH_USER` | SSH 用户名 | `root` |
| `VERCEL_TOKEN` | Vercel 部署 Token | `vercel_xxx` |
| `DATABASE_URL` | Backend 数据库连接串 | `postgresql://...` |
| `QUANTIFY_DATABASE_URL` | Quantify 数据库连接串 | `postgresql://...` |
| `REDIS_URL` | Redis 连接串 | `redis://...` |
| `JWT_SECRET` | JWT 密钥 | — |
| `APP_SECRET` | 应用密钥 | — |
| ... | 其余敏感变量见 `dx/config/env-policy.jsonc` | — |

### 4. Vercel 项目配置

前端部署前需要在 Vercel 上创建项目并关联：

```bash
# 登录 Vercel
vercel login

# 关联 front 项目（在仓库根目录执行）
vercel link --local-config vercel.front.json

# 关联 admin 项目
vercel link --local-config vercel.admin.json
```

在 Vercel 项目的 Environment Variables 中设置 `APP_ENV`：
- Production: `APP_ENV=production`
- Preview: `APP_ENV=staging`

`VERCEL_ORG_ID` 和 `VERCEL_PROJECT_ID` 会在 `vercel link` 后写入 `.vercel/project.json`，也可以通过 `.env.<env>` 文件提供。

## 本地部署（手动）

```bash
# 部署 backend 到 staging
dx deploy backend --staging

# 部署 quantify 到生产
dx deploy quantify --prod

# 部署 front 到生产
dx deploy front --prod

# 部署 admin 到 staging
dx deploy admin --staging
```

## CI 部署（GitHub Actions）

CI 在 `.github/workflows/ci.yml`，通过 `workflow_dispatch` 手动触发：

1. 进入 GitHub 仓库 → Actions → CI
2. 点击 "Run workflow"
3. 选择 target：`all` / `backend` / `quantify` / `front` / `admin`
4. 点击 "Run workflow"

CI 会根据 `DEPLOY_ENVIRONMENT` secret 决定部署到 staging 还是 production。

### CI 与本地部署的区别

| 方面 | 本地 | CI |
|------|------|-----|
| SSH 主机 | 来自 `~/.ssh/config` (`stats-server`) | 来自 GitHub Secrets (`AWS_SSH_HOST`) |
| dx 配置 | 直接读 `dx/config/commands.json` | 生成临时配置注入 Secrets 中的主机信息 |
| 环境变量 | 本地 `.env.*.local` | 服务器预先配置的 `.env.*.local` |
| Vercel | 本地 `vercel login` 凭证 | `VERCEL_TOKEN` secret |

## PM2 配置文件说明

| 文件 | 用途 |
|------|------|
| `dx/deploy/ecosystem.backend.config.cjs` | `backend-artifact-deploy` 在远端启动 backend 使用 |
| `dx/deploy/ecosystem.quantify.config.cjs` | `backend-artifact-deploy` 在远端启动 quantify 使用 |
| `ecosystem.config.cjs`（仓库根） | 本地 `dx start stack` 开发/生产通用 PM2 配置 |
| `prod-ecosystem.config.cjs`（仓库根） | 生产服务器手动 PM2 启动备用 |
| `staging-ecosystem.config.cjs`（仓库根） | 预发服务器手动 PM2 启动备用 |

## 环境治理

详见 `dx/config/env-policy.jsonc`。核心规则：

- 敏感值只放 `.env.<env>.local`（不提交）
- 非敏感配置放 `.env.<env>`（提交）
- 占位符统一为 `__SET_IN_env.local__`
- quantify 独立前缀：`QUANTIFY_DATABASE_URL`、`QUANTIFY_REDIS_URL`、`QUANTIFY_JWT_SECRET` 等
