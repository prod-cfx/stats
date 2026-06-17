# React Doctor Lazy Heavy Dependencies Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the three React Doctor Bundle Size warnings in issue #2607 without changing visible AI Quant marketing, aggregated volume, or backtest equity chart behavior.

**Architecture:** Keep public component boundaries stable. Convert Framer Motion call sites from direct `motion` imports to `LazyMotion` + `m`, and move Recharts rendering into a lazily loaded body component so the wrapper file no longer statically imports `recharts`.

**Tech Stack:** Next.js 16, React 19, Framer Motion, Recharts, Jest, React Doctor, dx/Nx.

---

## Files

- Modify: `apps/front/src/components/ai-quant/AiQuantMarketingHome.tsx` — replace direct `motion` usage with `LazyMotion` + `m`, preserving `useReducedMotion` and transitions.
- Modify: `apps/front/src/components/aggregated-orderbook/AggregatedVolume.tsx` — wrap animated dropdown/tooltip nodes in `LazyMotion`, use `m.div`, preserve `AnimatePresence`.
- Modify: `apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestEquityChart.tsx` — keep wrapper props, empty state, theme observer, downsample/domain logic, and dynamically load Recharts body.
- Create: `apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestEquityChartRecharts.tsx` — host all `recharts` imports and chart SVG rendering.
- Create: `apps/front/src/components/perf-issue-2607.test.ts` — static regression tests for forbidden direct imports and dynamic Recharts boundary.
- Modify: `apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestEquityChart.test.tsx` — mock the lazy Recharts body instead of mocking `recharts` directly, retaining layout/downsample assertions.

## Tasks

### Task 1: Add RED import-boundary regression test

- [ ] Add `apps/front/src/components/perf-issue-2607.test.ts` that reads the three issue files and asserts:
  - `AiQuantMarketingHome.tsx` imports `LazyMotion`, `domAnimation`, `m`, `useReducedMotion`, and does not import `motion` from `framer-motion`.
  - `AggregatedVolume.tsx` imports `AnimatePresence`, `LazyMotion`, `domAnimation`, and `m`, and does not import `motion` from `framer-motion`.
  - `BacktestEquityChart.tsx` imports `next/dynamic`, does not import from `recharts`, and dynamically imports `./BacktestEquityChartRecharts`.
  - `BacktestEquityChartRecharts.tsx` is the only new chart body that imports from `recharts`.
- [ ] Run `dx test unit front apps/front/src/components/perf-issue-2607.test.ts`.
- [ ] Expected RED: test fails because current files still directly import `motion`/`recharts` and the body file does not exist.

### Task 2: Convert Framer Motion imports to LazyMotion

- [ ] In `AiQuantMarketingHome.tsx`, change import to `import { LazyMotion, domAnimation, m, useReducedMotion } from 'framer-motion'` plus `import type { Transition } from 'framer-motion'`.
- [ ] Wrap the page body under `ThemeAmbientBackground` with `<LazyMotion features={domAnimation}>...</LazyMotion>`.
- [ ] Replace every `<motion.div>`/`<motion.path>` with `<m.div>`/`<m.path>`.
- [ ] In `AggregatedVolume.tsx`, change import to `import { AnimatePresence, LazyMotion, domAnimation, m } from 'framer-motion'`.
- [ ] Wrap each conditional animated branch inside `AnimatePresence` with `<LazyMotion features={domAnimation}>` and replace `motion.div` with `m.div`.
- [ ] Run `dx test unit front apps/front/src/components/perf-issue-2607.test.ts`.

### Task 3: Split Recharts body behind dynamic import

- [ ] Move all `recharts` imports and chart JSX from `BacktestEquityChart.tsx` into `BacktestEquityChartRecharts.tsx`.
- [ ] Export `BacktestEquityChartRecharts` with props for `lng`, `chartData`, `minEquity`, `maxEquity`, `minDrawdown`, `themeTick`, and resolved theme colors.
- [ ] In `BacktestEquityChart.tsx`, import `dynamic` from `next/dynamic`, define `LazyBacktestEquityChartRecharts = dynamic(() => import('./BacktestEquityChartRecharts').then(mod => mod.BacktestEquityChartRecharts), { ssr: false })`, and render it inside the existing frame.
- [ ] Keep `BacktestEquityChart` props unchanged and keep empty state in the wrapper.
- [ ] Run `dx test unit front apps/front/src/components/perf-issue-2607.test.ts apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestEquityChart.test.tsx`.

### Task 4: Verify React Doctor and front gates

- [ ] Run in parallel:
  - `dx lint`
  - `dx build front --dev`
  - `dx test unit front apps/front/src/components/perf-issue-2607.test.ts apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestEquityChart.test.tsx`
- [ ] Run `react-doctor apps/front --full --offline --json --fail-on none` and confirm the three issue #2607 Bundle Size warnings are gone or any remaining Recharts warning has documented suppression evidence.
- [ ] If any command fails, fix the failure and rerun all three front gates in parallel.

## Verify

- `dx lint`
- `dx build front --dev`
- `dx test unit front apps/front/src/components/perf-issue-2607.test.ts apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestEquityChart.test.tsx`
- `react-doctor apps/front --full --offline --json --fail-on none`

## Commit

```bash
git add -A
git commit -F - <<'MSG'
perf: lazy load front heavy dependencies

变更说明：
- 将 React Doctor 标记的 Framer Motion 入口改为 LazyMotion + m，避免直接加载完整 motion 功能包
- 将回测权益图 Recharts 渲染体拆到动态加载组件，保留 wrapper props 与空数据状态
- 增加 issue #2607 的静态 import 边界回归测试

Refs: #2607
MSG
```
