# 开发流程与命令系统

## 1) 核心规则

- 所有命令从仓库根目录执行
- 环境切换只用标志（禁止位置参数）；且必须使用该命令实际支持的环境集合
- 构建策略：直接构建目标 target（如 `dx build backend --dev`）；Nx 会自动复用缓存并处理依赖，不要手工按依赖链逐个编译

## 2) 提交前自检（增量）

1. `dx lint`
2. 如 lint 有错：按提示修复后再 `dx lint`
3. **构建（必须，push 前硬门槛）**：对每个受影响 target 执行 `dx build <target> --dev`；改动范围不确定时用 `dx build affected --dev`。
   - `dx lint` + `dx test unit` **不能替代** build 检查——conflict marker、TS 类型错误仅全量编译能捕获。
   - `.husky/pre-push` 会自动执行此步骤（`pnpm install` 后生效）；但手动 push 前也应主动跑，不依赖 hook 兜底。
   - 紧急绕过：`git push --no-verify`，**必须在 PR body 注明原因**，否则 reviewer 有权退回。
4. 后端改动：识别受影响 E2E，逐个运行 `dx test e2e backend <file-or-dir> [-t "case name"]`
5. Quantify 改动：识别受影响 E2E，逐个运行 `dx test e2e quantify apps/quantify/e2e/<file-or-dir>`；最小可用校验可执行 `dx test e2e quantify apps/quantify/e2e/health`
6. 前端改动：按改动范围执行 `dx test unit front` / `dx test unit admin`；若只需最小验证，也通过 `dx test unit <target> <file>` 聚焦单个 Jest 测试文件
7. 共享包改动：优先执行 `dx test unit shared`，再按影响面追加应用级验证
8. Backend / Quantify DTO 或 OpenAPI 变更：在对应服务构建或 swagger 可导出后再执行 `dx build contracts --dev`

## 3) 常用命令（速查）

- 启动：`dx start backend --dev` / `dx start quantify --dev` / `dx start front --dev` / `dx start admin --dev` / `dx start all`
- 完整服务栈：`dx start stack`（PM2，包含 `backend`、`front`、`admin`、`quantify`，并执行端口/缓存清理）
- 数据库（backend）：`dx db format` / `dx db generate` / `dx db migrate --dev --name <name>` / `dx db deploy --dev|--e2e|--prod` / `dx db seed --dev`
- 数据库（quantify）：`dx db format quantify --dev` / `dx db generate quantify --dev` / `dx db migrate quantify --dev --name <name>` / `dx db deploy quantify --dev|--e2e`
- 合约：`dx build contracts --dev`
- 测试：`unit` 可以全量跑（`dx test unit all`）；E2E 不可以全量跑，必须使用 `dx test e2e <target> <file-or-dir> [-t "case name"]`

## 4) 前端日志（最小约定）

- 构建期：Next.js 用 `NEXT_PUBLIC_LOG_LEVEL`
- 运行期临时覆盖：`localStorage.logLevel`（优先级最高）

## 5) Flutter mobile（开发运行）

- 发现移动端有更新时，优先复用已有 `flutter run` 会话，在该会话中发送 `r` 触发热重载。
- 不要每次重新编译；只有确认没有可复用 `flutter run` 会话时，才启动新的 `flutter run`。

## 6) Seed（最小约定）

- 入口与目录：`apps/backend/prisma/seed.ts`、`apps/backend/prisma/seed/`
- Quantify 入口：`apps/quantify/prisma/seed.ts`
- 密钥：必须从环境变量读取；禁止硬编码生产密钥
- 详细结构与维护约定以 `apps/backend/prisma/README.md` 为准
