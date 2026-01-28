# 开发流程与命令系统

## 1) 核心规则

- 所有命令从仓库根目录执行
- 环境切换只用标志：`--dev/--staging/--prod/--test/--e2e`（禁止位置参数）
- 本地禁止 `dx build all`（CI 可用 `dx build all --prod`）

## 2) 提交前自检（增量）

1. `dx lint`
2. 如 lint 有错：`dx lint --fix` 后再 `dx lint`
3. 构建：优先 `dx build affected --dev|--prod`；或按需 `dx build backend` / `dx build front` / `dx build admin`
4. 后端改动：识别受影响 E2E，逐个运行 `dx test e2e backend <file-or-dir> [-t "case name"]`
5. 后端 DTO/API 变更：在 backend 构建后再 `dx build sdk`

## 3) 常用命令（速查）

- 启动：`dx start backend --dev` / `dx start front --dev` / `dx start admin --dev` / `dx start all`
- 数据库：`dx db format` / `dx db generate` / `dx db migrate --dev --name <name>` / `dx db deploy --<env>` / `dx db seed --dev`

## 4) 前端日志（最小约定）

- 构建期：Next.js 用 `NEXT_PUBLIC_LOG_LEVEL`；Vite 用 `VITE_LOG_LEVEL`
- 运行期临时覆盖：`localStorage.logLevel`（优先级最高）

## 5) Seed（最小约定）

- 入口与目录：`apps/backend/prisma/seed.ts`、`apps/backend/prisma/seed/`
- 密钥：必须从环境变量读取；禁止硬编码生产密钥
- 详细结构与维护约定以 `apps/backend/prisma/README.md` 为准
