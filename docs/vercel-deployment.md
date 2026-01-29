# Vercel 自动部署配置指南

本指南说明如何配置 GitHub Actions 自动部署前端应用到 Vercel。

## 📋 前置准备

### 1. Vercel 项目设置

在 Vercel 控制台为每个前端应用创建项目：

#### Front（用户前端）

1. 访问 [Vercel Dashboard](https://vercel.com/dashboard)
2. 点击 "Add New" → "Project"
3. 导入 Git 仓库
4. 配置项目设置：
   - **Framework Preset**: Next.js
   - **Root Directory**: 保持为 `./` (根目录)
   - **Build Command**: 留空（使用 vercel.front.json 中的配置）
   - **Output Directory**: 留空（使用 vercel.front.json 中的配置）
5. 部署项目并获取 **Project ID**（从项目设置中获取）

#### Admin（管理后台）

1. 重复上述步骤创建另一个项目
2. 使用 `vercel.admin.json` 配置
3. 获取该项目的 **Project ID**

### 2. 获取 Vercel Token 和 Org ID

#### 获取 Personal Access Token:

1. 访问 [Vercel Tokens](https://vercel.com/account/tokens)
2. 点击 "Create Token"
3. 命名（如 "GitHub Actions Deploy"）
4. 复制生成的 token（只显示一次）

#### 获取 Org/Team ID:

1. 访问你的团队设置页面，URL 类似：`https://vercel.com/teams/your-team-name/settings`
2. Team ID 显示在设置页面中
3. 或者从项目设置的 URL 中提取（`team_xxxxx` 格式）

## 🔧 GitHub 仓库配置

### Staging 环境（测试仓库）

进入仓库设置：`https://github.com/your-org/your-repo/settings/secrets/actions`

添加以下 Secrets：

| Secret名称                  | 值          | 说明                             |
| --------------------------- | ----------- | -------------------------------- |
| **DEPLOY_ENVIRONMENT**      | `staging`   | **必须配置** - 指定为staging环境 |
| **VERCEL_TOKEN**            | (你的token) | Vercel Personal Access Token     |
| **VERCEL_ORG_ID**           | (团队ID)    | Vercel Team/Organization ID      |
| **VERCEL_PROJECT_ID_FRONT** | (项目ID)    | Front 项目 ID                    |
| **VERCEL_PROJECT_ID_ADMIN** | (项目ID)    | Admin 项目 ID                    |

### Production 环境（生产仓库）

如果使用单独的生产仓库，重复上述步骤，但设置：

| Secret名称             | 值                 | 说明                                      |
| ---------------------- | ------------------ | ----------------------------------------- |
| **DEPLOY_ENVIRONMENT** | `prod`             | **必须配置** - 指定为production环境       |
| 其他 Secrets           | (对应生产环境的值) | 与 staging 相同的字段，但使用生产环境的值 |

## 📝 环境变量配置

### 1. 本地环境变量文件

在 `.env.staging.local` 或 `.env.production.local` 中填写真实值：

```env
# Vercel 部署配置
VERCEL_TOKEN=your_vercel_token_here
VERCEL_ORG_ID=team_xxxxx
VERCEL_PROJECT_ID_FRONT=prj_xxxxx
VERCEL_PROJECT_ID_ADMIN=prj_xxxxx
```

### 2. Vercel 项目环境变量

在 Vercel 项目设置中配置以下环境变量：

#### Front 项目：

```env
APP_ENV=staging  # 或 production
NEXT_PUBLIC_API_SERVER_URL=https://api-staging.example.com  # 后端 API 地址
NEXT_PUBLIC_WS_URL=https://api-staging.example.com  # WebSocket 地址
NEXT_PUBLIC_API_BASE_URL=https://api-staging.example.com/api/v1
NEXT_PUBLIC_APP_NAME=Net Web (Staging)
```

#### Admin 项目：

```env
APP_ENV=staging  # 或 production
NEXT_PUBLIC_API_SERVER_URL=https://api-staging.example.com
NEXT_PUBLIC_API_BASE_URL=https://api-staging.example.com/api/v1
NEXT_PUBLIC_APP_NAME=Net Admin (Staging)
```

## 🚀 使用方法

### 自动部署（通过 GitHub Actions）

1. 进入仓库的 **Actions** 页面
2. 选择 **"CI"** workflow
3. 点击 **"Run workflow"** 按钮
4. 选择部署目标：
   - `all` - 部署前端和后端
   - `front` - 只部署用户前端
   - `admin` - 只部署管理后台
   - `backend` - 只部署后端
5. 点击绿色的 **"Run workflow"** 按钮

### 本地手动部署（使用 Vercel CLI）

```bash
# 安装 Vercel CLI
pnpm add -g vercel

# 登录 Vercel
vercel login

# 部署 Front (staging)
vercel --cwd apps/front --prod=false

# 部署 Front (production)
vercel --cwd apps/front --prod

# 部署 Admin (staging)
vercel --cwd apps/admin-front --prod=false

# 部署 Admin (production)
vercel --cwd apps/admin-front --prod
```

## 🔍 部署流程说明

### GitHub Actions 部署流程

当触发 CI workflow 时：

1. **安装依赖**: `pnpm install --frozen-lockfile`
2. **构建共享包**: `dx build shared`
3. **构建 API Contracts**: `dx build contracts --prod`
4. **构建前端**: `dx build front --${APP_ENV}` 或 `dx build admin --${APP_ENV}`
5. **部署到 Vercel**: 使用 `dx deploy` 命令（内部调用 Vercel CLI）

### Vercel 构建配置

Vercel 使用根目录的 `vercel.front.json` 和 `vercel.admin.json` 配置：

- **installCommand**: 安装依赖
- **buildCommand**: 执行构建（包含 shared 和 contracts）
- **outputDirectory**: 指定构建输出目录
- **环境变量**: 通过 `APP_ENV` 控制构建环境

## ⚠️ 常见问题

### 1. 构建失败：找不到 `@ai/shared`

**原因**: shared 包未构建  
**解决**: 确保 `buildCommand` 中包含 `dx build shared`

### 2. 构建失败：找不到 `@ai/api-contracts`

**原因**: API Contracts 未生成  
**解决**: 确保 `buildCommand` 中包含 `dx build contracts --prod`

### 3. 环境变量未生效

**原因**: 环境变量配置不正确  
**解决**:

- 检查 Vercel 项目设置中的环境变量
- 确保 `APP_ENV` 正确设置
- 重新部署以应用新的环境变量

### 4. Vercel Token 权限不足

**原因**: Token 权限不足或已过期  
**解决**:

- 重新生成 Vercel Token
- 更新 GitHub Secrets 中的 `VERCEL_TOKEN`

## 📁 相关文件

- `vercel.front.json` - Front 项目 Vercel 配置
- `vercel.admin.json` - Admin 项目 Vercel 配置
- `.vercelignore` - Vercel 忽略文件配置
- `.github/workflows/ci.yml` - CI/CD 配置
- `dx/config/commands.json` - 部署命令配置

## 🔗 参考链接

- [Vercel 文档](https://vercel.com/docs)
- [Vercel CLI 文档](https://vercel.com/docs/cli)
- [GitHub Actions 文档](https://docs.github.com/actions)
