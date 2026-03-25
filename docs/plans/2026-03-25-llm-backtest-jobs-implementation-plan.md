# LLM Backtest Jobs Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 AI 量化“开始回测”从前端 mock 切换为 quantify 后端异步 jobs 回测链路，并正确传递 symbol/周期/时段。

**Architecture:** 在前端新增独立 backtest jobs client，负责 create/poll/result 三段调用。页面层通过小型状态机管理回测流程与 UI 反馈，并将后端 BacktestReport 映射到现有 BacktestResult，保持现有展示组件兼容。

**Tech Stack:** Next.js (App Router), React, TypeScript, Jest/jsdom, repository `@/lib/api` request pattern。

---

### Task 1: 定义回测任务 API 客户端（失败测试先行）

**Files:**
- Create: `apps/front/src/components/ai-quant/backtest-job-client.test.ts`
- Create: `apps/front/src/components/ai-quant/backtest-job-client.ts`

**Step 1: Write the failing test**

在 `backtest-job-client.test.ts` 编写以下场景：
- `createBacktestJob` 调用正确 endpoint 与 payload
- `getBacktestJob` 正确解析 `queued/running/succeeded/failed`
- `getBacktestJobResult` 成功返回 summary
- 非 2xx 时抛出包含状态码/消息的错误

**Step 2: Run test to verify it fails**

Run: `pnpm jest apps/front/src/components/ai-quant/backtest-job-client.test.ts --runInBand`
Expected: FAIL（模块不存在）

**Step 3: Write minimal implementation**

在 `backtest-job-client.ts` 实现：
- `createBacktestJob(payload)`
- `getBacktestJob(jobId)`
- `getBacktestJobResult(jobId)`
- 统一错误转换函数（复用 `ApiError` 语义）

**Step 4: Run test to verify it passes**

Run: `pnpm jest apps/front/src/components/ai-quant/backtest-job-client.test.ts --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/ai-quant/backtest-job-client.ts apps/front/src/components/ai-quant/backtest-job-client.test.ts
git commit -m "feat(front): add ai-quant backtest jobs api client"
```

### Task 2: 增加回测请求组装器（参数映射）

**Files:**
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Create: `apps/front/src/components/ai-quant/backtest-payload-builder.test.ts`
- Create: `apps/front/src/components/ai-quant/backtest-payload-builder.ts`

**Step 1: Write the failing test**

在 `backtest-payload-builder.test.ts` 枚举需求场景：
- symbol 正常映射为 `symbols[0]`
- 预设时段映射成合法 `fromTs/toTs`
- custom 时段映射并验证顺序
- strategy 中 `protocolVersion='v1'`、`scriptCode`、`params` 正确
- `bars` 固定为空数组

**Step 2: Run test to verify it fails**

Run: `pnpm jest apps/front/src/components/ai-quant/backtest-payload-builder.test.ts --runInBand`
Expected: FAIL（模块不存在）

**Step 3: Write minimal implementation**

实现 builder：
- 输入：symbol/timeframe/range/scriptCode/params
- 输出：`RunBacktestDto` 结构
- 对缺失 scriptCode、非法时间区间返回显式错误

**Step 4: Run test to verify it passes**

Run: `pnpm jest apps/front/src/components/ai-quant/backtest-payload-builder.test.ts --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/ai-quant/backtest-payload-builder.ts apps/front/src/components/ai-quant/backtest-payload-builder.test.ts apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx
git commit -m "feat(front): add backtest dto payload builder"
```

### Task 3: 页面接入 jobs 状态机并替换 mock 回测

**Files:**
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Modify: `apps/front/src/components/ai-quant/QuantChatPanel.tsx`
- Create: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx`

**Step 1: Write the failing test**

在 `AiQuantPageClient.backtest-jobs.test.tsx` 增加：
- 点击回测后调用 `createBacktestJob`
- 状态轮询到 `succeeded` 后展示结果卡片
- `failed` 时展示错误消息
- `running` 期间按钮禁用
- 超时后展示 timeout 提示

**Step 2: Run test to verify it fails**

Run: `pnpm jest 'apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx' --runInBand`
Expected: FAIL（行为尚未实现）

**Step 3: Write minimal implementation**

在页面中实现：
- 替换 `getMockBacktest` 路径
- 引入 `idle/submitting/running/succeeded/failed/timeout` 状态
- 轮询逻辑（指数退避，60s 超时，支持取消）
- 结果映射为 `BacktestResult` 并保留 `symbol/startAt/endAt`

**Step 4: Run test to verify it passes**

Run: `pnpm jest 'apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx' --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/front/src/components/ai-quant/QuantChatPanel.tsx apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx
git commit -m "feat(front): wire ai-quant backtest button to async jobs"
```

### Task 4: 回归与兼容性验证

**Files:**
- Modify (if needed): `apps/front/src/components/ai-quant/BacktestSummaryCard.tsx`
- Modify (if needed): `apps/front/src/app/[lng]/ai-quant/backtest/[id]/page.tsx`

**Step 1: Write the failing test**

补充或更新已有测试，覆盖：
- 全屏详情页 query 参数保持兼容
- 旧流程（聊天、逻辑图确认、部署入口）无回归

**Step 2: Run test to verify it fails**

Run: `pnpm jest apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx --runInBand`
Expected: FAIL（若出现回归）或 PASS（无变更需求）

**Step 3: Write minimal implementation**

仅在出现回归时做最小修复，不扩展 UI 功能。

**Step 4: Run test to verify it passes**

Run: `pnpm jest apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/ai-quant/BacktestSummaryCard.tsx apps/front/src/app/[lng]/ai-quant/backtest/[id]/page.tsx apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx
git commit -m "test(front): stabilize ai-quant backtest jobs integration"
```

### Task 5: 全量验证与文档同步

**Files:**
- Modify: `docs/plans/2026-03-25-llm-backtest-jobs-design.md`（仅当实现偏差）
- Optional: `docs/plans/2026-03-25-llm-backtest-jobs-implementation-plan.md`（标记完成状态）

**Step 1: Run targeted tests**

Run:
- `pnpm jest apps/front/src/components/ai-quant/backtest-job-client.test.ts --runInBand`
- `pnpm jest apps/front/src/components/ai-quant/backtest-payload-builder.test.ts --runInBand`
- `pnpm jest 'apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx' --runInBand`

Expected: PASS

**Step 2: Run regression suite (ai-quant scope)**

Run: `pnpm jest apps/front/src/app/[lng]/ai-quant --runInBand`
Expected: PASS

**Step 3: Lint changed files**

Run: `pnpm eslint apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/front/src/components/ai-quant --config eslint.config.js`
Expected: PASS

**Step 4: Final commit**

```bash
git add apps/front/src docs/plans
git commit -m "feat(front): complete ai-quant async backtest jobs flow"
```
