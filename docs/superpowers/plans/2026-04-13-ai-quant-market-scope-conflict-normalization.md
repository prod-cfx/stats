# AI Quant Market Scope Conflict Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate false `conflicting_market_scope` blockers caused by whitespace and casing drift in `exchange`, `marketType`, `symbol`, and `timeframe`, while keeping the AI Quant main pipeline and persisted checklist shape unchanged.

**Architecture:** Add one narrow normalization helper inside `llm-strategy-codegen`, then reuse it in the two places that matter: conflict creation in `CodegenConversationService` and stale conflict filtering in `StrategyClarificationRulesService`. Keep `_marketScopeConflicts` as the same persisted shape and continue clearing by field after structured clarification answers.

**Tech Stack:** NestJS, TypeScript, Jest, pnpm workspace

---

## File Map

- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/market-scope-equivalence.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/market-scope-equivalence.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts`
- Verify: `apps/quantify/package.json`

## Implementation Notes

- Keep the normalization scope intentionally narrow:
  - `exchange`: `trim().toLowerCase()`
  - `marketType`: `trim().toLowerCase()`
  - `symbol`: `trim().toUpperCase()`
  - `timeframe`: `trim().toLowerCase()`
- Do not add natural-language timeframe parsing here. This helper is only for already-structured market-scope fields.
- Keep `_marketScopeConflicts` as `{ field, previous, next }`.
- Keep `clearMarketScopeConflicts()` unchanged; the fix is to stop creating false conflicts and to ignore stale equivalent conflicts when reading them back.

### Task 1: Add Narrow Market Scope Equivalence Helper

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/market-scope-equivalence.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/market-scope-equivalence.spec.ts`

- [ ] **Step 1: Write the failing helper test**

```ts
import {
  isEquivalentMarketScopeValue,
  normalizeMarketScopeValue,
} from '../market-scope-equivalence'

describe('marketScopeEquivalence', () => {
  it('normalizes narrow market-scope values for comparison', () => {
    expect(normalizeMarketScopeValue('exchange', ' OKX ')).toBe('okx')
    expect(normalizeMarketScopeValue('marketType', ' PERP ')).toBe('perp')
    expect(normalizeMarketScopeValue('symbol', ' btcusdt ')).toBe('BTCUSDT')
    expect(normalizeMarketScopeValue('timeframe', ' 15M ')).toBe('15m')
  })

  it('treats whitespace and casing drift as equivalent', () => {
    expect(isEquivalentMarketScopeValue('exchange', 'OKX', ' okx ')).toBe(true)
    expect(isEquivalentMarketScopeValue('marketType', 'PERP', 'perp')).toBe(true)
    expect(isEquivalentMarketScopeValue('symbol', 'BTCUSDT', ' btcusdt ')).toBe(true)
    expect(isEquivalentMarketScopeValue('timeframe', '15m', ' 15M ')).toBe(true)
  })

  it('does not collapse real market-scope changes', () => {
    expect(isEquivalentMarketScopeValue('exchange', 'okx', 'binance')).toBe(false)
    expect(isEquivalentMarketScopeValue('marketType', 'spot', 'perp')).toBe(false)
    expect(isEquivalentMarketScopeValue('symbol', 'BTCUSDT', 'ETHUSDT')).toBe(false)
    expect(isEquivalentMarketScopeValue('timeframe', '15m', '1h')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the helper test to verify it fails**

Run:

```bash
pnpm --dir apps/quantify test:unit -- --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/market-scope-equivalence.spec.ts
```

Expected: FAIL with `Cannot find module '../market-scope-equivalence'` or missing export errors.

- [ ] **Step 3: Write the minimal helper implementation**

```ts
export type MarketScopeField = 'exchange' | 'marketType' | 'symbol' | 'timeframe'

export function normalizeMarketScopeValue(
  field: MarketScopeField,
  value: string | null | undefined,
): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  if (!trimmed) return null

  if (field === 'symbol') return trimmed.toUpperCase()
  return trimmed.toLowerCase()
}

export function isEquivalentMarketScopeValue(
  field: MarketScopeField,
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalizedLeft = normalizeMarketScopeValue(field, left)
  const normalizedRight = normalizeMarketScopeValue(field, right)
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight)
}
```

- [ ] **Step 4: Run the helper test to verify it passes**

Run:

```bash
pnpm --dir apps/quantify test:unit -- --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/market-scope-equivalence.spec.ts
```

Expected: PASS with 3 passing tests.

- [ ] **Step 5: Commit the helper**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/market-scope-equivalence.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/market-scope-equivalence.spec.ts
git commit -m "Normalize AI Quant market-scope values before comparison"
```

### Task 2: Stop Creating False Market Scope Conflicts During Session Merge

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

- [ ] **Step 1: Add a failing merge-path regression test**

```ts
it('does not turn normalized market metadata into a blocking clarification item', async () => {
  mockRepo.findById.mockResolvedValue({
    id: 's-market-scope-normalized-no-conflict',
    userId: 'u1',
    status: 'DRAFTING',
    checklist: withRequiredMarketContext({
      entryRules: ['价格突破阻力位入场'],
      exitRules: ['跌破支撑位出场'],
      timeframes: ['15m'],
      riskRules: completeRiskRules({ exchange: 'okx' }),
    }),
    clarificationState: { status: 'CLEAR', items: [] },
    constraintPack: {},
  })
  mockAi.chat.mockResolvedValue({
    content: JSON.stringify({
      related: true,
      logicReady: true,
      assistantPrompt: '逻辑已整理完毕，请确认逻辑图。',
      logic: {
        timeframes: [' 15M '],
        riskRules: {
          exchange: ' OKX ',
          marketType: 'PERP',
        },
        symbols: ['btcusdt'],
      },
    }),
  })

  const result = await service.continueSession('s-market-scope-normalized-no-conflict', {
    userId: 'u1',
    message: '维持 OKX BTCUSDT 15m',
  })

  expect(result.clarificationState?.items ?? []).not.toEqual(expect.arrayContaining([
    expect.objectContaining({
      reason: 'conflicting_market_scope',
    }),
  ]))
})
```

- [ ] **Step 2: Run the merge-path regression test to verify it fails**

Run:

```bash
pnpm --dir apps/quantify test:unit -- --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts --testNamePattern "does not turn normalized market metadata into a blocking clarification item"
```

Expected: FAIL because `collectMarketScopeConflicts()` still treats the normalized-equal values as different and emits `conflicting_market_scope`.

- [ ] **Step 3: Update merge conflict detection to use the helper**

```ts
import { isEquivalentMarketScopeValue } from './market-scope-equivalence'

private collectMarketScopeConflicts(base: ChecklistPayload, patch: ChecklistPayload): Array<{
  field: 'exchange' | 'marketType' | 'symbol' | 'timeframe'
  previous: string
  next: string
}> {
  const conflicts: Array<{
    field: 'exchange' | 'marketType' | 'symbol' | 'timeframe'
    previous: string
    next: string
  }> = []

  const pushConflict = (
    field: 'exchange' | 'marketType' | 'symbol' | 'timeframe',
    previous: string | undefined,
    next: string | undefined,
  ) => {
    if (!previous || !next) return
    if (isEquivalentMarketScopeValue(field, previous, next)) return

    conflicts.push({
      field,
      previous: previous.trim(),
      next: next.trim(),
    })
  }

  pushConflict('symbol', base.symbols?.[0], patch.symbols?.[0])
  pushConflict('timeframe', base.timeframes?.[0], patch.timeframes?.[0])
  pushConflict(
    'exchange',
    typeof base.riskRules?.exchange === 'string' ? base.riskRules.exchange : undefined,
    typeof patch.riskRules?.exchange === 'string' ? patch.riskRules.exchange : undefined,
  )
  pushConflict(
    'marketType',
    typeof base.riskRules?.marketType === 'string' ? base.riskRules.marketType : undefined,
    typeof patch.riskRules?.marketType === 'string' ? patch.riskRules.marketType : undefined,
  )

  return conflicts
}
```

- [ ] **Step 4: Re-run the targeted conversation tests**

Run:

```bash
pnpm --dir apps/quantify test:unit -- --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts --testNamePattern "market metadata"
```

Expected: PASS for both the existing real-drift test and the new normalized-equal regression test.

- [ ] **Step 5: Commit the merge-path fix**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -m "Ignore normalized-equal AI Quant market-scope drift"
```

### Task 3: Ignore Stale Equivalent Conflicts When Building Clarification Blockers

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts`

- [ ] **Step 1: Add a failing stale-conflict regression test**

```ts
it('ignores stale market scope conflicts whose values normalize to the same meaning', () => {
  const state = service.detect({
    symbols: ['BTCUSDT'],
    timeframes: ['15m'],
    entryRules: ['跌破布林带下轨时做多'],
    exitRules: ['上涨 0.5% 止盈'],
    riskRules: {
      exchange: 'okx',
      marketType: 'perp',
      positionPct: 10,
      stopLoss: '亏损 5% 止损',
      takeProfit: '盈利 10% 止盈',
      _marketScopeConflicts: [
        {
          field: 'timeframe',
          previous: '15m',
          next: ' 15M ',
        },
        {
          field: 'exchange',
          previous: 'OKX',
          next: ' okx ',
        },
      ],
    },
  })

  expect(state.items).not.toEqual(expect.arrayContaining([
    expect.objectContaining({
      reason: 'conflicting_market_scope',
    }),
  ]))
})
```

- [ ] **Step 2: Run the stale-conflict regression test to verify it fails**

Run:

```bash
pnpm --dir apps/quantify test:unit -- --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts --testNamePattern "ignores stale market scope conflicts whose values normalize to the same meaning"
```

Expected: FAIL because `readMarketScopeConflicts()` still returns the stale entries after only trimming them.

- [ ] **Step 3: Filter `_marketScopeConflicts` through the same helper**

```ts
import { isEquivalentMarketScopeValue } from './market-scope-equivalence'

private readMarketScopeConflicts(
  riskRules: Record<string, unknown> | undefined,
): MarketScopeConflict[] {
  const raw = riskRules?._marketScopeConflicts
  if (!Array.isArray(raw)) return []

  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []

    const field = (item as { field?: unknown }).field
    const previous = (item as { previous?: unknown }).previous
    const next = (item as { next?: unknown }).next

    if (
      (field !== 'exchange' && field !== 'marketType' && field !== 'symbol' && field !== 'timeframe')
      || typeof previous !== 'string'
      || typeof next !== 'string'
      || !previous.trim()
      || !next.trim()
    ) {
      return []
    }

    if (isEquivalentMarketScopeValue(field, previous, next)) {
      return []
    }

    return [{
      field,
      previous: previous.trim(),
      next: next.trim(),
    }]
  })
}
```

- [ ] **Step 4: Re-run the clarification rules tests**

Run:

```bash
pnpm --dir apps/quantify test:unit -- --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts
```

Expected: PASS for the existing real-conflict test and the new stale-equivalent regression test.

- [ ] **Step 5: Commit the stale-conflict filter**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts
git commit -m "Drop stale equivalent AI Quant market-scope conflicts"
```

### Task 4: Run Final Verification Across the Narrow Fix Surface

**Files:**
- Verify only: `apps/quantify/src/modules/llm-strategy-codegen/services/market-scope-equivalence.ts`
- Verify only: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Verify only: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts`
- Verify only: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/market-scope-equivalence.spec.ts`
- Verify only: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- Verify only: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts`

- [ ] **Step 1: Run the focused unit suite**

Run:

```bash
pnpm --dir apps/quantify test:unit -- --runTestsByPath \
  src/modules/llm-strategy-codegen/services/__tests__/market-scope-equivalence.spec.ts \
  src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts \
  src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts
```

Expected: PASS with no failing specs in the three targeted files.

- [ ] **Step 2: Run lint for the quantify app**

Run:

```bash
pnpm --dir apps/quantify lint
```

Expected: PASS with no new lint errors in `llm-strategy-codegen`.

- [ ] **Step 3: Run TypeScript build verification**

Run:

```bash
pnpm --dir apps/quantify build
```

Expected: PASS with no TypeScript or alias-generation errors.

- [ ] **Step 4: Inspect the final diff before shipping**

Run:

```bash
git diff --stat HEAD~3..HEAD
git diff -- apps/quantify/src/modules/llm-strategy-codegen/services/market-scope-equivalence.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts
```

Expected: The diff only touches the helper, the two services, and their tests; no main-pipeline stages or persisted schema files change.

- [ ] **Step 5: Commit the verification checkpoint**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/market-scope-equivalence.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/market-scope-equivalence.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts
git commit -m "Verify narrow AI Quant market-scope conflict normalization fix"
```

## Spec Coverage Check

- False conflict creation for `exchange / marketType / symbol / timeframe`: covered by Task 1 and Task 2.
- Weak stale-conflict cleanup without state redesign: covered by Task 3.
- Keep `_marketScopeConflicts` shape unchanged and avoid main pipeline changes: enforced in File Map, Implementation Notes, and Task 4 diff inspection.
- Preserve real conflicts such as `okx -> binance` and `15m -> 1h`: covered by Task 1 assertions plus the existing real-conflict regression tests re-run in Task 2 and Task 3.

## Self-Review

- Placeholder scan complete: no `TODO`, `TBD`, or “implement later” steps remain.
- Type consistency check complete: `normalizeMarketScopeValue()` and `isEquivalentMarketScopeValue()` are the only helper names used across tasks.
- Scope check complete: this plan stays inside one subsystem, `llm-strategy-codegen`, and does not require a second plan.
