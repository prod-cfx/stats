# Backtesting Capabilities Global Config Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 quantify 后端实现 `GET /backtesting/capabilities`，从全局数据库配置返回回测可用标的与基础周期，无配置时返回空数组。

**Architecture:** 在 backtesting 模块新增 repository + service 分层：repository 只负责读取激活配置，service 负责 JSON 字段归一化与兜底，controller 暴露只读接口并保持 `run/jobs` 既有行为不变。

**Tech Stack:** NestJS、Prisma、TypeScript、Jest（unit/integration style module tests）。

---

### Task 1: 新增 Prisma 模型与迁移骨架

**Files:**
- Modify: `apps/quantify/prisma/schema/backtesting_capabilities.prisma`（新建）
- Modify: `apps/quantify/prisma/schema/base.prisma`（若需要 include）
- Create: `apps/quantify/prisma/schema/migrations/<timestamp>_add_backtest_capability_configs/migration.sql`

**Step 1: Write schema test expectation (文档化断言)**

在迁移说明中明确表结构与字段映射：
- `allowed_symbols` JSON
- `allowed_base_timeframes` JSON
- `is_active` boolean

**Step 2: Run prisma format/check to verify current state**

Run: `pnpm --filter @ai/quantify exec prisma format --schema prisma/schema.prisma`
Expected: PASS（当前 schema 可格式化）

**Step 3: Add minimal Prisma model + migration SQL**

新增模型 `BacktestCapabilityConfig`，并创建建表 SQL。

**Step 4: Validate Prisma artifacts**

Run: `pnpm --filter @ai/quantify exec prisma validate --schema prisma/schema.prisma`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/quantify/prisma/schema/backtesting_capabilities.prisma apps/quantify/prisma/schema/migrations
git commit -m "feat(quantify): add global backtest capability config model"
```

### Task 2: Backtesting repository 层

**Files:**
- Create: `apps/quantify/src/modules/backtesting/repositories/backtest-capabilities.repository.ts`
- Create: `apps/quantify/src/modules/backtesting/repositories/backtest-capabilities.repository.spec.ts`
- Modify: `apps/quantify/src/modules/backtesting/backtesting.module.ts`

**Step 1: Write the failing test**

覆盖：
- `isActive=true` 且多条记录时，按 `updatedAt desc` 取第一条
- 无记录返回 `null`

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai/quantify exec jest src/modules/backtesting/repositories/backtest-capabilities.repository.spec.ts --runInBand`
Expected: FAIL（文件/实现不存在）

**Step 3: Write minimal implementation**

实现 `findActiveConfig()`，仅封装 Prisma 查询，不做业务转换。

**Step 4: Run test to verify it passes**

Run: 同上
Expected: PASS

**Step 5: Commit**

```bash
git add apps/quantify/src/modules/backtesting/repositories/backtest-capabilities.repository.ts apps/quantify/src/modules/backtesting/repositories/backtest-capabilities.repository.spec.ts apps/quantify/src/modules/backtesting/backtesting.module.ts
git commit -m "feat(quantify): add backtest capabilities repository"
```

### Task 3: Backtesting service 归一化逻辑

**Files:**
- Create: `apps/quantify/src/modules/backtesting/services/backtest-capabilities.service.ts`
- Create: `apps/quantify/src/modules/backtesting/services/backtest-capabilities.service.spec.ts`

**Step 1: Write the failing test**

覆盖：
- 正常 JSON 字符串数组原样返回
- 无配置返回 `{ allowedSymbols: [], allowedBaseTimeframes: [] }`
- 脏数据（对象/数字/混合类型）降级为空数组

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai/quantify exec jest src/modules/backtesting/services/backtest-capabilities.service.spec.ts --runInBand`
Expected: FAIL

**Step 3: Write minimal implementation**

实现：
- `getCapabilities()`
- `toStringArray(value: unknown): string[]`

**Step 4: Run test to verify it passes**

Run: 同上
Expected: PASS

**Step 5: Commit**

```bash
git add apps/quantify/src/modules/backtesting/services/backtest-capabilities.service.ts apps/quantify/src/modules/backtesting/services/backtest-capabilities.service.spec.ts
git commit -m "feat(quantify): add backtest capabilities service"
```

### Task 4: Controller 暴露 `/backtesting/capabilities`

**Files:**
- Modify: `apps/quantify/src/modules/backtesting/backtesting.controller.ts`
- Modify: `apps/quantify/src/modules/backtesting/backtesting.controller.spec.ts`

**Step 1: Write the failing test**

在 controller spec 新增断言：
- 存在 `getCapabilities` 方法
- 调用后返回 service 值

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai/quantify exec jest src/modules/backtesting/backtesting.controller.spec.ts --runInBand`
Expected: FAIL（方法不存在）

**Step 3: Write minimal implementation**

- 注入 `BacktestCapabilitiesService`
- 新增 `@Get('capabilities')`

**Step 4: Run test to verify it passes**

Run: 同上
Expected: PASS

**Step 5: Commit**

```bash
git add apps/quantify/src/modules/backtesting/backtesting.controller.ts apps/quantify/src/modules/backtesting/backtesting.controller.spec.ts
git commit -m "feat(quantify): expose backtesting capabilities endpoint"
```

### Task 5: 模块装配与回归验证

**Files:**
- Modify (if needed): `apps/quantify/src/modules/backtesting/backtesting-module.spec.ts`
- Modify (if needed): `apps/quantify/src/modules/backtesting/backtesting.module.ts`

**Step 1: Verify module wiring tests**

Run: `pnpm --filter @ai/quantify exec jest src/modules/backtesting/backtesting.module.spec.ts --runInBand`
Expected: PASS

**Step 2: Run focused backtesting tests**

Run: `pnpm --filter @ai/quantify exec jest src/modules/backtesting --runInBand`
Expected: PASS

**Step 3: Run endpoint e2e slice (if env ready)**

Run: `pnpm --filter @ai/quantify exec jest e2e/backtesting --runInBand`
Expected: PASS（或记录环境阻塞）

**Step 4: Commit verification adjustments (if any)**

```bash
git add apps/quantify/src/modules/backtesting
git commit -m "test(quantify): cover backtesting capabilities endpoint"
```

### Task 6: Front/Back contract smoke check

**Files:**
- Modify (if needed): `apps/front/src/components/ai-quant/backtest-capability-client.test.ts`

**Step 1: Add/adjust contract assertion**

确认前端仍按：
- `allowedSymbols`
- `allowedBaseTimeframes`
解析。

**Step 2: Run front contract test**

Run: `pnpm --filter @ai/front exec jest src/components/ai-quant/backtest-capability-client.test.ts --runInBand`
Expected: PASS

**Step 3: Commit (if changed)**

```bash
git add apps/front/src/components/ai-quant/backtest-capability-client.test.ts
git commit -m "test(front): keep backtest capabilities contract aligned"
```

