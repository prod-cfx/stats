# Backtesting Capabilities Stability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在不改变现有 API 路径和成功响应结构的前提下，降低 `brav1/backtesting/*` 在上游瞬态异常时的 502 暴露率，并补齐可定位根因的结构化观测。

**Architecture:** 在 `backend` 的 `ai-quant-proxy` 层统一做上游异常分类、`capabilities` 空集降级、`jobs*` 可重试错误映射；在 `quantify` 的 `backtesting` 层补充查询与出口观测字段。保持 userspace 接口兼容，不引入缓存/熔断等额外复杂机制。

**Tech Stack:** NestJS 11, TypeScript, Jest, DomainException/ErrorCode, QuantifyAiQuantClient

---

### Task 1: Backend 代理层错误分类与可重试语义基础

**Files:**
- Modify: `apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.ts`
- Modify: `apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts`

**Step 1: Write the failing test**

在 `ai-quant-proxy.service.spec.ts` 新增用例：将超时/连接失败/502/503/非 JSON 归类为 `transient_upstream`，并验证 `jobs*` 映射为可重试语义（非直接 502 透传）。

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai/backend exec jest src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts --runInBand`
Expected: FAIL（缺少分类与映射逻辑）

**Step 3: Write minimal implementation**

在 `ai-quant-proxy.service.ts` 增加最小私有分类函数与可重试映射函数，不改变现有公开方法签名。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai/backend exec jest src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.ts apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts
git commit -m "refactor(ai-quant-proxy): add transient error classification for backtesting"
```

### Task 2: Capabilities 失败降级为空能力集

**Files:**
- Modify: `apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.ts`
- Modify: `apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts`

**Step 1: Write the failing test**

新增用例：`getBacktestCapabilities` 在 transient/internal 异常下返回
`{ allowedSymbols: [], allowedBaseTimeframes: [] }`；业务错误保持原语义。

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai/backend exec jest src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts --runInBand`
Expected: FAIL

**Step 3: Write minimal implementation**

在 `getBacktestCapabilities` 中引入降级分支，仅覆盖 transient/internal 异常。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai/backend exec jest src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.ts apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts
git commit -m "feat(ai-quant-proxy): fallback empty capabilities on transient failures"
```

### Task 3: Jobs* 统一可重试错误语义

**Files:**
- Modify: `apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.ts`
- Modify: `apps/backend/src/modules/ai-quant-proxy/backtesting.controller.ts`
- Modify: `apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts`

**Step 1: Write the failing test**

新增 `createBacktestJob/getBacktestJob/getBacktestJobResult` 的 transient 失败用例，断言返回统一可重试错误码与状态。

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai/backend exec jest src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts --runInBand`
Expected: FAIL

**Step 3: Write minimal implementation**

在 3 个 jobs 代理方法复用同一错误映射入口；保留 business error 原语义。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai/backend exec jest src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.ts apps/backend/src/modules/ai-quant-proxy/backtesting.controller.ts apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts
git commit -m "feat(ai-quant-proxy): normalize retryable semantics for backtesting jobs"
```

### Task 4: Quantify 层观测补齐（定位根因）

**Files:**
- Modify: `apps/quantify/src/modules/backtesting/backtesting.controller.ts`
- Modify: `apps/quantify/src/modules/backtesting/services/backtest-capabilities.service.ts`
- Modify: `apps/quantify/src/modules/backtesting/backtesting.controller.spec.ts`
- Modify: `apps/quantify/src/modules/backtesting/services/backtest-capabilities.service.spec.ts`

**Step 1: Write the failing test**

新增观测相关断言：异常路径会产生日志字段（endpoint/errorClass/traceId），成功路径记录耗时。

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai/quantify exec jest src/modules/backtesting/backtesting.controller.spec.ts src/modules/backtesting/services/backtest-capabilities.service.spec.ts --runInBand`
Expected: FAIL

**Step 3: Write minimal implementation**

在 controller/service 增加最小结构化日志，不改返回结构。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai/quantify exec jest src/modules/backtesting/backtesting.controller.spec.ts src/modules/backtesting/services/backtest-capabilities.service.spec.ts --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/quantify/src/modules/backtesting/backtesting.controller.ts apps/quantify/src/modules/backtesting/services/backtest-capabilities.service.ts apps/quantify/src/modules/backtesting/backtesting.controller.spec.ts apps/quantify/src/modules/backtesting/services/backtest-capabilities.service.spec.ts
git commit -m "chore(quantify): add backtesting observability for capabilities and jobs"
```

### Task 5: 端到端回归与文档收敛

**Files:**
- Modify: `apps/backend/src/modules/ai-quant-proxy/*.spec.ts`（必要时）
- Modify: `apps/quantify/src/modules/backtesting/*.spec.ts`（必要时）
- Modify: `docs/plans/2026-03-27-backtesting-capabilities-stability-design.md`（仅实现偏差时）

**Step 1: Run focused backend tests**

Run: `pnpm --filter @ai/backend exec jest src/modules/ai-quant-proxy --runInBand`
Expected: PASS

**Step 2: Run focused quantify tests**

Run: `pnpm --filter @ai/quantify exec jest src/modules/backtesting --runInBand`
Expected: PASS

**Step 3: Run minimal guarded e2e smoke**

Run: `dx test e2e quantify apps/quantify/e2e/health`
Expected: PASS

**Step 4: Update docs only if implementation deviates**

若实现与设计存在偏差，更新 design 文档的对应章节并说明原因。

**Step 5: Commit**

```bash
git add apps/backend/src/modules/ai-quant-proxy apps/quantify/src/modules/backtesting docs/plans/2026-03-27-backtesting-capabilities-stability-design.md
git commit -m "test(backtesting): verify stability fallback and observability coverage"
```
