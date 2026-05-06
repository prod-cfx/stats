# AI Quant Atom-Native Normalization and Slot Fulfillment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI Quant natural-language strategy input and follow-up slot answers reliably flow into the existing `triggers / actions / risk / position / contextSlots` main data path.

**Architecture:** Keep `CodegenSemanticPatch` and `SemanticState` as the only semantic truth. Add atom-native parsing helpers that return existing patch nodes, extend open-slot answer handling to consume semantic fragments, reconcile derived missing placeholders after real atoms arrive, align support status with projection capability, and preserve per-trigger timeframes through canonical/IR/AST.

**Tech Stack:** TypeScript, NestJS services, Jest/Vitest-style unit specs under `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__`, existing `dx` commands.

---

## File Structure

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
  - Responsibility: convert raw user text directly into `CodegenSemanticPatch` atoms. Extend timeframe normalization, moving-average static relation extraction, and multi-timeframe trigger emission.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-open-slot-answer-resolver.service.ts`
  - Responsibility: keep existing grid density answer support and add semantic fragment fulfillment for open entry/exit/risk/position/context slots.
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-missing-placeholder-reconciler.service.ts`
  - Responsibility: remove or supersede derived `semantic.missing_entry_atom` and `semantic.missing_exit_atom` when real trigger atoms satisfy the same phase.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
  - Responsibility: call semantic fragment fulfillment before support/readiness for existing sessions, then run missing placeholder reconciliation before clarification artifacts are computed.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-support-classifier.service.ts`
  - Responsibility: ensure executable MA/EMA `indicator.above` and `indicator.below` with reference periods and per-trigger timeframes route to `projection_gate`.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-registry.service.ts`
  - Responsibility: remove stale unsupported classification for projection-supported `indicator.above/below` moving-average aliases or make the registry definition compatible with the classifier override.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
  - Responsibility: preserve `trigger.params.timeframe` in canonical rules and include all per-trigger timeframes in the market timeframe set.
- Modify during Task 5 when the focused timeframe tests fail: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts`, `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-strategy-ir-validator.service.ts`, `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service.ts`
  - Responsibility: carry explicit multi-timeframe predicates through IR validation and AST generation without treating declared multi-timeframe rules as drift.
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-open-slot-answer-resolver.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-missing-placeholder-reconciler.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-support-classifier.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

## Task 1: Lock Atom-Native Seed Extraction Regressions

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`

- [ ] **Step 1: Add failing tests for multi-timeframe EMA state wording**

Add these tests near the existing EMA price-vs-reference tests:

```ts
  it('extracts multi-timeframe EMA state wording into entry trigger atoms', () => {
    const patch = service.extract('15min 1h 4h 价格都在 ema20 的上方 买入')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.above',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({
          indicator: 'ema',
          'reference.period': 20,
          timeframe: '15m',
        }),
      }),
      expect.objectContaining({
        key: 'indicator.above',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({
          indicator: 'ema',
          'reference.period': 20,
          timeframe: '1h',
        }),
      }),
      expect.objectContaining({
        key: 'indicator.above',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({
          indicator: 'ema',
          'reference.period': 20,
          timeframe: '4h',
        }),
      }),
    ]))
    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
    ]))
    expect(patch.contextSlots?.timeframe).toBeUndefined()
  })

  it('extracts follow-up EMA state wording into a complete entry fragment', () => {
    const patch = service.extract('15min k线在 ema20 上方开多')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.above',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({
          indicator: 'ema',
          'reference.period': 20,
          timeframe: '15m',
        }),
      }),
    ]))
    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
    ]))
  })
```

- [ ] **Step 2: Run the focused extractor tests and verify they fail**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts -t "multi-timeframe EMA state wording|follow-up EMA state wording"
```

Expected: FAIL because `15min` is not normalized, `在 ema20 上方` does not emit `indicator.above`, or only one timeframe is emitted.

- [ ] **Step 3: Extend timeframe normalization**

In `SemanticSeedExtractorService.extractFirstTimeframe`, replace the compact match with logic that accepts `min`, `mins`, `minute`, and `minutes`:

```ts
    const compactMatch = text.match(/\b(\d{1,2})\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)\b/iu)
    if (compactMatch?.[1] && compactMatch[2]) {
      const unit = compactMatch[2].toLowerCase()
      const normalizedUnit = unit.startsWith('m')
        ? 'm'
        : unit.startsWith('h')
          ? 'h'
          : 'd'
      return `${compactMatch[1]}${normalizedUnit}`
    }
```

Add a private helper below `extractFirstTimeframe` to collect all timeframe mentions for trigger-level scope:

```ts
  private extractAllTimeframes(text: string): string[] {
    const values: string[] = []
    const seen = new Set<string>()
    const push = (value: string) => {
      if (seen.has(value)) return
      seen.add(value)
      values.push(value)
    }

    for (const match of text.matchAll(/\b(\d{1,2})\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days)\b/giu)) {
      if (!match[1] || !match[2]) continue
      const unit = match[2].toLowerCase()
      const normalizedUnit = unit.startsWith('m')
        ? 'm'
        : unit.startsWith('h')
          ? 'h'
          : 'd'
      push(`${match[1]}${normalizedUnit}`)
    }

    for (const match of text.matchAll(/(\d{1,2})\s*(分钟|分|小时|时|天|日)/gu)) {
      if (!match[1] || !match[2]) continue
      if (this.isIndicatorPeriodTimeframeCandidate(text, match.index ?? -1, match[0].length)) continue
      const unit = match[2]
      push(`${match[1]}${unit === '分钟' || unit === '分' ? 'm' : unit === '小时' || unit === '时' ? 'h' : 'd'}`)
    }

    return values
  }
```

- [ ] **Step 4: Extend moving-average state trigger extraction**

In `pushMovingAverageTrigger`, compute trigger-level timeframes and include static state words:

```ts
        const key = /突破|上穿|站上|高于|上方/u.test(subClause)
          ? 'indicator.above'
          : (/跌破|下穿|失守|低于|下方/u.test(subClause) ? 'indicator.below' : null)
```

Before pushing triggers, add:

```ts
        const scopedTimeframes = this.extractAllTimeframes(subClause)
        const timeframes = scopedTimeframes.length > 0
          ? scopedTimeframes
          : this.extractAllTimeframes(clause)
```

Replace the single `this.pushTrigger(...)` call for MA/EMA reference periods with:

```ts
          const params = {
            indicator,
            referenceRole: referencePeriod >= 20 ? 'long_term' : 'short_term',
            'reference.period': referencePeriod,
            ...(confirmationMode ? { confirmationMode } : {}),
          }
          const targetTimeframes = timeframes.length > 1 || /都|同时|并且|且/u.test(clause)
            ? timeframes
            : []

          if (targetTimeframes.length > 0) {
            for (const timeframe of targetTimeframes) {
              this.pushTrigger(triggers, seen, {
                key,
                phase: intent.phase,
                sideScope: intent.sideScope,
                params: { ...params, timeframe },
              })
            }
          } else {
            this.pushTrigger(triggers, seen, {
              key,
              phase: intent.phase,
              sideScope: intent.sideScope,
              params,
            })
          }
```

- [ ] **Step 5: Run focused extractor tests and verify they pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts -t "multi-timeframe EMA state wording|follow-up EMA state wording"
```

Expected: PASS.

- [ ] **Step 6: Commit Task 1**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
git commit -F - <<'MSG'
fix: normalize atom-native multi-timeframe EMA triggers

变更说明：
- 支持 min/mins 等周期表达归一
- 将 EMA 静态上方/下方表达直接落到 indicator.above/below triggers
- 支持同一谓词下多个 trigger-level timeframe

Refs: #960
MSG
```

## Task 2: Add Open Semantic Slot Fragment Fulfillment

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-open-slot-answer-resolver.service.ts`
- Create or modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-open-slot-answer-resolver.service.spec.ts`

- [ ] **Step 1: Write failing resolver tests for entry fragments**

Create the spec file if it does not exist. Add:

```ts
import type { SemanticState } from '../../types/semantic-state'
import { SemanticOpenSlotAnswerResolverService } from '../semantic-open-slot-answer-resolver.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'

function stateWithMissingEntry(): SemanticState {
  return {
    version: 1,
    families: [],
    triggers: [{
      id: 'semantic-missing-entry-atom',
      key: 'semantic.missing_entry_atom',
      phase: 'entry',
      params: {},
      status: 'open',
      source: 'derived',
      openSlots: [{
        slotKey: 'trigger.entry',
        fieldPath: 'triggers[entry]',
        status: 'open',
        priority: 'core',
        questionHint: '请补充入场触发条件。',
        affectsExecution: true,
      }],
    }],
    actions: [],
    risk: [],
    position: {
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
      sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    },
    contextSlots: {
      exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', value: 'okx', status: 'locked', priority: 'context', questionHint: '请选择交易所。', affectsExecution: true },
      symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'BTCUSDT', status: 'locked', priority: 'context', questionHint: '请选择标的。', affectsExecution: true },
      marketType: { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'perp', status: 'locked', priority: 'context', questionHint: '请选择市场类型。', affectsExecution: true },
      timeframe: null,
    },
    normalizationNotes: [],
    updatedAt: '2026-05-05T00:00:00.000Z',
  }
}

describe('SemanticOpenSlotAnswerResolverService semantic fragments', () => {
  const service = new SemanticOpenSlotAnswerResolverService(undefined, new SemanticSeedExtractorService())

  it('consumes a complete entry trigger fragment for a missing entry slot', () => {
    const result = service.resolve({
      currentState: stateWithMissingEntry(),
      message: '15min k线在 ema20 上方开多',
    })

    expect(result.consumed).toBe(true)
    if (!result.consumed) return

    expect(result.nextState.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.above',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({
          indicator: 'ema',
          'reference.period': 20,
          timeframe: '15m',
        }),
      }),
    ]))
    expect(result.nextState.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
    ]))
    expect(result.nextState.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'semantic.missing_entry_atom', status: 'open' }),
    ]))
    expect(result.closedSlotKeys).toContain('trigger.entry')
  })
})
```

- [ ] **Step 2: Run resolver test and verify it fails**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-open-slot-answer-resolver.service.spec.ts -t "complete entry trigger fragment"
```

Expected: FAIL because the resolver only handles level-set density answers.

- [ ] **Step 3: Inject the seed extractor into the resolver**

In `semantic-open-slot-answer-resolver.service.ts`, import the extractor and extend the constructor:

```ts
import { SemanticSeedExtractorService } from './semantic-seed-extractor.service'
```

```ts
  constructor(
    private readonly shapeNormalizer: SemanticContractShapeNormalizerService = new SemanticContractShapeNormalizerService(),
    private readonly seedExtractor: SemanticSeedExtractorService = new SemanticSeedExtractorService(),
  ) {}
```

- [ ] **Step 4: Try semantic fragment fulfillment after density answers**

In `resolve`, after the existing density-answer block returns `consumed: false`, add:

```ts
    const fragmentPatch = this.seedExtractor.extract(input.message)
    const fragmentResult = fulfillSemanticFragment(input.currentState, fragmentPatch)
    if (fragmentResult.consumed) {
      return fragmentResult
    }
```

Then add helper functions near the bottom of the file:

```ts
function fulfillSemanticFragment(
  state: SemanticState,
  patch: ReturnType<SemanticSeedExtractorService['extract']>,
): SemanticOpenSlotAnswerResolverResult {
  const hasEntrySlot = hasOpenSlot(state, 'trigger.entry')
  const hasExitSlot = hasOpenSlot(state, 'trigger.exit')
  const patchTriggers = patch.triggers ?? []
  const patchActions = patch.actions ?? []
  const entryTriggers = patchTriggers.filter(trigger => trigger.phase === 'entry')
  const exitTriggers = patchTriggers.filter(trigger => trigger.phase === 'exit')

  if (hasEntrySlot && entryTriggers.length > 0) {
    return {
      consumed: true,
      nextState: mergeFragmentPatch(state, patch, 'entry'),
      answer: {},
      closedSlotKeys: ['trigger.entry'],
      closedSlots: [{ slotKey: 'trigger.entry', fieldPath: 'triggers[entry]' }],
    }
  }

  if (hasExitSlot && exitTriggers.length > 0) {
    return {
      consumed: true,
      nextState: mergeFragmentPatch(state, patch, 'exit'),
      answer: {},
      closedSlotKeys: ['trigger.exit'],
      closedSlots: [{ slotKey: 'trigger.exit', fieldPath: 'triggers[exit]' }],
    }
  }

  if (patchActions.length > 0 && (hasEntrySlot || hasExitSlot)) {
    return { consumed: false, nextState: state }
  }

  return { consumed: false, nextState: state }
}

function hasOpenSlot(state: SemanticState, slotKey: string): boolean {
  return state.triggers.some(trigger =>
    trigger.openSlots.some(slot => slot.slotKey === slotKey && slot.status === 'open'),
  )
}

function mergeFragmentPatch(
  state: SemanticState,
  patch: ReturnType<SemanticSeedExtractorService['extract']>,
  fulfilledPhase: 'entry' | 'exit',
): SemanticState {
  const triggers = [
    ...state.triggers.filter(trigger => trigger.key !== (fulfilledPhase === 'entry' ? 'semantic.missing_entry_atom' : 'semantic.missing_exit_atom')),
    ...(patch.triggers ?? []).map((trigger, index) => ({
      id: `fragment-${trigger.phase}-${trigger.key}-${index}`,
      key: trigger.key,
      phase: trigger.phase,
      sideScope: trigger.sideScope,
      params: trigger.params ?? {},
      contracts: trigger.contracts,
      status: 'locked' as const,
      source: 'user_explicit' as const,
      openSlots: trigger.openSlots ?? [],
      evidence: trigger.evidence,
    })),
  ]

  const existingActionKeys = new Set(state.actions.map(action => action.key))
  const actions = [
    ...state.actions,
    ...(patch.actions ?? [])
      .filter(action => !existingActionKeys.has(action.key))
      .map((action, index) => ({
        id: `fragment-action-${action.key}-${index}`,
        key: action.key,
        params: action.params,
        contracts: action.contracts,
        status: 'locked' as const,
        source: 'user_explicit' as const,
        openSlots: action.openSlots ?? [],
        evidence: action.evidence,
      })),
  ]

  return {
    ...state,
    triggers,
    actions,
    contextSlots: mergeContextSlots(state.contextSlots, patch.contextSlots),
    updatedAt: new Date().toISOString(),
  }
}
```

If TypeScript rejects `contextSlots` shape in this helper, use existing `SemanticSeedStateBuilderService`/merge utilities instead of broadening types. Keep the behavior identical: fragment patch adds real atoms and does not erase existing state.

- [ ] **Step 5: Add `mergeContextSlots` helper**

Add:

```ts
function mergeContextSlots(
  current: SemanticState['contextSlots'],
  patchContext: ReturnType<SemanticSeedExtractorService['extract']>['contextSlots'],
): SemanticState['contextSlots'] {
  if (!patchContext) return current
  const next = { ...current }
  for (const key of ['exchange', 'symbol', 'marketType', 'timeframe'] as const) {
    if (next[key]) continue
    const value = patchContext[key]
    if (!value) continue
    next[key] = {
      slotKey: key,
      fieldPath: `contextSlots.${key}`,
      value,
      status: 'locked',
      priority: 'context',
      questionHint: `请确认${key}。`,
      affectsExecution: true,
    }
  }
  return next
}
```

- [ ] **Step 6: Run resolver test and verify it passes**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-open-slot-answer-resolver.service.spec.ts -t "complete entry trigger fragment"
```

Expected: PASS.

- [ ] **Step 7: Commit Task 2**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-open-slot-answer-resolver.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-open-slot-answer-resolver.service.spec.ts
git commit -F - <<'MSG'
fix: fulfill semantic open slots from atom fragments

变更说明：
- 让 open slot answer resolver 支持 entry/exit semantic fragments
- 用户补充真实 trigger 后关闭 missing trigger slot
- 保留已有 session context 并合并 fragment actions

Refs: #960
MSG
```

## Task 3: Add Missing Placeholder Reconciliation

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-missing-placeholder-reconciler.service.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-missing-placeholder-reconciler.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`

- [ ] **Step 1: Write failing reconciler tests**

Create the spec:

```ts
import type { SemanticState } from '../../types/semantic-state'
import { SemanticMissingPlaceholderReconcilerService } from '../semantic-missing-placeholder-reconciler.service'

function baseState(): SemanticState {
  return {
    version: 1,
    families: [],
    triggers: [
      {
        id: 'semantic-missing-entry-atom',
        key: 'semantic.missing_entry_atom',
        phase: 'entry',
        params: {},
        status: 'open',
        source: 'derived',
        openSlots: [{
          slotKey: 'trigger.entry',
          fieldPath: 'triggers[entry]',
          status: 'open',
          priority: 'core',
          questionHint: '请补充入场触发条件。',
          affectsExecution: true,
        }],
      },
      {
        id: 'entry-real',
        key: 'indicator.above',
        phase: 'entry',
        sideScope: 'long',
        params: { indicator: 'ema', 'reference.period': 20, timeframe: '15m' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    ],
    actions: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
    risk: [],
    position: null,
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-05-05T00:00:00.000Z',
  }
}

describe('SemanticMissingPlaceholderReconcilerService', () => {
  const service = new SemanticMissingPlaceholderReconcilerService()

  it('removes missing entry placeholder when a real entry trigger exists', () => {
    const next = service.reconcile(baseState())

    expect(next.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'indicator.above', phase: 'entry' }),
    ]))
    expect(next.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'semantic.missing_entry_atom', status: 'open' }),
    ]))
  })

  it('keeps missing entry placeholder when there is only an entry action', () => {
    const state = baseState()
    state.triggers = state.triggers.filter(trigger => trigger.key === 'semantic.missing_entry_atom')
    const next = service.reconcile(state)

    expect(next.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'semantic.missing_entry_atom', status: 'open' }),
    ]))
  })
})
```

- [ ] **Step 2: Run reconciler test and verify it fails**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-missing-placeholder-reconciler.service.spec.ts
```

Expected: FAIL with module not found.

- [ ] **Step 3: Implement the reconciler service**

Create `semantic-missing-placeholder-reconciler.service.ts`:

```ts
import { Injectable } from '@nestjs/common'
import type { SemanticState, SemanticTriggerState } from '../types/semantic-state'

@Injectable()
export class SemanticMissingPlaceholderReconcilerService {
  reconcile(state: SemanticState): SemanticState {
    const hasRealEntry = state.triggers.some(isRealEntryTrigger)
    const hasRealExit = state.triggers.some(isRealExitTrigger)

    if (!hasRealEntry && !hasRealExit) {
      return state
    }

    const triggers = state.triggers.filter((trigger) => {
      if (hasRealEntry && trigger.key === 'semantic.missing_entry_atom') return false
      if (hasRealExit && trigger.key === 'semantic.missing_exit_atom') return false
      return true
    })

    return triggers.length === state.triggers.length
      ? state
      : { ...state, triggers }
  }
}

function isRealEntryTrigger(trigger: SemanticTriggerState): boolean {
  return trigger.phase === 'entry'
    && trigger.key !== 'semantic.missing_entry_atom'
    && trigger.key !== 'semantic.missing_exit_atom'
    && trigger.status !== 'superseded'
}

function isRealExitTrigger(trigger: SemanticTriggerState): boolean {
  return trigger.phase === 'exit'
    && trigger.key !== 'semantic.missing_entry_atom'
    && trigger.key !== 'semantic.missing_exit_atom'
    && trigger.status !== 'superseded'
}
```

- [ ] **Step 4: Wire the reconciler into `CodegenConversationService`**

Import:

```ts
import { SemanticMissingPlaceholderReconcilerService } from './semantic-missing-placeholder-reconciler.service'
```

Add constructor dependency:

```ts
    private readonly semanticMissingPlaceholderReconciler: SemanticMissingPlaceholderReconcilerService = new SemanticMissingPlaceholderReconcilerService(),
```

Before calls to `withRequiredSemanticOpenSlots(...)` and before support gate handling for existing sessions, wrap semantic state with:

```ts
const reconciledSemanticState = this.semanticMissingPlaceholderReconciler.reconcile(semanticStateAfterAnswers)
```

Use the reconciled state for support classification, readiness normalization, and clarification rendering. In `continueWithResolvedSemanticOpenSlotAnswer`, reconcile the resolver-produced state before `handleSemanticSupportGateForExistingSession`.

- [ ] **Step 5: Run reconciler tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-missing-placeholder-reconciler.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-missing-placeholder-reconciler.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-missing-placeholder-reconciler.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts
git commit -F - <<'MSG'
fix: clear missing semantic placeholders after real atoms

变更说明：
- 新增 missing entry/exit placeholder reconciliation
- 真实 trigger 到达后不再让 derived missing atom 阻塞 readiness
- 在对话续写路径中复用清理逻辑

Refs: #960
MSG
```

## Task 4: Align Support Status for Executable Indicator Compare Atoms

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-support-classifier.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-support-classifier.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-registry.service.ts`

- [ ] **Step 1: Add support classifier test for EMA compare with timeframe**

Add:

```ts
  it('routes executable EMA compare triggers with per-trigger timeframe to projection', () => {
    const result = service.classify(baseState({
      triggers: [{
        id: 'entry-15m',
        key: 'indicator.above',
        phase: 'entry',
        sideScope: 'long',
        params: { indicator: 'ema', referenceRole: 'long_term', 'reference.period': 20, timeframe: '15m' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      }],
      actions: [{ id: 'open', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    }))

    expect(result.route).toBe('projection_gate')
    expect(result.unsupportedAtoms).toEqual([])
    expect(result.unknownAtoms).toEqual([])
  })
```

- [ ] **Step 2: Run support test and verify current behavior**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-support-classifier.service.spec.ts -t "EMA compare triggers"
```

Expected: FAIL if registry unsupported metadata still wins for EMA compare with timeframe; PASS if classifier override already handles it. If it passes, still complete Step 3 to remove stale registry ambiguity.

- [ ] **Step 3: Update registry support definitions**

In `semantic-atom-registry.service.ts`, replace the unsupported definitions for `indicator.above` and `indicator.below` with executable trigger definitions if this does not break non-MA unsupported cases:

```ts
  executableTrigger('indicator.above', ['indicator', 'reference.period']),
  executableTrigger('indicator.below', ['indicator', 'reference.period']),
```

If broad executable definitions make RSI/other unsupported cases pass incorrectly, keep the registry entries as unsupported and document classifier override behavior by adding this comment above `isExecutableIndicatorReferenceAlias`:

```ts
// MA/SMA/EMA price-vs-reference aliases are projection-supported even though
// non-MA static indicator comparisons remain recognized unsupported.
```

Do not allow MA/EMA executable aliases to route to `unsupported_fallback`.

- [ ] **Step 4: Run support tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-support-classifier.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-support-classifier.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-registry.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-support-classifier.service.spec.ts
git commit -F - <<'MSG'
fix: align support for executable indicator compare atoms

变更说明：
- 确保 MA/EMA indicator.above/below 不进入 unsupported fallback
- 覆盖 per-trigger timeframe 的支持分类
- 清理 registry 与 projection 支持口径的分裂

Refs: #960
MSG
```

## Task 5: Preserve Per-Trigger Timeframes Through Canonical Projection

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- Modify during this task when the focused timeframe tests fail: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts`
- Modify during this task when the focused timeframe tests fail: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-strategy-ir-validator.service.ts`
- Modify during this task when the focused timeframe tests fail: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service.ts`

- [ ] **Step 1: Add canonical builder test for multi-timeframe indicator compare**

Add near the existing `indicator.above/below` canonical test:

```ts
  it('preserves per-trigger timeframes for multi-timeframe indicator compare triggers', () => {
    const service = new CanonicalSpecBuilderService()

    const spec = service.buildFromNormalizedIntent({
      market: { exchange: 'okx', marketType: 'perp', defaultTimeframe: '15m' },
      symbols: ['BTCUSDT'],
      timeframes: ['15m', '1h', '4h'],
    }, {
      families: ['single-leg'],
      triggers: [
        {
          key: 'indicator.above',
          phase: 'entry',
          params: { indicator: 'ema', referenceRole: 'long_term', 'reference.period': 20, timeframe: '15m' },
          closureStatus: 'closed',
          unresolvedSlots: [],
        },
        {
          key: 'indicator.above',
          phase: 'entry',
          params: { indicator: 'ema', referenceRole: 'long_term', 'reference.period': 20, timeframe: '1h' },
          closureStatus: 'closed',
          unresolvedSlots: [],
        },
        {
          key: 'indicator.above',
          phase: 'entry',
          params: { indicator: 'ema', referenceRole: 'long_term', 'reference.period': 20, timeframe: '4h' },
          closureStatus: 'closed',
          unresolvedSlots: [],
        },
      ],
      actions: [{ key: 'open_long' }],
      risk: [],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_only' },
      unresolved: [],
      normalizationNotes: [],
    })

    const entryRules = spec.rules.filter(rule => rule.phase === 'entry')
    expect(entryRules).toHaveLength(3)
    expect(entryRules).toEqual(expect.arrayContaining([
      expect.objectContaining({ condition: expect.objectContaining({ params: expect.objectContaining({ timeframe: '15m' }) }) }),
      expect.objectContaining({ condition: expect.objectContaining({ params: expect.objectContaining({ timeframe: '1h' }) }) }),
      expect.objectContaining({ condition: expect.objectContaining({ params: expect.objectContaining({ timeframe: '4h' }) }) }),
    ]))
    expect(spec.market.timeframes).toEqual(expect.arrayContaining(['15m', '1h', '4h']))
  })
```

- [ ] **Step 2: Run canonical test and verify it fails**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts -t "per-trigger timeframes"
```

Expected: FAIL if trigger-level timeframes are dropped or market timeframes omit `1h`/`4h`.

- [ ] **Step 3: Preserve trigger params timeframe in canonical rules**

In `canonical-spec-builder.service.ts`, locate the `indicator.above` / `indicator.below` rule construction and include `timeframe` in the condition params:

```ts
params: {
  indicator,
  referenceRole,
  'reference.period': referencePeriod,
  ...(typeof trigger.params.timeframe === 'string' ? { timeframe: trigger.params.timeframe } : {}),
}
```

When building `spec.market.timeframes`, merge global timeframes with trigger params:

```ts
const triggerTimeframes = normalizedIntent.triggers
  .map(trigger => typeof trigger.params.timeframe === 'string' ? trigger.params.timeframe : null)
  .filter((value): value is string => Boolean(value))
```

Then dedupe:

```ts
timeframes: Array.from(new Set([...market.timeframes, ...triggerTimeframes]))
```

- [ ] **Step 4: Run canonical test and verify it passes**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts -t "per-trigger timeframes"
```

Expected: PASS.

- [ ] **Step 5: Run IR/AST focused tests if canonical output feeds multi-timeframe validation**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-strategy-ir-validator.service.spec.ts -t "timeframe"
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-strategy-ast-compiler.service.spec.ts -t "timeframe"
```

Expected: PASS. If either fails with declared multi-timeframe mismatch, update the validator/compiler to treat condition-level `params.timeframe` as an explicit series timeframe rather than an accidental drift.

- [ ] **Step 6: Commit Task 5**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/canonical-strategy-ir-validator.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts
git commit -F - <<'MSG'
fix: preserve per-trigger timeframe projection

变更说明：
- canonical rules 保留 trigger.params.timeframe
- 多周期 trigger 进入 market timeframes
- 保持多周期 AND 条件在 projection 后语义不丢失

Refs: #960
MSG
```

If some listed files are unchanged, omit them from `git add`.

## Task 6: Add Conversation-Level Regression Coverage

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- Modify implementation files touched in Tasks 1-5 only if conversation tests expose an integration gap.

- [ ] **Step 1: Add regression test for follow-up entry slot fulfillment**

Find the existing semantic missing atom tests around `keeps missing executable atoms as semantic slots across partial semantic turns`. Add:

```ts
  it('fulfills missing entry atom from follow-up EMA state fragment', async () => {
    const session = makeSession({
      id: 's-follow-up-entry-fragment',
      status: 'DRAFT',
      semanticState: {
        version: 1,
        families: [],
        triggers: [{
          id: 'semantic-missing-entry-atom',
          key: 'semantic.missing_entry_atom',
          phase: 'entry',
          params: {},
          status: 'open',
          source: 'derived',
          openSlots: [{
            slotKey: 'trigger.entry',
            fieldPath: 'triggers[entry]',
            status: 'open',
            priority: 'core',
            questionHint: '请补充入场触发条件。',
            affectsExecution: true,
          }],
        }],
        actions: [],
        risk: [],
        position: {
          mode: 'fixed_ratio',
          value: 0.1,
          positionMode: 'long_only',
          sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        contextSlots: {
          exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', value: 'okx', status: 'locked', priority: 'context', questionHint: '请选择交易所。', affectsExecution: true },
          symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'BTCUSDT', status: 'locked', priority: 'context', questionHint: '请选择标的。', affectsExecution: true },
          marketType: { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'perp', status: 'locked', priority: 'context', questionHint: '请选择市场类型。', affectsExecution: true },
          timeframe: null,
        },
        normalizationNotes: [],
        updatedAt: '2026-05-05T00:00:00.000Z',
      },
    })
    sessionsRepo.findById.mockResolvedValue(session)

    const result = await service.continueSession('s-follow-up-entry-fragment', {
      userId: session.userId,
      message: '15min k线在 ema20 上方开多',
    })

    expect(result.semanticState?.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.above',
        phase: 'entry',
        params: expect.objectContaining({ timeframe: '15m' }),
      }),
    ]))
    expect(result.semanticState?.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'semantic.missing_entry_atom', status: 'open' }),
    ]))
    expect(result.assistantPrompt ?? '').not.toContain('请补充入场触发条件')
  })
```

Adapt `makeSession`, `sessionsRepo`, and `service` names to the local test fixture names in the file. Do not introduce a second fixture pattern.

- [ ] **Step 2: Add regression test for first-turn multi-timeframe wording**

Add:

```ts
  it('does not ask for entry trigger when first-turn multi-timeframe EMA wording has an entry atom', async () => {
    const result = await service.startSession({
      userId: 'u-1',
      message: '15min 1h 4h 价格都在 ema20 的上方 买入',
    })

    expect(result.semanticState?.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'indicator.above', phase: 'entry' }),
    ]))
    expect(result.semanticState?.triggers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'semantic.missing_entry_atom', status: 'open' }),
    ]))
    expect(result.assistantPrompt ?? '').not.toContain('请补充入场触发条件')
  })
```

If the service method is not named `startSession`, use the existing creation method in the file. Keep the assertion shape.

- [ ] **Step 3: Run conversation regression tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts -t "follow-up entry fragment|first-turn multi-timeframe EMA"
```

Expected: PASS after Tasks 1-5. If it fails because required symbol/position slots are asked, update the test to assert the prompt asks those concrete slots and still does not ask for entry trigger.

- [ ] **Step 4: Commit Task 6**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services
git commit -F - <<'MSG'
test: cover atom-native entry continuation flow

变更说明：
- 覆盖首轮多周期 EMA 表达不再缺 entry atom
- 覆盖后续补充 entry fragment 关闭 missing entry slot
- 锁定 clarification 文案不再误报缺入场条件

Refs: #960
MSG
```

## Task 7: Full Verification

**Files:**
- No new files unless prior tasks exposed missing coverage.

- [ ] **Step 1: Run focused semantic tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-open-slot-answer-resolver.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-missing-placeholder-reconciler.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-support-classifier.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts
```

Expected: all PASS.

- [ ] **Step 2: Run conversation regression suite**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts -t "semantic|entry|slot|multi-timeframe"
```

Expected: PASS. If the pattern is too broad or the runner rejects regex alternation, run the specific tests added in Task 6 by exact names.

- [ ] **Step 3: Run lint/build gate for Quantify scope**

Run:

```bash
dx lint
dx build quantify --dev
```

Expected: PASS.

- [ ] **Step 4: Final commit if verification required small fixes**

If Step 1-3 required small fixes, commit them:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services apps/quantify/src/modules/llm-strategy-codegen/services/__tests__
git commit -F - <<'MSG'
fix: satisfy atom-native semantic verification

变更说明：
- 修复验证中暴露的类型或集成问题
- 保持 atom-native normalization 与 slot fulfillment 行为一致

Refs: #960
MSG
```

If there are no additional changes after verification, do not create an empty commit.

## Self-Review Notes

- Spec coverage: Tasks 1-2 cover first-turn normalization and follow-up fragment fulfillment; Task 3 covers placeholder cleanup; Task 4 covers registry/support alignment; Task 5 covers contract/projection preservation; Task 6 covers conversation behavior and user-facing prompt correctness; Task 7 covers verification.
- Placeholder scan: no TBD/TODO placeholders are present; code snippets give concrete expected behavior and commands.
- Type consistency: the plan consistently uses `CodegenSemanticPatch`, `SemanticState`, `indicator.above/below`, `params.timeframe`, `semantic.missing_entry_atom`, and `trigger.entry`.
