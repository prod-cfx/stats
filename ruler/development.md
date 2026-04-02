# 开发流程与命令系统

## 1) 核心规则

- 所有命令从仓库根目录执行
- 环境切换只用标志（禁止位置参数）；且必须使用该命令实际支持的环境集合
- 构建策略：直接构建目标 target（如 `dx build backend --dev`）；Nx 会自动复用缓存并处理依赖，不要手工按依赖链逐个编译

## 2) 提交前自检（增量）

1. `dx lint`
2. 如 lint 有错：按提示修复后再 `dx lint`
3. 构建：优先直接执行目标构建（如 `dx build backend --dev`）；改动范围不确定时再用 `dx build affected --dev|--prod`（避免手工逐个编译）
4. 后端改动：识别受影响 E2E，逐个运行 `dx test e2e backend <file-or-dir> [-t "case name"]`
5. Quantify 改动：识别受影响 E2E，逐个运行 `dx test e2e quantify apps/quantify/e2e/<file-or-dir>`；最小可用校验可执行 `dx test e2e quantify apps/quantify/e2e/health`
6. 前端改动：按改动范围执行 `dx test unit front` / `dx test unit admin`；若只需最小验证，可直接运行单个测试文件
7. 后端 DTO/API 变更：在 backend 构建后再 `dx build contracts --dev`

## 3) 常用命令（速查）

- 启动：`dx start backend --dev` / `dx start front --dev` / `dx start admin --dev` / `dx start all`
- 数据库：`dx db format` / `dx db generate` / `dx db migrate --dev --name <name>` / `dx db deploy --dev|--e2e|--prod` / `dx db seed --dev`

## 4) 前端日志（最小约定）

- 构建期：Next.js 用 `NEXT_PUBLIC_LOG_LEVEL`；Vite 用 `VITE_LOG_LEVEL`
- 运行期临时覆盖：`localStorage.logLevel`（优先级最高）

## 5) Seed（最小约定）

- 入口与目录：`apps/backend/prisma/seed.ts`、`apps/backend/prisma/seed/`
- 密钥：必须从环境变量读取；禁止硬编码生产密钥
- 详细结构与维护约定以 `apps/backend/prisma/README.md` 为准
