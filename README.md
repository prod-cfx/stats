# net-monorepo

基于 Nx 的 Monorepo 项目，提供 **NestJS 后端**、**Next.js 用户端**、**Next.js 管理台** 以及共享包。所有应用使用 Nx 进行任务编排，开发/构建命令统一通过 `./scripts/dx` 封装。

## 目录结构

```
apps/
├── backend/       # NestJS 11.1.5 + Prisma 6.19.0，REST API，监听 3000
├── front/         # Next.js 15.4.7 + React 18.2，用户端，监听 3001
└── admin-front/   # Next.js 15.4.6 + React 19，管理后台，监听 3500

packages/
├── shared/        # @ai/shared：跨端类型、ErrorCode、工具方法
├── api-contracts/ # @ai/api-contracts：openapi-zod-client 生成的 Zod 模型 + HTTP 客户端
└── config/        # @net/config：dotenv + zod 环境加载器

scripts/           # DX CLI（./scripts/dx）、env 校验脚本
ruler/             # AI 协作规范文档
docs/              # 项目文档
docker/            # Docker 部署配置
```

## 快速开始

```bash
./scripts/dx start all   # 并行启动 backend/front/admin（development）
```

## 初始化数据库（首次必做，一次即可）

```bash
./scripts/dx db migrate --dev --name init_schema
./scripts/dx db seed --dev
```

> 开发环境执行 `db migrate` 时必须通过 `--name`/`-n` 指定迁移名称（如 `init_schema`），否则命令会直接失败，避免 Prisma 进入交互式输入。
> 部署 / CI 环境请统一使用 `./scripts/dx deploy --<env>`（如 `--staging`、`--prod`、`--test`），该命令会执行 `prisma migrate deploy`、无需 `--name`。
> `db seed` 会写入默认用户/管理员角色以及后台初始账号。如果跳过该步骤，前台用户注册时将无法为新账号分配 `USER` 角色，接口会返回 “Default user role is missing”。

## 环境变量策略

所有入口通过 `packages/config` 的 `loadEnvironment()` 统一加载，并由 `./scripts/dx` 在命令入口做强校验：

- `.env.example`：敏感变量占位，全部使用 `__SET_IN_env.local__`。
- `.env.<env>`：非敏感的可提交配置（development/staging/production/e2e）。
- `.env.<env>.local`：仅供本地敏感值，已加入 `.gitignore`。

### Coinglass 清算热力图（DataSync Job）

`CoinglassHeatmapJob` 依赖以下环境变量，否则任务会打印 “API key 未配置” 并跳过：

- **`COINGLASS_API_KEY`**：必填
- **`COINGLASS_HEATMAP_ENDPOINT`**：可选（不填则使用默认 `https://open-api-v4.coinglass.com/api/futures/liquidation/heatmap/model3`）

## 常用命令（DX CLI）

所有命令从仓库根目录执行，统一通过 `./scripts/dx` 调用：

| 类别 | 命令 | 说明 |
|------|------|------|
| **启动** | `./scripts/dx start backend --dev` | 启动 Nest 开发服务（3000） |
| | `./scripts/dx start front --dev` | 启动用户端 Next（3001） |
| | `./scripts/dx start admin --dev` | 启动管理端 Next（3500） |
| | `./scripts/dx start all` | 并行启动所有服务 |
| **构建** | `./scripts/dx build backend --dev` | Nest 构建 |
| | `./scripts/dx build front --dev` | Next 用户端构建 |
| | `./scripts/dx build admin --dev` | Next 管理端构建 |
| **Lint** | `./scripts/dx lint` | 全量 lint 检查 |
| | `./scripts/dx lint --fix` | 自动修复 lint 问题 |
| **数据库** | `./scripts/dx db generate` | Prisma generate |
| | `./scripts/dx db format` | schema.prisma 格式化 |
| | `./scripts/dx db migrate --dev --name <name>` | 开发迁移（必须提供 name） |
| | `./scripts/dx db seed --dev` | 执行种子脚本 |
| | `./scripts/dx deploy --prod` | 应用迁移（prisma migrate deploy） |
| **合约** | `./scripts/dx contracts` | 导出 Swagger + 生成 Zod Client |
| **测试** | `./scripts/dx test e2e backend` | 运行全部 E2E 测试 |
| | `./scripts/dx test e2e backend <file> [-t "case"]` | 指定文件/用例 |
| **预检** | `./scripts/dx prcheck --prod` | PR 预检（CI 使用） |
| **缓存** | `./scripts/dx cache clear` | 清理 Nx/PNPM 缓存 |

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | NestJS 11.1.5、Prisma 6.19.0、PostgreSQL、ioredis、winston |
| 用户端 | Next.js 15.4.7、React 18.2、Redux Toolkit、shadcn/ui、TailwindCSS |
| 管理端 | Next.js 15.4.6、React 19、Ant Design 5.26、Zustand |
| 工具链 | Nx 19.8.14、TypeScript 5.9.2、ESLint @antfu、Prettier、husky |

## Nx 高级用法

```bash
npx nx graph          # 查看依赖关系图
npx nx affected:graph # 查看受影响的项目
```

## 开发规范

详细的开发规范和架构说明请参阅 `ruler/` 目录：

- `ruler/development.md` - 开发流程与命令系统
- `ruler/architecture.md` - 架构与技术栈
- `ruler/conventions.md` - 代码规范与约束
- `ruler/git-workflow.md` - Git 与 GitHub 规范
- `ruler/linus-thinking.md` - Linus 决策法则

## 文档入口

更详细的架构说明与开发规范，请参阅：

- `docs/architecture.md` - 当前整体架构（后端 + Serverless 网关 + 前端）。
- `ruler/development.md` - 开发流程与命令系统。
- `ruler/architecture.md` - 参考架构与技术栈说明。
- `ruler/conventions.md` - 代码规范与约束。
- `ruler/git-workflow.md` - Git 与 GitHub 规范。
- `ruler/linus-thinking.md` - Linus 决策法则。
