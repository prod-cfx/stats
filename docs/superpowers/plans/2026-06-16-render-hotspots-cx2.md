# Render Hotspots CX2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce React Doctor render hotspot findings in selected `apps/front` components without changing UI or business behavior.

**Architecture:** Keep the refactor local to existing front component domains. Move render-time JSX helpers into named module-scope components, move stable key construction into pure functions, and add focused tests for key behavior before production changes.

**Tech Stack:** Next.js 16, React 19, TypeScript, Jest front unit tests, `dx` verification.

---

## Files

- Modify: `apps/front/src/components/public-companies/PublicCompaniesTable.tsx`
- Create: `apps/front/src/components/public-companies/public-company-row-key.ts`
- Create: `apps/front/src/components/public-companies/public-company-row-key.test.ts`
- Modify: `apps/front/src/components/whale-tracking/profile/CompletedTradesTable.tsx`
- Create: `apps/front/src/components/whale-tracking/profile/completed-trade-key.ts`
- Create: `apps/front/src/components/whale-tracking/profile/completed-trade-key.test.ts`
- Modify: `apps/front/src/components/aggregated-orderbook/AggregatedOI.tsx`
- Modify: `apps/front/src/components/whale-tracking/holdings/WhalePositionsTable.tsx`
- Do not modify existing unrelated generated file: `packages/api-contracts/src/generated/backend.ts`

## Tasks

### Task 1: Stable public-company row keys

- [ ] Add failing test in `apps/front/src/components/public-companies/public-company-row-key.test.ts` proving key uses `ticker + exchange + asset` and does not depend on row index.
- [ ] Run `dx test unit front apps/front/src/components/public-companies/public-company-row-key.test.ts` and confirm expected failure due missing module.
- [ ] Create `public-company-row-key.ts` with `makePublicCompanyRowKey({ ticker, exchange, asset })`.
- [ ] Replace `key={index}` in `PublicCompaniesTable.tsx` with `key={makePublicCompanyRowKey(row)}` and remove `index` from map callback.
- [ ] Run focused test and confirm pass.

### Task 2: Stable completed-trade row keys

- [ ] Add failing test in `apps/front/src/components/whale-tracking/profile/completed-trade-key.test.ts` proving key uses `fillTime + asset + side + size + exitPrice + fee`, not row index.
- [ ] Run `dx test unit front apps/front/src/components/whale-tracking/profile/completed-trade-key.test.ts` and confirm expected failure due missing module.
- [ ] Create `completed-trade-key.ts` with exported `CompletedTradeKeyInput` and `makeCompletedTradeKey()`.
- [ ] Import helper in `CompletedTradesTable.tsx`, use it for mobile article and desktop row keys, and remove index-key array wrapping.
- [ ] Run focused test and confirm pass.

### Task 3: Module-scope render helpers for completed trades and holdings

- [ ] In `CompletedTradesTable.tsx`, convert `renderSideBadge` to `SideBadge` component and `renderSortIcon` to `SortIndicator` component.
- [ ] Keep translation in caller by passing `label` into `SideBadge` so component stays pure.
- [ ] In `WhalePositionsTable.tsx`, convert `renderSortIcon` to module-scope `SortIndicator` component.
- [ ] Run focused front tests touching whale tracking if present; otherwise rely on `dx test unit front`.

### Task 4: Module-scope render helpers for Aggregated OI

- [ ] In `AggregatedOI.tsx`, convert `renderSortIcon` to module-scope `SortIndicator` component.
- [ ] Convert `renderValueWithColor` to module-scope `SignedPercentCell` component.
- [ ] Convert `renderError` to module-scope `OpenInterestErrorState` component with explicit props `needsAuth`, `error`, `onRetry`, `retryLabel`.
- [ ] Keep existing class names and text output stable.

### Task 5: Verification and PR

- [ ] Run React Doctor scan from issue or best available local equivalent, record total for covered rules if CLI works.
- [ ] Run three verification lanes in parallel: `dx lint`, `dx build front --dev`, and `dx test unit front`.
- [ ] Fix any failures and rerun all three lanes until green.
- [ ] Commit with `Refs: #2511`.
- [ ] Push branch and create PR with `Closes: #2511`, stable key notes, verification evidence, and explanation that data-side/consumer-side PR split is not applicable because this is front-only refactor with no schema/writer/consumer data dependency.

## Track Gate

[复杂度评估]
命中维度：D1=N D2=N D3=N D4=N D5=N D6=Y D7=N D8=N（共 1 条）
硬升级触发：无
判定：Track B — 单 PR + 轻量计划
预估 PR 数：1

## Issue Gate

Issue `#2511` 已存在且包含背景、目标、方案、验收标准四段。验收标准可验证，允许进入 Track B plan critic。
