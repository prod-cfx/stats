# AI Quant Rules Tree Staging 31 Hard Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add hard gates and fixes so the 31 staging strategies use one rules tree source from real entry through UI, readiness, AST, and script/error output.

**Architecture:** Keep `SemanticState.rules` as the only semantic truth. Add diagnostics and tests first, then fix projection/support/readiness, completeness, clarification, rendering, and the staging 31 report around the same rules tree.

**Tech Stack:** NestJS, TypeScript, Jest, Prisma/PostgreSQL staging DB, existing `dx` commands.

---

## File Map

- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-registry.service.ts`
  - Remove the stale assumption that dotted lifecycle action atoms are registry-only unsupported.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-support-classifier.service.ts`
  - Ensure projected rules-tree actions are supported and produce actionable diagnostics if not.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`
  - Treat rules-tree / projection inconsistencies as `invalid_state`, not user-facing unsupported.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-rule-projection.service.ts`
  - Make action/risk/context projection failures observable and fail tests.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`
  - Render rules tree params without generic fallbacks when params exist.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-open-slot-answer-resolver.service.ts`
  - Bind short answers to pending clarification slots.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
  - Persist gate diagnostics and prevent empty-rules `CLEAR`.
- Create `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-tree-staging-hard-gates.spec.ts`
  - Unit/integration guard for all six gates.
- Create `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/staging31-report.contract.spec.ts`
  - Deterministic report shape test for the 31-case runner.
- Create `apps/quantify/src/modules/llm-strategy-codegen/scripts/staging31-hard-gate-report.ts`
  - Staging real-entry report runner.
- Create `apps/quantify/src/modules/llm-strategy-codegen/scripts/staging31-hard-gate-cases.ts`
  - The 31 case ids, input text, and expected terminal result categories.

## Task 1: Add Rules Tree Action Support Regression Tests

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-rule-projection.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-registry.action-atom-resolve.invariant.spec.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-tree-staging-hard-gates.spec.ts`

- [ ] **Step 1: Add projection assertion for dotted actions**

In `semantic-rule-projection.service.spec.ts`, replace the conditional action assertion in the `projects AND of 2 atoms` test with a hard assertion:

```ts
expect(out.action).toHaveLength(1)
expect(out.action[0]!.key).toBe('action.open_long')
expect(out.action[0]!.status).toBe('locked')
expect(out.action[0]!._provenance?.ruleId).toBe('r2')
```

- [ ] **Step 2: Add support classifier regression**

Create `rules-tree-staging-hard-gates.spec.ts` with:

```ts
import type { SemanticState } from '../../types/semantic-state'
import { SemanticRuleProjectionService } from '../semantic-rule-projection.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticOrchestrationRegistryService } from '../semantic-orchestration-registry.service'

function baseState(): SemanticState {
  return {
    version: 1,
    families: [],
    rules: [{
      id: 'r-action',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'bollinger.touch_lower', params: { period: 20, stdDev: 2 } },
      effects: [{ kind: 'atom', key: 'action.open_long', params: {} }],
    }],
    trigger: [],
    action: [],
    risk: [],
    position: null,
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-19T00:00:00.000Z',
  }
}

describe('rules tree staging hard gates', () => {
  it('projected action.open_long is supported by support classifier', () => {
    const projected = new SemanticRuleProjectionService().reprojectFromRules(baseState())
    expect(projected.action.map(a => a.key)).toEqual(['action.open_long'])

    const classified = new SemanticSupportClassifierService(
      new SemanticAtomRegistryService(),
      new SemanticOrchestrationRegistryService(),
    ).classify(projected)

    expect(classified.unknownAtoms).toEqual([])
    expect(classified.unsupportedAtoms).toEqual([])
    expect(classified.state.action[0]!.support).toBeUndefined()
  })
})
```

- [ ] **Step 3: Run tests and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-rule-projection.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-tree-staging-hard-gates.spec.ts
```

Expected: `rules tree staging hard gates` fails because `action.open_long` is `unsupported_unknown`.

- [ ] **Step 4: Commit failing tests**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-rule-projection.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-tree-staging-hard-gates.spec.ts
git commit -F - <<'MSG'
test(ai-quant): cover rules tree action support gate

Refs: #1491
MSG
```

## Task 2: Make Dotted Rules Tree Actions Supported

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-registry.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-registry.action-atom-resolve.invariant.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atoms-classifier-migration-equivalence.spec.ts`

- [ ] **Step 1: Update registry-only list**

In `semantic-atom-registry.service.ts`, change `REGISTRY_ONLY_KEYS` to remove dotted lifecycle actions:

```ts
const REGISTRY_ONLY_KEYS = new Set<string>([])
```

Update the comment above it:

```ts
// Dotted lifecycle actions are first-class rules-tree action atoms.
// They must resolve through ATOM_CONTRACT_REGISTRY so projection,
// support classification, readiness, and generation consume one key shape.
```

- [ ] **Step 2: Update invariant tests**

In `semantic-atom-registry.action-atom-resolve.invariant.spec.ts`, change expected behavior for:

```ts
const DOTTED_ACTION_KEYS = [
  'action.open_long',
  'action.close_long',
  'action.open_short',
  'action.close_short',
] as const
```

Expected assertion:

```ts
for (const key of DOTTED_ACTION_KEYS) {
  const atom = service.resolve(key)
  expect(atom.supportStatus).toBe('supported_executable')
}
```

Also assert `service.list().map(a => a.key)` contains all four dotted action keys.

- [ ] **Step 3: Update classifier migration equivalence**

In `atoms-classifier-migration-equivalence.spec.ts`, remove expectations that dotted action keys are `unsupported_unknown`. Replace with:

```ts
expect(service.resolve('action.open_long').supportStatus).toBe('supported_executable')
expect(service.resolve('action.close_long').supportStatus).toBe('supported_executable')
expect(service.resolve('action.open_short').supportStatus).toBe('supported_executable')
expect(service.resolve('action.close_short').supportStatus).toBe('supported_executable')
```

- [ ] **Step 4: Run targeted tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-registry.action-atom-resolve.invariant.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atoms-classifier-migration-equivalence.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-tree-staging-hard-gates.spec.ts
```

Expected: all targeted tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-registry.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-registry.action-atom-resolve.invariant.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atoms-classifier-migration-equivalence.spec.ts
git commit -F - <<'MSG'
fix(ai-quant): support dotted rules tree action atoms

Refs: #1491
MSG
```

## Task 3: Add Entry Diagnostics For Empty Rules

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-planner-schema.spec.ts`

- [ ] **Step 1: Add failing test for empty rules not clear**

In `codegen-conversation-planner-schema.spec.ts`, add a case where planner returns `semanticPatch: { rules: [] }`.

Expected assertions:

```ts
expect(response.clarificationState.status).not.toBe('CLEAR')
expect(JSON.stringify(response.validationReport ?? {})).toContain('rules_missing_or_empty')
```

- [ ] **Step 2: Persist reject diagnostics**

In `codegen-conversation.service.ts`, find `buildPlannerSchemaUnsupportedFallback`. Extend the returned plan with a diagnostics object:

```ts
diagnostics: {
  entry: {
    rejectReasons: [...reasons],
    gate: 'RulesTreeEntryGate',
  },
},
```

Extend the local `ConversationPlan` type with:

```ts
diagnostics?: Record<string, unknown>
```

- [ ] **Step 3: Carry diagnostics into session update/create**

Where unsupported fallback sessions are created, set `validationReport` to include:

```ts
{
  gate: 'RulesTreeEntryGate',
  entry: {
    rejectReasons,
    result: 'unsupported',
  },
}
```

Add the optional `validationReport` field to the repository create/update input mapping when the current method signature does not expose it.

- [ ] **Step 4: Run targeted tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-planner-schema.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-planner-schema.spec.ts
git commit -F - <<'MSG'
fix(ai-quant): persist rules tree entry diagnostics

Refs: #1491
MSG
```

## Task 4: Add Completeness Gate For Context, Sizing, And Risk Defaults

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-tree-staging-hard-gates.spec.ts`

- [ ] **Step 1: Add tests for explicit context and defaults**

Append tests to `rules-tree-staging-hard-gates.spec.ts`:

```ts
it('locks explicit context and default risk basis from rules-tree state', () => {
  const state = baseState()
  const next: SemanticState = {
    ...state,
    contextSlots: {
      exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', value: 'okx', status: 'locked', priority: 'context', questionHint: '请选择交易所', affectsExecution: true },
      symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'BTCUSDT', status: 'locked', priority: 'context', questionHint: '请选择交易标的', affectsExecution: true },
      marketType: { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'perp', status: 'locked', priority: 'context', questionHint: '请选择市场类型', affectsExecution: true },
      timeframe: { slotKey: 'timeframe', fieldPath: 'contextSlots.timeframe', value: '15m', status: 'locked', priority: 'context', questionHint: '请选择周期', affectsExecution: true },
    },
    rules: [{
      id: 'r-risk',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'indicator.above', params: { indicator: 'ema', reference: { period: 20 } } },
      effects: [
        { kind: 'atom', key: 'action.open_long', params: {} },
        { kind: 'atom', key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } },
      ],
    }],
  }
  const projected = new SemanticRuleProjectionService().reprojectFromRules(next)
  expect(projected.contextSlots.exchange?.value).toBe('okx')
  expect(projected.contextSlots.timeframe?.value).toBe('15m')
  expect(projected.risk[0]!.params.basis).toBe('entry_avg_price')
})
```

- [ ] **Step 2: Ensure default risk basis is applied before clarification**

In `semantic-seed-state-builder.service.ts`, locate risk atom conversion. When `key === 'risk.stop_loss_pct' || key === 'risk.take_profit_pct'` and `params.basis` is absent, set:

```ts
params.basis = 'entry_avg_price'
params.basisSource = 'system_default'
```

- [ ] **Step 3: Ensure missing executable context becomes clarification**

In `semantic-contract-readiness.service.ts`, when rules are non-empty and context slot is missing, keep decision as missing slot / clarification instead of unsupported. Add or update missing slot metadata:

```ts
{
  slotKey: 'contextSlots.exchange',
  fieldPath: 'contextSlots.exchange',
  status: 'open',
  priority: 'context',
  questionHint: '请选择交易所',
  affectsExecution: true,
}
```

Keep the current `contextSlots.exchange` slot shape and add the slot only when it is absent.

- [ ] **Step 4: Run tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-tree-staging-hard-gates.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-tree-staging-hard-gates.spec.ts
git commit -F - <<'MSG'
fix(ai-quant): enforce rules tree completeness gate

Refs: #1491
MSG
```

## Task 5: Fix Clarification Slot Merge

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-open-slot-answer-resolver.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-reducer.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-reducer.invariant.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-tree-staging-hard-gates.spec.ts`

- [ ] **Step 1: Add slot answer tests**

Append tests covering:

```ts
it('fills pending exchange slot from okx without clearing rules', () => {
  // Build state with rules and contextSlots.exchange open.
  // Apply reducer slot-fill answer "okx".
  // Assert rules length unchanged and exchange locked.
})

it('fills negative reverse-position answer without re-planning', () => {
  // Pending slot: action.reverse_position.confirmation.
  // Answer: "不需要".
  // Assert slot closed and existing action.close_long rule remains.
})
```

Use the reducer helper pattern already defined in `semantic-state-reducer.invariant.spec.ts`: construct a `SemanticState`, pass a slot-fill patch to the reducer, then assert the returned state.

- [ ] **Step 2: Resolve short answer against pending slot first**

In `semantic-open-slot-answer-resolver.service.ts`, add or update resolver branches:

```ts
if (slot.slotKey.includes('exchange') && /^okx$/i.test(answer.trim())) return { value: 'okx', status: 'locked' }
if (slot.slotKey.includes('timeframe') && /^(1m|3m|5m|15m|30m|1h|4h|1d)$/i.test(answer.trim())) return { value: answer.trim().toLowerCase(), status: 'locked' }
if (slot.slotKey.includes('reverse') && /不需要|不用|否|no/i.test(answer)) return { value: false, status: 'locked' }
if (slot.slotKey.includes('add_position') && /不加仓|不需要|不用|否|no/i.test(answer)) return { value: 'none', status: 'locked' }
```

Use the service's existing return type and helper methods rather than inventing a new shape.

- [ ] **Step 3: Preserve rules on slot fill**

In `semantic-state-reducer.service.ts`, ensure slot-fill updates call `updateRuleAtomParams` or context slot updates and then `reprojectFromRules`. Do not rebuild state from the answer text.

- [ ] **Step 4: Run tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-reducer.invariant.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-tree-staging-hard-gates.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-open-slot-answer-resolver.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-reducer.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-reducer.invariant.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-tree-staging-hard-gates.spec.ts
git commit -F - <<'MSG'
fix(ai-quant): preserve rules tree during clarification slot fill

Refs: #1491
MSG
```

## Task 6: Fix Rules Tree Rendering Fallbacks

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.rules-rendering.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts`

- [ ] **Step 1: Add rendering tests**

Add cases:

```ts
it('renders EMA20 above from nested reference period', () => {
  // rules condition: indicator.above params { indicator: 'ema', reference: { period: 20 }, timeframe: '15m' }
  // expect summary contains EMA20 and 15m, not 指标高于阈值
})

it('renders rolling channel breakout with high/low reference', () => {
  // price.breakout_up { period: 24, reference: 'channel_high' }
  // expect previous/rolling high text, not only 向上突破（24，0%）
})
```

- [ ] **Step 2: Fix nested reference reads**

In `semantic-state-projection.service.ts`, update indicator compare rendering to read:

```ts
const reference = this.readUnknownShape(trigger.params.reference)
const period = this.readFiniteNumber(reference?.period) ?? this.readFiniteNumber(trigger.params['reference.period'])
```

Then render:

```ts
const indicator = this.readString(trigger.params.indicator)?.toUpperCase()
return `${timeframeText}${indicator}${periodText}${relationText}`
```

Use the formatter helpers already in `semantic-state-projection.service.ts` such as `formatPercent`, `formatNumber`, `readString`, and `readFiniteNumber`.

- [ ] **Step 3: Fix breakout reference text**

When `price.breakout_up/down` has `reference=channel_high/channel_low`, render previous or rolling high/low wording with period/window when present.

- [ ] **Step 4: Run tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.rules-rendering.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.rules-rendering.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts
git commit -F - <<'MSG'
fix(ai-quant): render rules tree semantics without generic fallback

Refs: #1491
MSG
```

## Task 7: Add Staging 31 Hard Gate Report Runner

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/scripts/staging31-hard-gate-cases.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/scripts/staging31-hard-gate-report.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/staging31-report.contract.spec.ts`

- [ ] **Step 1: Add case manifest**

Create `staging31-hard-gate-cases.ts`:

```ts
export interface Staging31Case {
  index: number
  sessionId?: string
  input: string
  expected: 'pass' | 'needs_clarification' | 'unsupported'
}

export const STAGING31_CASES: Staging31Case[] = [
  {
    index: 1,
    sessionId: 'cmpc5u6xa0qpb0cqs8ehox5m2',
    input: '入场：15m k线里面 价格在ema20 ema60 ema144上方时做多开仓；出场：15m k线里面 价格低于ema20时平多；止损：5%；仓位：10usdt',
    expected: 'pass',
  },
  {
    index: 5,
    sessionId: 'cmpc6enhp1mi60cqsxhzufhj6',
    input: '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈',
    expected: 'pass',
  },
]
```

Populate the remaining 29 entries from the already-recorded staging notes before committing this task. The contract test in Step 3 must fail until `STAGING31_CASES` has length 31.

- [ ] **Step 2: Add report type and formatter**

Create `staging31-hard-gate-report.ts`:

```ts
import { STAGING31_CASES } from './staging31-hard-gate-cases'

export interface Staging31CaseReport {
  index: number
  input: string
  assistantResponse: string
  rulesTree: unknown
  projectedFlat: unknown
  contextPositionRisk: unknown
  clarification: unknown
  readiness: unknown
  uiSummaryOrGraph: unknown
  canonicalSpec: unknown
  ir: unknown
  ast: unknown
  scriptOrError: unknown
  result: 'pass' | 'needs_clarification' | 'unsupported' | 'fail'
  failures: string[]
}

export function assertStaging31ReportShape(report: Staging31CaseReport): void {
  const requiredKeys: Array<keyof Staging31CaseReport> = [
    'index',
    'input',
    'assistantResponse',
    'rulesTree',
    'projectedFlat',
    'contextPositionRisk',
    'clarification',
    'readiness',
    'uiSummaryOrGraph',
    'canonicalSpec',
    'ir',
    'ast',
    'scriptOrError',
    'result',
    'failures',
  ]
  for (const key of requiredKeys) {
    if (!(key in report)) {
      throw new Error(`staging31_report_missing_key:${String(key)}`)
    }
  }
}

export function listStaging31Cases(): typeof STAGING31_CASES {
  return STAGING31_CASES
}
```

- [ ] **Step 3: Add report contract test**

Create `staging31-report.contract.spec.ts`:

```ts
import { assertStaging31ReportShape, listStaging31Cases, type Staging31CaseReport } from '../../scripts/staging31-hard-gate-report'

describe('staging31 hard gate report contract', () => {
  it('contains all 31 cases', () => {
    expect(listStaging31Cases()).toHaveLength(31)
  })

  it('requires full pipeline fields', () => {
    const report: Staging31CaseReport = {
      index: 1,
      input: 'x',
      assistantResponse: 'x',
      rulesTree: {},
      projectedFlat: {},
      contextPositionRisk: {},
      clarification: {},
      readiness: {},
      uiSummaryOrGraph: {},
      canonicalSpec: {},
      ir: {},
      ast: {},
      scriptOrError: {},
      result: 'pass',
      failures: [],
    }
    expect(() => assertStaging31ReportShape(report)).not.toThrow()
  })
})
```

- [ ] **Step 4: Run contract test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/staging31-report.contract.spec.ts
```

Expected: pass after all 31 cases are listed.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/scripts/staging31-hard-gate-cases.ts apps/quantify/src/modules/llm-strategy-codegen/scripts/staging31-hard-gate-report.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/staging31-report.contract.spec.ts
git commit -F - <<'MSG'
test(ai-quant): add staging 31 hard gate report contract

Refs: #1491
MSG
```

## Task 8: Run Verification And Produce Staging Report

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/scripts/staging31-hard-gate-report.ts`
- Output report: `tmp/staging31-hard-gate-report.json`

- [ ] **Step 1: Run focused unit tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-tree-staging-hard-gates.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/staging31-report.contract.spec.ts
```

Expected: pass.

- [ ] **Step 2: Run codegen module tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__
```

Expected: pass.

- [ ] **Step 3: Build quantify**

Run:

```bash
dx build quantify --dev
```

Expected: exit 0.

- [ ] **Step 4: Run staging 31 report**

Run the staging-safe DB guard before any staging DB read. Then run:

```bash
node --loader ts-node/esm apps/quantify/src/modules/llm-strategy-codegen/scripts/staging31-hard-gate-report.ts --env staging --out tmp/staging31-hard-gate-report.json
```

Expected output file:

```text
tmp/staging31-hard-gate-report.json
```

Expected report invariants:

```text
31 cases total
0 empty rules with CLEAR status
0 supported action reported unsupported
0 clarification clears rules tree
0 UI/script mismatch
0 unsupported case with generated script
```

- [ ] **Step 5: Commit final test/report harness changes**

Do not commit `tmp/staging31-hard-gate-report.json` unless the team explicitly wants report artifacts tracked.

```bash
git status --short
git add apps/quantify/src/modules/llm-strategy-codegen/scripts/staging31-hard-gate-report.ts apps/quantify/src/modules/llm-strategy-codegen/scripts/staging31-hard-gate-cases.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/staging31-report.contract.spec.ts
git commit -F - <<'MSG'
test(ai-quant): verify staging 31 hard gate pipeline

Refs: #1491
MSG
```

## Final Verification

Run:

```bash
dx lint
dx build quantify --dev
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__
```

Expected:

```text
dx lint -> pass
dx build quantify --dev -> exit 0
codegen service unit tests -> pass
```

Then attach staging report summary to the PR:

```text
31 cases total
pass + needs_clarification + unsupported = 31
fail: 0
```
