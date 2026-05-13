# AI Quant Strategy Detail User-Facing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the AI Quant strategy detail page so the first screen is user-facing while diagnostics remain available under advanced tabs.

**Architecture:** Keep the existing `AiQuantStrategyDetail` data flow and runtime actions intact. Refactor the large JSX render into local render blocks inside the same component first, then move debug-heavy sections behind explicit tab state. No backend, schema, API contract, or route changes are required.

**Tech Stack:** Next.js client component, React state, Tailwind utility classes, Jest + jsdom component tests, existing `dx` verification commands.

---

## Track

Track B — Single PR + lightweight plan.

Issue will be created after this plan per the `multi-pr-feature-delivery` Issue Gate.

## Files

- Modify: `apps/front/src/components/account/AiQuantStrategyDetail.tsx`
  - Owns the strategy detail UI, runtime actions, diagnostics tabs, right rail, mobile action bar, chart, latest trades, and current position/risk presentation.
- Modify: `apps/front/src/components/account/AiQuantStrategyDetail.test.tsx`
  - Existing component tests must be updated so user-facing fields are asserted on the first screen and diagnostics fields are asserted after selecting the Diagnostics tab.
- Modify: `apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.tsx`
  - Keep the route-level loading skeleton aligned with the final first-screen layout; no data flow changes.
- Modify: `apps/front/public/locales/zh/common.json`
  - Add concise tab labels when existing translated labels are too long for the advanced tab row.
- Modify: `apps/front/public/locales/en/common.json`
  - Add the matching concise tab labels for English builds.
- Do not modify: backend, API contracts, Prisma schema, admin-front, seed files.

## Task 1: Lock First-Screen Behavior In Tests

**Files:**
- Modify: `apps/front/src/components/account/AiQuantStrategyDetail.test.tsx`

- [ ] **Step 1: Add a helper for selecting advanced tabs**

Add this helper near `findButton`:

```tsx
async function selectTab(label: string) {
  await act(async () => {
    findButton(label)?.click()
  })
}
```

- [ ] **Step 2: Update the main truth/audit test to enforce user-first first screen**

In `shows truthful source, audit, rule summary, and OKX fee currency on detail page`, keep first-screen assertions for:

```tsx
expect(container.textContent).toContain('在 OKX 现货 DOGEUSD')
expect(container.textContent).toContain('OKX / DOGEUSDT / 1h')
expect(container.textContent).toContain('运行中 · 空仓 · 本轮已完成')
expect(container.textContent).toContain('本轮现货交易已完成，当前未持有 DOGEUSDT')
expect(container.textContent).toContain('总收益')
expect(container.textContent).toContain('今日盈亏')
expect(container.textContent).toContain('最大回撤')
expect(container.textContent).toContain('胜率')
expect(container.textContent).toContain('策略收益曲线')
expect(container.textContent).toContain('最新成交')
expect(container.textContent).toContain('手续费优先展示 OKX 原始 fee / feeCcy')
expect(container.textContent).toContain('0.09794982')
expect(container.textContent).toContain('51.73767288 DOGE')
expect(container.textContent).toContain('--（同步记录未含手续费）')
expect(container.textContent).toContain('当前持币')
expect(container.textContent).toContain('已完成买卖轮次')
```

Replace first-screen diagnostics assertions with negative checks:

```tsx
expect(container.textContent).not.toContain('当前状态解释')
expect(container.textContent).not.toContain('最近入场：2026-04-24 14:45 / 3507763615427895296')
expect(container.textContent).not.toContain('最近出场：2026-04-24 15:00 / sync-close-1777042803366')
expect(container.textContent).not.toContain('真实性审计')
expect(container.textContent).not.toContain('高级运行诊断')
expect(container.textContent).not.toContain('已执行 1 个运行诊断项，待执行/冷却/失败 0 个')
```

Then select the relevant tabs and assert the data is still reachable:

```tsx
await selectTab('诊断')
expect(container.textContent).toContain('真实性审计')
expect(container.textContent).toContain('3507763615427895296')
expect(container.textContent).toContain('出场订单证据')
expect(container.textContent).toContain('sync-close-1777042803366')
expect(container.textContent).toContain('高级运行诊断')
expect(container.textContent).toContain('已执行 1 个运行诊断项，待执行/冷却/失败 0 个')

await selectTab('规则')
expect(container.textContent).toContain('发布快照规则摘要')
expect(container.textContent).toContain('启动时执行：OPEN_LONG')
expect(container.textContent).toContain('价格变化 GTE 5%：CLOSE_LONG')
```

- [ ] **Step 3: Update timeline tests to use the Running Record tab**

In `keeps the runtime timeline compact by default and expands on demand`, assert the first screen does not show timeline content, then select the running record tab:

```tsx
expect(container.textContent).not.toContain('运行时间线')
await selectTab('运行记录')
expect(container.textContent).toContain('运行时间线')
expect(container.textContent).toContain('共 5 条，默认显示最近 3 条')
```

Keep the existing expand/collapse assertions after selecting the tab.

- [ ] **Step 4: Update runtime execution state tests to use the Diagnostics tab**

In `renders runtime execution states with user-visible status, reason, and attempt timestamps`, assert hidden first:

```tsx
expect(container.textContent).not.toContain('高级运行诊断')
expect(container.textContent).not.toContain('on_start.entry.primary')
await selectTab('诊断')
```

Keep the existing diagnostics assertions after selecting the tab.

Do the same in `renders binding and activation runtime failures with precise user-facing labels`:

```tsx
expect(container.textContent).not.toContain('部署绑定异常，请重新发布并重新部署')
await selectTab('诊断')
expect(container.textContent).toContain('部署绑定异常，请重新发布并重新部署')
```

- [ ] **Step 5: Run the focused test and verify it fails**

Run:

```bash
dx test unit front apps/front/src/components/account/AiQuantStrategyDetail.test.tsx
```

Expected: FAIL because the component still renders diagnostic sections into `textContent` before tab selection.

## Task 2: Refactor Advanced Tabs Into Real Content Boundaries

**Files:**
- Modify: `apps/front/src/components/account/AiQuantStrategyDetail.tsx`

- [ ] **Step 1: Extend the tab type**

Change:

```ts
type DetailInfoTab = 'rules' | 'diagnostics' | 'audit' | 'timeline'
```

To:

```ts
type DetailInfoTab = 'rules' | 'config' | 'backtest' | 'timeline' | 'diagnostics'
```

- [ ] **Step 2: Add concise tab labels**

Add these locale keys in Chinese:

```json
"aiQuant.detail.tabs.rules": "规则",
"aiQuant.detail.tabs.config": "配置",
"aiQuant.detail.tabs.backtest": "回测",
"aiQuant.detail.tabs.timeline": "运行记录",
"aiQuant.detail.tabs.diagnostics": "诊断"
```

Add the matching English labels:

```json
"aiQuant.detail.tabs.rules": "Rules",
"aiQuant.detail.tabs.config": "Config",
"aiQuant.detail.tabs.backtest": "Backtest",
"aiQuant.detail.tabs.timeline": "Running record",
"aiQuant.detail.tabs.diagnostics": "Diagnostics"
```

- [ ] **Step 3: Update the tab list**

Replace the tab list near the advanced tab buttons with:

```tsx
{([
  ['rules', t('aiQuant.detail.tabs.rules')],
  ['config', t('aiQuant.detail.tabs.config')],
  ['backtest', t('aiQuant.detail.tabs.backtest')],
  ['timeline', t('aiQuant.detail.tabs.timeline')],
  ['diagnostics', t('aiQuant.detail.tabs.diagnostics')],
] as Array<[DetailInfoTab, string]>).map(([tab, label]) => (
  <button
    key={tab}
    type="button"
    aria-pressed={activeInfoTab === tab}
    onClick={() => setActiveInfoTab(tab)}
    className={`h-10 rounded-xl border px-3 text-sm font-semibold transition ${activeInfoTab === tab ? activeInfoTabClass : idleInfoTabClass}`}
  >
    {label}
  </button>
))}
```

Render the Diagnostics tab button even if there are no runtime states. The tab can still show IDs, data boundary, or an empty diagnostics message.

- [ ] **Step 4: Move current status explanation out of the main first screen**

Delete the standalone `semanticSummary && <section>...当前状态解释...</section>` from the main content flow.

Keep the hero status explanation and the right-side next expected action. Reintroduce the service/position/cycle status cards inside Diagnostics after the truth audit rows.

- [ ] **Step 5: Move runtime execution diagnostics into the Diagnostics tab content**

Remove the separate hidden/visible runtime diagnostics section from the main content flow.

Inside the advanced tab content section, render diagnostics when `activeInfoTab === 'diagnostics'`:

```tsx
{activeInfoTab === 'diagnostics' && (
  <section className="grid gap-4">
    <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
      <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.detail.truthAudit')}</h2>
      {/* existing truth audit rows stay here */}
    </article>

    {strategy.runtimeExecutionStates && strategy.runtimeExecutionStates.length > 0 && (
      <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
        <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.detail.advancedRuntimeDiagnostics')}</h2>
        {/* existing runtime execution state list stays here */}
      </article>
    )}
  </section>
)}
```

Move the existing truth audit markup into the diagnostics tab. Move the existing runtime state list into the same tab after truth audit.

- [ ] **Step 6: Run the focused test**

Run:

```bash
dx test unit front apps/front/src/components/account/AiQuantStrategyDetail.test.tsx
```

Expected: FAIL until Tasks 3 and 4 finish, with no first-screen diagnostics visibility failures remaining.

## Task 3: Rebuild Main Content Around User Decision Flow

**Files:**
- Modify: `apps/front/src/components/account/AiQuantStrategyDetail.tsx`

- [ ] **Step 1: Keep first-screen order as metrics, equity, position/risk, latest trades**

Inside the left main column, use this exact order:

```tsx
<section className="grid gap-3 md:grid-cols-4">...</section>
{view-only and mobile runtime controls}
<StopRunningStrategyDialog ... />
{compatibility warning banners if urgent}
<section>equity curve</section>
<section>current position and risk</section>
<section>latest trades</section>
<section>advanced tab buttons</section>
<section>advanced tab content</section>
```

Keep compatibility warnings in the first screen only when they represent user action needed. Do not show raw metadata.

- [ ] **Step 2: Collapse duplicate account/position overview into one position/risk card**

Remove the hidden account overview article from the main content.

Keep one visible article for position/risk:

```tsx
<section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
  <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">
    {isSpotMarket ? t('aiQuant.detail.holdingOverview') : t('aiQuant.detail.positionOverview')}
  <p className="mt-1 text-xs text-[color:var(--cf-muted)]">{t('aiQuant.detail.positionOverviewSource')}</p>
  {/* current position/holding, closed count, realized PnL, unrealized PnL, open order count */}
</section>
```

Add open order count as a row:

```tsx
<p className="text-[color:var(--cf-muted)]">{t('aiQuant.detail.openOrders')}</p>
<p className="text-right text-[color:var(--cf-text-strong)]">
  {hasUnknownOpenOrders ? t('aiQuant.detail.unknown') : openOrdersCount}
</p>
```

Use the existing `aiQuant.detail.riskHint` line for open order count context. Do not add a new translation key for open-order count.

- [ ] **Step 3: Keep latest trades immediately after position/risk**

Keep the existing latest trades table and limit it to latest data already provided by `strategy.latestOrders`.

Do not add full trade-history export.

- [ ] **Step 4: Run focused tests**

Run:

```bash
dx test unit front apps/front/src/components/account/AiQuantStrategyDetail.test.tsx
```

Expected: Tests for first-screen data, latest orders, spot/contract labels, and runtime controls pass or fail only on intended label changes.

## Task 4: Move Config And Backtest Into Advanced Tabs

**Files:**
- Modify: `apps/front/src/components/account/AiQuantStrategyDetail.tsx`

- [ ] **Step 1: Remove the hidden backtest/execution section from the main flow**

Delete the section currently rendered as:

```tsx
{(strategy.snapshotBacktestConfigDefaults || strategy.deploymentExecutionBaseline || strategy.deploymentExecutionCurrent) && (
  <section className="hidden">
    ...
  </section>
)}
```

This content must be removed from the main structure after it is moved into the active tab renderer.

- [ ] **Step 2: Add Configuration tab content**

Render when `activeInfoTab === 'config'`:

```tsx
{activeInfoTab === 'config' && (
  <section className="grid gap-4 md:grid-cols-2">
    {/* parameter snapshot article */}
    {/* execution config article */}
  </section>
)}
```

Move the existing parameter snapshot article here.

Move deployment account and deployment time rows into the parameter/config article.

Move execution config rows here:

- Baseline execution leverage.
- Current execution leverage.
- Price source.
- Allowed leverage range.
- Deployment constraint explanation.
- Consistency drift reasons.

- [ ] **Step 3: Add Backtest tab content**

Render when `activeInfoTab === 'backtest'`:

```tsx
{activeInfoTab === 'backtest' && (
  <section className="grid gap-4 md:grid-cols-2">
    <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
      <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.detail.backtestBaseline')}</h2>
      {/* initial cash, backtest leverage for contract strategies, market type, price source */}
    </article>
    <article className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
      <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">{t('aiQuant.detail.backtestBaseline')}</h2>
      {/* returnPct, maxDrawdownPct, winRatePct, tradeCount */}
    </article>
  </section>
)}
```

Use existing translation keys for section headings and rows. Add only the five concise tab label keys listed in Task 2.

- [ ] **Step 4: Keep Rules tab focused**

Render when `activeInfoTab === 'rules'`:

```tsx
{activeInfoTab === 'rules' && (
  <section className="grid gap-4">
    {/* published snapshot rule summary */}
  </section>
)}
```

If there is no `strategy.ruleSummary`, show the existing legacy unsupported article only in this tab.

- [ ] **Step 5: Move timeline into Running Record tab**

Render timeline only when `activeInfoTab === 'timeline'`.

Keep compact-by-default behavior and the expand/collapse button.

- [ ] **Step 6: Run focused tests**

Run:

```bash
dx test unit front apps/front/src/components/account/AiQuantStrategyDetail.test.tsx
```

Expected: All component tests pass.

## Task 5: Tighten Right Rail And Mobile Behavior

**Files:**
- Modify: `apps/front/src/components/account/AiQuantStrategyDetail.tsx`
- Modify: `apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.tsx`

- [ ] **Step 1: Remove technical cards from the right rail**

In the desktop right rail execution config card, remove:

- Published snapshot card.
- Price source card.

Keep:

- Strategy service online/offline.
- Max drawdown or config consistency.
- READY / needs attention badge if present.

- [ ] **Step 2: Keep account risk and leverage in the right rail**

Keep:

- Total equity.
- Available balance.
- Current holdings/open positions.
- Today PnL.
- Current leverage visual range when relevant.

- [ ] **Step 3: Keep backtest summary compact**

Keep the compact right-rail backtest summary:

- Return percentage.
- Max drawdown.
- Win rate.
- Initial cash.
- Backtest leverage for contract strategies.

Do not duplicate full backtest configuration here.

- [ ] **Step 4: Confirm mobile fixed actions remain conditional**

Keep the existing bottom fixed action bar for running/stopped non-view-only strategies.

Ensure:

```tsx
!isViewOnly && (strategy.status === 'running' || strategy.status === 'stopped')
```

still gates the bottom bar.

- [ ] **Step 5: Run focused tests**

Run:

```bash
dx test unit front apps/front/src/components/account/AiQuantStrategyDetail.test.tsx
```

Expected: All component tests pass.

## Task 6: Final Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run component tests**

Run:

```bash
dx test unit front apps/front/src/components/account/AiQuantStrategyDetail.test.tsx
```

Expected: PASS, 25 tests or updated count all green.

- [ ] **Step 2: Run lint**

Run:

```bash
dx lint
```

Expected: PASS.

- [ ] **Step 3: Run front development build**

Run:

```bash
dx build front --dev
```

Expected: PASS.

- [ ] **Step 4: Verify local dev server**

Run:

```bash
curl -I --max-time 10 http://localhost:2001/zh/account/ai-quant/strategy/cmp2feeqc0drexcg5uh60xohe
```

Expected: `HTTP/1.1 200 OK`.

If port 2001 is not serving this worktree, restart it from `/Users/mac/.codex/worktrees/18e6/stats`:

```bash
pnpm exec dotenv --override -e .env.development -e .env.development.local -- pnpm --filter ./apps/front exec next dev -H 0.0.0.0 -p 2001
```

- [ ] **Step 5: Commit**

Stage only the plan and feature files:

```bash
git add docs/superpowers/plans/2026-05-13-ai-quant-strategy-detail-user-facing.md \
  apps/front/src/components/account/AiQuantStrategyDetail.tsx \
  apps/front/src/components/account/AiQuantStrategyDetail.test.tsx \
  apps/front/src/app/[lng]/account/ai-quant/strategy/[id]/StrategyDetailPageClient.tsx
```

Commit:

```bash
git commit -m "feat(front): refine strategy detail user view"
```

Final PR creation must not auto-merge into `main` because the user explicitly requested not to merge main.
