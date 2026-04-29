# AI Quant Risk Semantic Contract Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make stop-loss/take-profit basis a normalized internal risk semantic default instead of a user-facing clarification slot, across the whole AI Quant semantic data flow.

**Architecture:** Add one shared risk normalization boundary and route every `SemanticRiskState` creation/merge/reduction path through it. Keep the current `triggers / actions / risk / position / contextSlots` model; keep legacy `riskRules.*Basis` projection as downstream compatibility output only.

**Tech Stack:** TypeScript, NestJS service layer, Jest/Vitest-style specs through `dx test unit quantify`, existing AI Quant semantic-state contracts.

---

## File Structure

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-normalization.ts`
  - Add the single source-of-truth risk normalization helpers.
  - Keep existing normalized-intent projection exports intact.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
  - Emit richer normalized risk params at extraction time.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts`
  - Normalize planner-created risk atoms before resolving status.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-merge.service.ts`
  - Normalize merged risk atoms so persisted stale `basis` slots cannot survive.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-reducer.service.ts`
  - Normalize risk after clarification answers, especially `risk.protective_exit`.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
  - Run normalization before required-slot derivation, clarification, inferred confirmation, and legacy snapshot projection.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts`
  - Keep legacy basis clarification suppressed for normalized semantic defaults.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`
  - Keep basis defaults visible as metadata, not blocking confirmation.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-semantic-contracts.ts`
  - Validate normalized basis/source fields without making them user-required.
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-normalization.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-merge.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-reducer.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-semantic-contracts.spec.ts`

## Task 1: Shared Risk Normalization Contract

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-normalization.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-normalization.spec.ts`

- [ ] **Step 1: Write failing normalization tests**

Create or extend `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-normalization.spec.ts` with these tests:

```ts
import type { SemanticRiskState } from '../../types/semantic-state'
import { normalizeRiskSemantics } from '../semantic-state-normalization'

describe('normalizeRiskSemantics', () => {
  it('defaults plain stop loss basis and removes basis open slots', () => {
    const risks: SemanticRiskState[] = [{
      id: 'risk-1',
      key: 'risk.stop_loss_pct',
      params: { valuePct: 5 },
      status: 'open',
      source: 'planner',
      openSlots: [{
        slotKey: 'risk.stopLossBasis',
        fieldPath: 'risk[0].params.stopLossBasis',
        questionHint: '请确认止损 5% 的计算基准',
        priority: 1,
        affectsExecution: true,
      }],
    }]

    expect(normalizeRiskSemantics(risks)).toEqual([expect.objectContaining({
      status: 'locked',
      params: expect.objectContaining({
        valuePct: 5,
        direction: 'loss',
        basis: 'entry_avg_price',
        basisSource: 'system_default',
        effect: 'close_position',
        scope: 'current_position',
      }),
      openSlots: [],
    })])
  })

  it('preserves user-explicit position pnl basis', () => {
    const risks: SemanticRiskState[] = [{
      id: 'risk-1',
      key: 'risk.take_profit_pct',
      params: { valuePct: 10, basis: 'position_pnl', basisSource: 'user_explicit' },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }]

    expect(normalizeRiskSemantics(risks)[0]).toEqual(expect.objectContaining({
      params: expect.objectContaining({
        direction: 'profit',
        basis: 'position_pnl',
        basisSource: 'user_explicit',
      }),
      openSlots: [],
    }))
  })

  it('keeps threshold open when valuePct is missing', () => {
    const risks: SemanticRiskState[] = [{
      id: 'risk-1',
      key: 'risk.stop_loss_pct',
      params: {},
      status: 'open',
      source: 'planner',
      openSlots: [],
    }]

    expect(normalizeRiskSemantics(risks)[0]).toEqual(expect.objectContaining({
      status: 'open',
      params: expect.objectContaining({
        direction: 'loss',
        basis: 'entry_avg_price',
        basisSource: 'system_default',
      }),
    }))
  })
})
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-normalization.spec.ts
```

Expected: FAIL because `normalizeRiskSemantics` is not exported yet.

- [ ] **Step 3: Add the shared normalization implementation**

In `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-normalization.ts`, merge `SemanticRiskState` into the existing type import at the top of the file:

```ts
import type { SemanticRiskState, SemanticSlotState, SemanticState, SemanticTriggerState } from '../types/semantic-state'
```

Then append this implementation below the existing helper functions:

```ts
const RISK_BASIS_OPEN_SLOT_PATTERN = /(?:^|\.)(?:basis|stopLossBasis|takeProfitBasis)$/u
const RISK_BASIS_SLOT_KEYS = new Set([
  'risk.stopLossBasis',
  'risk.takeProfitBasis',
  'risk.stop_loss_pct.basis',
  'risk.take_profit_pct.basis',
])

export function normalizeRiskSemantics(risks: SemanticRiskState[]): SemanticRiskState[] {
  return risks.map((risk, index) => normalizeRiskSemantic(risk, index))
}

export function normalizeRiskSemantic(risk: SemanticRiskState, index = 0): SemanticRiskState {
  const params = { ...risk.params }
  const isStopLoss = risk.key === 'risk.stop_loss_pct'
  const isTakeProfit = risk.key === 'risk.take_profit_pct'

  if (!isStopLoss && !isTakeProfit) {
    return {
      ...risk,
      params,
      openSlots: [...risk.openSlots],
    }
  }

  if (typeof params.direction !== 'string') {
    params.direction = isStopLoss ? 'loss' : 'profit'
  }

  if (typeof params.basis !== 'string') {
    params.basis = 'entry_avg_price'
  }

  if (params.basis === 'position_pnl' && params.basisSource == null) {
    params.basisSource = 'user_explicit'
  }

  if (params.basis === 'entry_avg_price' && params.basisSource == null) {
    params.basisSource = 'system_default'
  }

  if (typeof params.effect !== 'string') {
    params.effect = 'close_position'
  }

  if (typeof params.scope !== 'string') {
    params.scope = 'current_position'
  }

  const openSlots = risk.openSlots.filter(slot => !isRiskBasisOpenSlot(slot.slotKey, slot.fieldPath))
  const status = typeof params.valuePct === 'number' && Number.isFinite(params.valuePct) && params.valuePct > 0 && openSlots.length === 0
    ? 'locked'
    : risk.status

  return {
    ...risk,
    id: risk.id || `normalized-risk-${index + 1}`,
    params,
    status,
    openSlots,
  }
}

function isRiskBasisOpenSlot(slotKey: string, fieldPath: string): boolean {
  return RISK_BASIS_SLOT_KEYS.has(slotKey) || RISK_BASIS_OPEN_SLOT_PATTERN.test(fieldPath)
}
```

- [ ] **Step 4: Run the normalization test and verify it passes**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-normalization.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-normalization.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-normalization.spec.ts
git commit -m "fix: normalize ai quant risk defaults" -m "Refs: #945"
```

## Task 2: Normalize Seed Extraction and Planner Patch Ingestion

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts`

- [ ] **Step 1: Write failing extraction tests**

Add these expectations near the existing risk extraction tests:

```ts
it('extracts plain stop loss with default basis metadata', () => {
  const result = service.extract('亏损 5% 止损')

  expect(result.risk).toContainEqual(expect.objectContaining({
    key: 'risk.stop_loss_pct',
    params: expect.objectContaining({
      valuePct: 5,
      direction: 'loss',
      basis: 'entry_avg_price',
      basisSource: 'system_default',
      effect: 'close_position',
      scope: 'current_position',
    }),
  }))
})

it('extracts user-explicit position pnl basis metadata', () => {
  const result = service.extract('按持仓收益率盈利 10% 止盈')

  expect(result.risk).toContainEqual(expect.objectContaining({
    key: 'risk.take_profit_pct',
    params: expect.objectContaining({
      valuePct: 10,
      direction: 'profit',
      basis: 'position_pnl',
      basisSource: 'user_explicit',
    }),
  }))
})
```

Add this builder test:

```ts
it('normalizes planner basis open slot before resolving risk status', () => {
  const state = service.build({
    risk: [{
      key: 'risk.stop_loss_pct',
      params: { valuePct: 5 },
      openSlots: [{
        slotKey: 'risk.stopLossBasis',
        fieldPath: 'risk[0].params.stopLossBasis',
        questionHint: '请确认止损基准',
        priority: 1,
        affectsExecution: true,
      }],
    }],
  })

  expect(state.risk[0]).toEqual(expect.objectContaining({
    status: 'locked',
    params: expect.objectContaining({
      basis: 'entry_avg_price',
      basisSource: 'system_default',
    }),
    openSlots: [],
  }))
})
```

- [ ] **Step 2: Run targeted tests and verify they fail**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts
```

Expected: FAIL because extraction lacks `basisSource`/structured params and builder preserves the basis slot.

- [ ] **Step 3: Update seed extraction risk params**

In `semantic-seed-extractor.service.ts`, replace the stop-loss `params` object with:

```ts
params: {
  valuePct: stopLoss,
  direction: 'loss',
  basis: this.resolveRiskBasis(text),
  basisSource: this.resolveRiskBasis(text) === 'position_pnl' ? 'user_explicit' : 'system_default',
  effect: 'close_position',
  scope: 'current_position',
},
```

Replace the take-profit `params` object with:

```ts
params: {
  valuePct: takeProfit,
  direction: 'profit',
  basis: this.resolveRiskBasis(text),
  basisSource: this.resolveRiskBasis(text) === 'position_pnl' ? 'user_explicit' : 'system_default',
  effect: 'close_position',
  scope: 'current_position',
},
```

If repeated `this.resolveRiskBasis(text)` reads poorly, use a local const before each push:

```ts
const basis = this.resolveRiskBasis(text)
```

- [ ] **Step 4: Normalize builder risk states**

In `semantic-seed-state-builder.service.ts`, import the helper:

```ts
import { normalizeRiskSemantic } from './semantic-state-normalization'
```

In `toRiskState()`, replace the direct return with:

```ts
const risk: SemanticRiskState = {
  id: this.readTrimmedString(update.id) ?? `planner-risk-${index + 1}`,
  key,
  params: this.readParams(update.params),
  status: this.resolveNodeStatus(update.status, openSlots),
  source: this.readSource(update.source),
  ...(evidence ? { evidence } : {}),
  openSlots,
  ...(supersedes ? { supersedes } : {}),
}

return normalizeRiskSemantic(risk, index)
```

- [ ] **Step 5: Run targeted tests and verify they pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts
git commit -m "fix: normalize extracted risk semantics" -m "Refs: #945"
```

## Task 3: Normalize Merge and Reducer Paths

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-merge.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-reducer.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-merge.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-reducer.service.spec.ts`

- [ ] **Step 1: Write failing merge and reducer tests**

Add a merge test:

```ts
it('drops stale persisted risk basis slots after merge', () => {
  const result = service.merge({
    persisted: {
      families: [],
      triggers: [],
      actions: [],
      risk: [{
        id: 'risk-1',
        key: 'risk.stop_loss_pct',
        params: { valuePct: 5 },
        status: 'open',
        source: 'planner',
        openSlots: [{
          slotKey: 'risk.stopLossBasis',
          fieldPath: 'risk[0].params.stopLossBasis',
          questionHint: '请确认止损基准',
          priority: 1,
          affectsExecution: true,
        }],
      }],
      position: null,
      contextSlots: {},
      normalizationNotes: [],
      updatedAt: '2026-04-29T00:00:00.000Z',
    },
    derived: {
      families: [],
      triggers: [],
      actions: [],
      risk: [{
        id: 'risk-1',
        key: 'risk.stop_loss_pct',
        params: { valuePct: 5, basis: 'entry_avg_price', basisSource: 'system_default' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      position: null,
      contextSlots: {},
      normalizationNotes: [],
      updatedAt: '2026-04-29T00:00:00.000Z',
    },
  })

  expect(result.risk[0]).toEqual(expect.objectContaining({
    status: 'locked',
    openSlots: [],
    params: expect.objectContaining({ basis: 'entry_avg_price', basisSource: 'system_default' }),
  }))
})
```

Add a reducer test for the protective exit answer path:

```ts
it('normalizes protective exit answer into locked stop loss without basis slot', () => {
  const state = buildBaseSemanticState({
    risk: [{
      id: 'risk-protective',
      key: 'risk.protective_exit',
      params: {},
      status: 'open',
      source: 'planner',
      openSlots: [{
        slotKey: 'risk.protective_exit',
        fieldPath: 'risk[0].params.rule',
        questionHint: '请确认出场保护规则',
        priority: 1,
        affectsExecution: true,
      }],
    }],
  })

  const next = service.applyClarificationAnswer({
    state,
    slot: state.risk[0].openSlots[0],
    answer: '亏损 5% 止损',
  })

  expect(next.risk).toContainEqual(expect.objectContaining({
    key: 'risk.stop_loss_pct',
    status: 'locked',
    params: expect.objectContaining({
      valuePct: 5,
      basis: 'entry_avg_price',
      basisSource: 'system_default',
    }),
    openSlots: [],
  }))
})
```

- [ ] **Step 2: Run targeted tests and verify they fail**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-merge.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-reducer.service.spec.ts
```

Expected: FAIL on stale basis slot or missing `basisSource`.

- [ ] **Step 3: Normalize merged risk output**

In `semantic-state-merge.service.ts`, import:

```ts
import { normalizeRiskSemantics } from './semantic-state-normalization'
```

At the end of `mergeRisk()`, replace:

```ts
return next
```

with:

```ts
return normalizeRiskSemantics(next)
```

- [ ] **Step 4: Normalize reducer output**

In `semantic-state-reducer.service.ts`, import:

```ts
import { normalizeRiskSemantics } from './semantic-state-normalization'
```

Before each return of a modified state from `applyClarificationAnswer()`, wrap the risk array:

```ts
return {
  ...nextState,
  risk: normalizeRiskSemantics(nextState.risk),
}
```

For branches that already return object literals directly, apply the same pattern:

```ts
const nextState = {
  ...state,
  risk: nextRisk,
}

return {
  ...nextState,
  risk: normalizeRiskSemantics(nextState.risk),
}
```

- [ ] **Step 5: Run targeted tests and verify they pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-merge.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-reducer.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-merge.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-reducer.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-merge.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-reducer.service.spec.ts
git commit -m "fix: normalize risk state after merge and clarification" -m "Refs: #945"
```

## Task 4: Prevent Conversation Clarification and Inferred Confirmation Regression

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts`

- [ ] **Step 1: Write failing conversation regression tests**

Add a conversation-level regression:

```ts
it('does not ask for stop loss basis after plain stop loss is understood', async () => {
  const result = await service.handleConversationTurn({
    userMessage: '做多，亏损 5% 止损',
    conversationId: 'risk-default-basis-regression',
  } as never)

  expect(JSON.stringify(result.semanticState?.risk ?? [])).toContain('entry_avg_price')
  expect(result.assistantPrompt).not.toContain('entry_avg_price')
  expect(result.assistantPrompt).not.toContain('basis')
  expect(result.assistantPrompt).not.toContain('计算基准')
  expect(result.assistantPrompt).not.toContain('risk.stopLossBasis')
})
```

If this service test uses a different helper than `handleConversationTurn`, use the existing test helper in `codegen-conversation.service.spec.ts` that returns `assistantPrompt` and `semanticState`; keep the assertions exactly equivalent.

Add a clarification rules regression:

```ts
it('does not create legacy basis clarification when semantic risk basis is normalized', () => {
  const items = service.detect({
    riskRules: {
      stopLossPct: 5,
      stopLossBasis: 'entry_avg_price',
    },
  } as never)

  expect(items).not.toContainEqual(expect.objectContaining({
    field: 'riskRules.stopLossBasis',
  }))
})
```

Add a projection regression:

```ts
it('keeps inferred basis as metadata without creating open risk slots', () => {
  const projection = service.project({
    families: [],
    triggers: [],
    actions: [],
    risk: [{
      id: 'risk-1',
      key: 'risk.stop_loss_pct',
      params: { valuePct: 5, basis: 'entry_avg_price', basisSource: 'system_default' },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }],
    position: null,
    contextSlots: {},
    normalizationNotes: [],
    updatedAt: '2026-04-29T00:00:00.000Z',
  })

  expect(projection.inferredDefaults.inferredKeys).toContain('risk.stopLossBasis')
  expect(projection.openSlots).not.toContainEqual(expect.objectContaining({
    fieldPath: expect.stringMatching(/basis/u),
  }))
})
```

- [ ] **Step 2: Run targeted tests and verify they fail**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts
```

Expected: FAIL where conversation or projection still treats basis as pending user confirmation.

- [ ] **Step 3: Normalize conversation state before required-slot derivation**

In `codegen-conversation.service.ts`, import:

```ts
import { normalizeRiskSemantics } from './semantic-state-normalization'
```

Add this private helper near other semantic-state helpers:

```ts
private normalizeRiskState(state: SemanticState): SemanticState {
  return {
    ...state,
    risk: normalizeRiskSemantics(state.risk),
  }
}
```

In `withRequiredSemanticOpenSlots()`, normalize the input first:

```ts
const normalizedInput = this.normalizeRiskState(state)
const stateWithExplicitDeterministicRisk = this.withExplicitDeterministicStopLossRisk(
  normalizedInput,
  checklist,
)
```

Where the method currently uses `state` for downstream slot derivation, use `stateWithExplicitDeterministicRisk` or `normalizedInput` according to the existing flow.

- [ ] **Step 4: Normalize state after planner patch and recovery**

In `applyConversationPlanToSemanticState()` and `buildSemanticStateFromPlannerPatch()`, wrap the final semantic state:

```ts
return this.normalizeRiskState(nextState)
```

In `buildRecoveredRiskAtom()`, include default basis metadata:

```ts
params: {
  valuePct,
  direction: key === 'risk.stop_loss_pct' ? 'loss' : 'profit',
  basis: 'entry_avg_price',
  basisSource: 'system_default',
  effect: 'close_position',
  scope: 'current_position',
},
```

- [ ] **Step 5: Keep inferred basis non-blocking**

In the inferred-confirmation path, keep `_inferredAssumptions` and projection metadata, but filter `risk.stopLossBasis` and `risk.takeProfitBasis` out of required clarification prompts when the corresponding semantic risk has:

```ts
risk.params.basisSource === 'system_default'
&& risk.openSlots.length === 0
&& risk.status === 'locked'
```

Use this helper in `codegen-conversation.service.ts`:

```ts
private isNonBlockingRiskBasisDefault(state: SemanticState, key: 'risk.stopLossBasis' | 'risk.takeProfitBasis'): boolean {
  const riskKey = key === 'risk.stopLossBasis' ? 'risk.stop_loss_pct' : 'risk.take_profit_pct'
  return state.risk.some(risk =>
    risk.key === riskKey
    && risk.status === 'locked'
    && risk.openSlots.length === 0
    && risk.params.basisSource === 'system_default',
  )
}
```

Before building any user-facing inferred confirmation list, filter with:

```ts
const blockingInferredKeys = inferredKeys.filter(key =>
  key !== 'risk.stopLossBasis'
  && key !== 'risk.takeProfitBasis'
    ? true
    : !this.isNonBlockingRiskBasisDefault(semanticState, key),
)
```

- [ ] **Step 6: Keep legacy basis clarification suppressed**

In `strategy-clarification-rules.service.ts`, keep `detectBasisItems()` returning no basis item when `riskRules.stopLossBasis` or `riskRules.takeProfitBasis` is already a named basis. Add a guard before pushing each basis item:

```ts
if (this.hasNamedBasis(input.riskRules?.stopLossBasis)) {
  return items
}
```

Use the existing local item array and method structure; do not introduce a new legacy basis question source.

- [ ] **Step 7: Run targeted tests and verify they pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 4**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts
git commit -m "fix: suppress risk basis clarification prompts" -m "Refs: #945"
```

## Task 5: Preserve Contract and Projection Compatibility

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-semantic-contracts.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-semantic-contracts.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts`

- [ ] **Step 1: Write failing compatibility tests**

Add contract validation coverage:

```ts
it('accepts normalized stop loss risk params with default basis metadata', () => {
  expect(validateSemanticRiskContract({
    key: 'risk.stop_loss_pct',
    params: {
      valuePct: 5,
      direction: 'loss',
      basis: 'entry_avg_price',
      basisSource: 'system_default',
      effect: 'close_position',
      scope: 'current_position',
    },
  })).toEqual({ ok: true })
})
```

Add canonical projection coverage:

```ts
it('projects normalized semantic risk basis to legacy riskRules compatibility output', () => {
  const spec = service.buildFromSemanticState({
    families: [],
    triggers: [],
    actions: [],
    risk: [{
      id: 'risk-1',
      key: 'risk.stop_loss_pct',
      params: { valuePct: 5, basis: 'entry_avg_price', basisSource: 'system_default' },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }],
    position: null,
    contextSlots: {},
    normalizationNotes: [],
    updatedAt: '2026-04-29T00:00:00.000Z',
  })

  expect(JSON.stringify(spec)).toContain('entry_avg_price')
})
```

Add publication locked params coverage:

```ts
it('carries normalized locked stop loss basis into publication metadata', () => {
  const locked = service.collectLockedSemanticParams({
    families: [],
    triggers: [],
    actions: [],
    risk: [{
      id: 'risk-1',
      key: 'risk.stop_loss_pct',
      params: { valuePct: 5, basis: 'entry_avg_price', basisSource: 'system_default' },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }],
    position: null,
    contextSlots: {},
    normalizationNotes: [],
    updatedAt: '2026-04-29T00:00:00.000Z',
  } as never)

  expect(locked).toEqual(expect.objectContaining({
    stopLossPct: 5,
    stopLossBasis: 'entry_avg_price',
  }))
})
```

- [ ] **Step 2: Run targeted tests and verify they fail if compatibility is incomplete**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-semantic-contracts.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts
```

Expected: PASS for paths already compatible, FAIL for any path that rejects normalized metadata.

- [ ] **Step 3: Tighten risk contract validation without requiring basis from users**

In `strategy-semantic-contracts.ts`, after `valuePct` validation, add optional metadata validation:

```ts
if (
  risk.params.basis != null
  && risk.params.basis !== 'entry_avg_price'
  && risk.params.basis !== 'position_pnl'
) {
  return invalid('invalid_risk_basis')
}

if (
  risk.params.basisSource != null
  && risk.params.basisSource !== 'user_explicit'
  && risk.params.basisSource !== 'system_default'
  && risk.params.basisSource !== 'derived'
) {
  return invalid('invalid_risk_basis_source')
}
```

Do not fail when `basis` is absent; normalization fills it before clarification and projection.

- [ ] **Step 4: Normalize before canonical risk projection**

In `canonical-spec-builder.service.ts`, import:

```ts
import { normalizeRiskSemantics } from './semantic-state-normalization'
```

At the start of `buildRiskRulesFromSemanticState(risks, position)`, normalize:

```ts
const normalizedRisks = normalizeRiskSemantics(risks)
```

Then iterate `normalizedRisks` instead of `risks`.

- [ ] **Step 5: Normalize before publication locked param collection**

In `codegen-publication-generation.stage.ts`, import:

```ts
import { normalizeRiskSemantics } from './semantic-state-normalization'
```

In `collectLockedSemanticParams`, iterate:

```ts
for (const risk of normalizeRiskSemantics(state.risk)) {
  // existing locked param extraction
}
```

- [ ] **Step 6: Run targeted tests and verify they pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-semantic-contracts.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/strategy-semantic-contracts.ts apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-semantic-contracts.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts
git commit -m "fix: preserve normalized risk projection compatibility" -m "Refs: #945"
```

## Task 6: Full Regression Sweep

**Files:**
- Modify tests only if the sweep exposes stale expectations:
  - `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts`
  - `apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts`
  - `apps/front/src/components/ai-quant/display-logic-graph.test.ts`

- [ ] **Step 1: Add one semantic-only regression if missing**

Add a case that asserts plain stop loss does not leave a basis open slot:

```ts
it('keeps default stop loss basis out of semantic open slots', async () => {
  const result = await runSemanticOnlyCase('做多，亏损 5% 止损')

  expect(result.semanticState.risk).toContainEqual(expect.objectContaining({
    key: 'risk.stop_loss_pct',
    status: 'locked',
    params: expect.objectContaining({
      basis: 'entry_avg_price',
      basisSource: 'system_default',
    }),
    openSlots: [],
  }))
})
```

Use the existing runner/helper name in `semantic-only-strategy-regression.spec.ts`; keep the assertion shape unchanged.

- [ ] **Step 2: Run the focused unit suite**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-normalization.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-merge.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-reducer.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-semantic-contracts.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Run broader affected checks**

Run:

```bash
dx lint
dx build quantify --dev
dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit final regression adjustments**

If Step 1 or stale expectations changed tests, commit them:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts apps/front/src/components/ai-quant/display-logic-graph.test.ts
git commit -m "test: cover ai quant risk basis default flow" -m "Refs: #945"
```

If no files changed after the sweep, do not create an empty commit.

## Self-Review Checklist

- Spec coverage:
  - Four-atom architecture stays unchanged.
  - Risk normalization is a single source of truth.
  - Seed, planner builder, merge, reducer, conversation, clarification, inferred confirmation, canonical projection, publication, and regression tests are covered.
  - Legacy basis projection remains available.
  - `entry_avg_price` is not user-facing.
- Placeholder scan:
  - The plan contains no unresolved marker strings or unspecified broad repair steps.
- Type consistency:
  - Shared helpers use existing `SemanticRiskState`.
  - Basis values are `entry_avg_price` and `position_pnl`.
  - Basis source values are `user_explicit`, `system_default`, and `derived`.
  - User-facing slot suppression checks both `slotKey` and `fieldPath`.
