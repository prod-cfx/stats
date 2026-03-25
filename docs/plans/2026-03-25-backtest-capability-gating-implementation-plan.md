# Backtest Capability Gating Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在前端展示并强约束回测“可选标的+时间周期”，仅允许后端能力配置中的值发起回测。

**Architecture:** 新增能力读取 client 与页面 `capabilityState`，参数区改为受控下拉并在提交前做本地门禁校验。能力加载失败时直接禁用回测，不走 fallback 输入。

**Tech Stack:** Next.js/React/TypeScript、现有 ai-quant 页面状态模型、Jest/jsdom、front i18n JSON。

---

### Task 1: 能力 API 客户端与类型定义

**Files:**
- Create: `apps/front/src/components/ai-quant/backtest-capability-client.ts`
- Create: `apps/front/src/components/ai-quant/backtest-capability-client.test.ts`

**Step 1: Write the failing test**

覆盖：
- 成功返回 `allowedSymbols/allowedBaseTimeframes`
- 空集合返回被识别为不可用
- 非 2xx 转为 `ApiError`
- 超时/中断语义正确

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai/front exec jest src/components/ai-quant/backtest-capability-client.test.ts --runInBand`
Expected: FAIL（模块不存在）

**Step 3: Write minimal implementation**

实现：
- `fetchBacktestCapabilities()`
- 请求鉴权 header 复用现有模式
- 返回结构与空集合处理

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai/front exec jest src/components/ai-quant/backtest-capability-client.test.ts --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/ai-quant/backtest-capability-client.ts apps/front/src/components/ai-quant/backtest-capability-client.test.ts
git commit -m "feat(front): add backtest capability client"
```

### Task 2: 参数门禁与 builder 扩展

**Files:**
- Modify: `apps/front/src/components/ai-quant/backtest-payload-builder.ts`
- Modify: `apps/front/src/components/ai-quant/backtest-payload-builder.test.ts`

**Step 1: Write the failing test**

新增场景：
- `symbol` 不在能力集合 -> `symbol_not_allowed`
- `baseTimeframe` 不在能力集合 -> `timeframe_not_allowed`
- 合法值可正常构建 payload

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai/front exec jest src/components/ai-quant/backtest-payload-builder.test.ts --runInBand`
Expected: FAIL（新场景未实现）

**Step 3: Write minimal implementation**

在 builder 增加能力参数输入与校验，不改其他语义。

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai/front exec jest src/components/ai-quant/backtest-payload-builder.test.ts --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/components/ai-quant/backtest-payload-builder.ts apps/front/src/components/ai-quant/backtest-payload-builder.test.ts
git commit -m "feat(front): add capability gating checks to backtest payload builder"
```

### Task 3: 页面能力状态接入与受控下拉

**Files:**
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Modify: `apps/front/src/components/ai-quant/QuantChatPanel.tsx`
- Create: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.capability-gating.test.tsx`

**Step 1: Write the failing test**

覆盖：
- `loading` 时回测按钮禁用
- `failed` 时按钮禁用且提示能力加载失败
- `ready` 时可选择 `symbol/timeframe`
- 当前参数不在允许集合时自动修正

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai/front exec jest 'src/app/\[lng\]/ai-quant/AiQuantPageClient.capability-gating.test.tsx' --runInBand`
Expected: FAIL

**Step 3: Write minimal implementation**

- 引入 `capabilityState`
- 拉取能力并写入页面状态
- 参数区改为受控下拉（只读允许集合）
- builder 输入改为能力约束后的值

**Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai/front exec jest 'src/app/\[lng\]/ai-quant/AiQuantPageClient.capability-gating.test.tsx' --runInBand`
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx apps/front/src/components/ai-quant/QuantChatPanel.tsx apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.capability-gating.test.tsx
git commit -m "feat(front): gate backtest by capability config"
```

### Task 4: i18n 与错误映射

**Files:**
- Modify: `apps/front/public/locales/zh/common.json`
- Modify: `apps/front/public/locales/en/common.json`
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`

**Step 1: Write the failing test**

覆盖：
- `backtestCapabilityLoadFailed`
- `symbol_not_allowed`
- `timeframe_not_allowed`
文案 key 能在中英文环境解析。

**Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai/front exec jest 'src/app/\[lng\]/ai-quant/AiQuantPageClient.capability-gating.test.tsx' --runInBand`
Expected: FAIL

**Step 3: Write minimal implementation**

补 i18n key 与页面映射，不引入新状态分支。

**Step 4: Run test to verify it passes**

Run: 同上
Expected: PASS

**Step 5: Commit**

```bash
git add apps/front/public/locales/zh/common.json apps/front/public/locales/en/common.json apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx
git commit -m "feat(front): add i18n messages for backtest capability gating"
```

### Task 5: 全量验证与回归

**Files:**
- Modify (if needed): `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx`
- Modify (if needed): `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx`

**Step 1: Run targeted suites**

Run:
- `pnpm --filter @ai/front exec jest src/components/ai-quant/backtest-capability-client.test.ts --runInBand`
- `pnpm --filter @ai/front exec jest src/components/ai-quant/backtest-payload-builder.test.ts --runInBand`
- `pnpm --filter @ai/front exec jest 'src/app/\[lng\]/ai-quant/AiQuantPageClient.capability-gating.test.tsx' --runInBand`

Expected: PASS

**Step 2: Run ai-quant regression**

Run: `pnpm --filter @ai/front exec jest 'src/app/\[lng\]/ai-quant' --runInBand`
Expected: PASS

**Step 3: Lint changed files**

Run: `pnpm --filter @ai/front exec eslint 'src/app/[lng]/ai-quant/AiQuantPageClient.tsx' 'src/components/ai-quant/QuantChatPanel.tsx' 'src/components/ai-quant/backtest-capability-client.ts' 'src/components/ai-quant/backtest-payload-builder.ts' --config ../../eslint.config.js`
Expected: 0 error

**Step 4: Final commit**

```bash
git add apps/front/src apps/front/public/locales
git commit -m "feat(front): enforce backtest capability gating for symbol and timeframe"
```
