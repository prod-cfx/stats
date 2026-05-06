# AI Quant Combination Atomic Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make simple and combination AI Quant strategies compile through one SemanticState atomic contract flow, with trigger contract groups preserving AND/OR/gate/action/risk semantics into compiled scripts and consistency checks.

**Architecture:** Add a focused trigger combination contract resolver that turns explicit trigger contracts and implicit singleton triggers into stable rule-group descriptors. Route `CanonicalSpecBuilderService` through that resolver, keep risk atoms in the existing risk domain, and extend consistency checks so compiled predicates, guards, and risk predicates are aligned against the original SemanticState contract rather than a separate semantic source.

**Tech Stack:** NestJS service classes, TypeScript strict mode, Jest unit tests under `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__`, shared compiled runtime projections, `dx test unit quantify`.

---

## File Structure

- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-trigger-combination-contract.service.ts`
  - Owns trigger group descriptor extraction, implicit singleton group creation, explicit contract validation, and legacy marker fallback.
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-trigger-combination-contract.service.spec.ts`
  - Covers singleton groups, explicit AND/OR groups, conflicting joins/action keys, and legacy marker fallback.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
  - Replaces ad hoc trigger grouping with the resolver. Keeps trigger atom compilation and risk compilation in the existing service.
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts`
  - Adds focused assertions for EMA AND entry, OR exit, gate attachment, and singleton behavior.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
  - Emits standard trigger combination contracts for the four reported natural-language combination patterns where extraction already recognizes the atoms.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-normalization.ts`
  - Normalizes loose group params into standard `contracts[].params` for testing-stage compatibility.
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-combination-semantics.spec.ts`
  - Asserts extracted SemanticState now carries standard contract metadata.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-consistency.service.ts`
  - Adds contract alignment helpers for predicate groups and risk predicate effects.
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-consistency.service.spec.ts`
  - Covers risk predicate effects and anyOf child rule mapping.
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts`
  - Adds end-to-end publication regressions for the four acceptance strategies and simple singleton strategies.
- Docs: `docs/superpowers/specs/2026-05-07-ai-quant-combination-atomic-contract-design.md`
  - Already written. Only update if implementation discovers a confirmed design correction.

---

### Task 1: Trigger Combination Contract Resolver

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-trigger-combination-contract.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-trigger-combination-contract.service.spec.ts`

- [ ] **Step 1: Write failing tests for singleton and explicit groups**

Add `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-trigger-combination-contract.service.spec.ts`:

```ts
import type { SemanticTriggerState } from '../../types/semantic-state'
import { SemanticTriggerCombinationContractService } from '../semantic-trigger-combination-contract.service'

function trigger(input: Partial<SemanticTriggerState> & Pick<SemanticTriggerState, 'id' | 'key' | 'phase'>): SemanticTriggerState {
  return {
    params: {},
    sideScope: 'long',
    status: 'locked',
    source: 'user_explicit',
    openSlots: [],
    ...input,
  }
}

describe('SemanticTriggerCombinationContractService', () => {
  const service = new SemanticTriggerCombinationContractService()

  it('creates an implicit singleton group for an ungrouped entry trigger', () => {
    const [group] = service.resolveExecutableGroups([
      trigger({ id: 'entry-ma20', key: 'indicator.above', phase: 'entry' }),
    ])

    expect(group).toEqual(expect.objectContaining({
      groupId: 'implicit:entry:long:open_long:entry-ma20',
      join: 'AND',
      phase: 'entry',
      sideScope: 'long',
      actionKey: 'open_long',
      actionBinding: 'single_action',
    }))
    expect(group?.members.map(member => member.id)).toEqual(['entry-ma20'])
  })

  it('resolves an explicit AND entry group from trigger contracts', () => {
    const triggers = [20, 60, 144].map(period => trigger({
      id: `entry-ema${period}`,
      key: 'indicator.above',
      phase: 'entry',
      params: { indicator: 'ema', 'reference.period': period },
      contracts: [{
        id: 'contract-entry-ema-stack',
        kind: 'trigger',
        capabilities: [],
        requires: [],
        params: {
          groupId: 'entry-ema-stack',
          join: 'AND',
          actionKey: 'open_long',
          actionBinding: 'single_action',
        },
      }],
    }))

    const [group] = service.resolveExecutableGroups(triggers)

    expect(group).toEqual(expect.objectContaining({
      groupId: 'entry-ema-stack',
      join: 'AND',
      actionKey: 'open_long',
    }))
    expect(group?.members.map(member => member.id)).toEqual(['entry-ema20', 'entry-ema60', 'entry-ema144'])
  })

  it('resolves an explicit OR exit group from trigger contracts', () => {
    const triggers = [
      trigger({
        id: 'exit-ma100',
        key: 'indicator.below',
        phase: 'exit',
        contracts: [{
          id: 'contract-exit-ma100-macd',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: { groupId: 'exit-ma100-macd', join: 'OR', actionKey: 'close_long', actionBinding: 'single_action' },
        }],
      }),
      trigger({
        id: 'exit-macd-death',
        key: 'indicator.cross_under',
        phase: 'exit',
        contracts: [{
          id: 'contract-exit-ma100-macd',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: { groupId: 'exit-ma100-macd', join: 'OR', actionKey: 'close_long', actionBinding: 'single_action' },
        }],
      }),
    ]

    const [group] = service.resolveExecutableGroups(triggers)

    expect(group).toEqual(expect.objectContaining({
      groupId: 'exit-ma100-macd',
      join: 'OR',
      phase: 'exit',
      actionKey: 'close_long',
    }))
    expect(group?.members.map(member => member.id)).toEqual(['exit-ma100', 'exit-macd-death'])
  })
})
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-trigger-combination-contract.service.spec.ts
```

Expected: FAIL because `semantic-trigger-combination-contract.service.ts` does not exist.

- [ ] **Step 3: Implement the resolver service**

Create `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-trigger-combination-contract.service.ts`:

```ts
import type { SemanticTriggerState } from '../types/semantic-state'
import { Injectable } from '@nestjs/common'

export type SemanticTriggerGroupJoin = 'AND' | 'OR'
export type SemanticTriggerActionKey = 'open_long' | 'open_short' | 'close_long' | 'close_short'
export type SemanticTriggerActionBinding = 'single_action'

export interface SemanticTriggerCombinationDescriptor {
  groupId: string
  join: SemanticTriggerGroupJoin
  phase: 'entry' | 'exit'
  sideScope: 'long' | 'short' | 'both'
  actionKey: SemanticTriggerActionKey
  actionBinding: SemanticTriggerActionBinding
  explicit: boolean
  members: SemanticTriggerState[]
}

interface ReadContractResult {
  groupId: string | null
  join: SemanticTriggerGroupJoin | null
  actionKey: SemanticTriggerActionKey | null
  actionBinding: SemanticTriggerActionBinding | null
}

@Injectable()
export class SemanticTriggerCombinationContractService {
  resolveExecutableGroups(triggers: readonly SemanticTriggerState[]): SemanticTriggerCombinationDescriptor[] {
    const groups = new Map<string, SemanticTriggerCombinationDescriptor>()

    for (const trigger of triggers) {
      if (trigger.status !== 'locked') continue
      if (trigger.phase !== 'entry' && trigger.phase !== 'exit') continue

      const contract = this.readContract(trigger)
      const sideScope = this.resolveSideScope(trigger)
      const actionKey = contract.actionKey ?? this.defaultActionKey(trigger.phase, sideScope)
      const explicit = contract.groupId !== null
      const groupId = contract.groupId ?? this.implicitGroupId(trigger, actionKey, sideScope)
      const join = contract.join ?? 'AND'
      const actionBinding = contract.actionBinding ?? 'single_action'
      const key = JSON.stringify([trigger.phase, sideScope, actionKey, groupId])
      const existing = groups.get(key)

      if (existing) {
        if (existing.join !== join) {
          throw new Error(`semantic_trigger_group_join_conflict:${groupId}`)
        }
        if (existing.actionBinding !== actionBinding) {
          throw new Error(`semantic_trigger_group_action_binding_conflict:${groupId}`)
        }
        existing.members.push(trigger)
        existing.explicit ||= explicit
        continue
      }

      groups.set(key, {
        groupId,
        join,
        phase: trigger.phase,
        sideScope,
        actionKey,
        actionBinding,
        explicit,
        members: [trigger],
      })
    }

    return [...groups.values()]
  }

  private readContract(trigger: SemanticTriggerState): ReadContractResult {
    for (const contract of trigger.contracts ?? []) {
      const params = contract.params
      const groupId = this.readString(params.groupId)
        ?? this.readString(params.displayGroupId)
        ?? this.readString(params.combinationId)
      const join = this.readJoin(params.join)
      const actionKey = this.readActionKey(params.actionKey)
      const actionBinding = this.readActionBinding(params.actionBinding)
      if (groupId || join || actionKey || actionBinding) {
        return { groupId, join, actionKey, actionBinding }
      }
    }

    const groupId = this.readString(trigger.params.groupId)
      ?? this.readString(trigger.params.semanticGroupId)
      ?? this.readString(trigger.params.logicalGroupId)
      ?? this.readString(trigger.params.combinationId)
      ?? this.readString(trigger.params.atomicCombinationId)
    return {
      groupId,
      join: this.readJoin(trigger.params.join),
      actionKey: this.readActionKey(trigger.params.actionKey),
      actionBinding: this.readActionBinding(trigger.params.actionBinding),
    }
  }

  private implicitGroupId(
    trigger: SemanticTriggerState,
    actionKey: SemanticTriggerActionKey,
    sideScope: 'long' | 'short' | 'both',
  ): string {
    return `implicit:${trigger.phase}:${sideScope}:${actionKey}:${trigger.id}`
  }

  private resolveSideScope(trigger: SemanticTriggerState): 'long' | 'short' | 'both' {
    return trigger.sideScope === 'short' || trigger.sideScope === 'both' ? trigger.sideScope : 'long'
  }

  private defaultActionKey(
    phase: 'entry' | 'exit',
    sideScope: 'long' | 'short' | 'both',
  ): SemanticTriggerActionKey {
    if (phase === 'entry') return sideScope === 'short' ? 'open_short' : 'open_long'
    return sideScope === 'short' ? 'close_short' : 'close_long'
  }

  private readString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
  }

  private readJoin(value: unknown): SemanticTriggerGroupJoin | null {
    if (value === 'AND' || value === 'OR') return value
    if (value === 'allOf') return 'AND'
    if (value === 'anyOf') return 'OR'
    return null
  }

  private readActionKey(value: unknown): SemanticTriggerActionKey | null {
    if (value === 'open_long' || value === 'open_short' || value === 'close_long' || value === 'close_short') {
      return value
    }
    return null
  }

  private readActionBinding(value: unknown): SemanticTriggerActionBinding | null {
    return value === 'single_action' ? value : null
  }
}
```

- [ ] **Step 4: Run the new test to verify it passes**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-trigger-combination-contract.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-trigger-combination-contract.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-trigger-combination-contract.service.spec.ts
git commit -F - <<'MSG'
feat: add semantic trigger combination contract resolver

变更说明：
- 增加 trigger contract 分组解析服务
- 支持显式 AND/OR 组合与隐式 singleton group
- 覆盖 actionBinding 与冲突校验基础行为

Refs: #981
MSG
```

---

### Task 2: CanonicalSpecBuilder Rule-Group Compilation

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts`

- [ ] **Step 1: Write failing tests for grouped rule compilation**

Append tests to `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts`:

```ts
describe('semantic trigger contract rule groups', () => {
  const builder = new CanonicalSpecBuilderService()

  function slot(slotKey: keyof SemanticState['contextSlots'], value: string) {
    return {
      slotKey,
      fieldPath: `contextSlots.${slotKey}`,
      value,
      status: 'locked' as const,
      priority: 'context' as const,
      questionHint: '',
      affectsExecution: true,
    }
  }

  function baseState(overrides: Partial<SemanticState>): SemanticState {
    return {
      version: 1,
      families: ['single-leg'],
      triggers: [],
      actions: [{ id: 'action-open-long', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
      risk: [],
      position: {
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      contextSlots: {
        exchange: slot('exchange', 'okx'),
        symbol: slot('symbol', 'BTCUSDT'),
        marketType: slot('marketType', 'perp'),
        timeframe: slot('timeframe', '15m'),
      },
      normalizationNotes: [],
      updatedAt: '2026-05-07T00:00:00.000Z',
      ...overrides,
    }
  }

  it('compiles EMA stack entry as one AND rule with one OPEN_LONG action', () => {
    const state = baseState({
      triggers: [20, 60, 144].map(period => ({
        id: `entry-ema${period}`,
        key: 'indicator.above',
        phase: 'entry' as const,
        sideScope: 'long' as const,
        status: 'locked' as const,
        source: 'user_explicit' as const,
        openSlots: [],
        params: { indicator: 'ema', 'reference.period': period },
        contracts: [{
          id: 'contract-entry-ema-stack',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: { groupId: 'entry-ema-stack', join: 'AND', actionKey: 'open_long', actionBinding: 'single_action' },
        }],
      })),
    })

    const spec = builder.buildFromSemanticState(state)
    const entryRules = spec.rules.filter(rule => rule.phase === 'entry')

    expect(entryRules).toHaveLength(1)
    expect(entryRules[0]?.condition).toEqual(expect.objectContaining({ kind: 'AND' }))
    expect(entryRules[0]?.actions).toEqual([expect.objectContaining({ type: 'OPEN_LONG' })])
  })

  it('compiles OR exits as one CLOSE_LONG rule', () => {
    const state = baseState({
      actions: [{ id: 'action-close-long', key: 'close_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
      triggers: [
        {
          id: 'exit-ma100',
          key: 'indicator.below',
          phase: 'exit',
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: { indicator: 'ma', 'reference.period': 100 },
          contracts: [{
            id: 'contract-exit-ma100-macd',
            kind: 'trigger',
            capabilities: [],
            requires: [],
            params: { groupId: 'exit-ma100-macd', join: 'OR', actionKey: 'close_long', actionBinding: 'single_action' },
          }],
        },
        {
          id: 'exit-macd-death',
          key: 'indicator.cross_under',
          phase: 'exit',
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: { indicator: 'macd' },
          contracts: [{
            id: 'contract-exit-ma100-macd',
            kind: 'trigger',
            capabilities: [],
            requires: [],
            params: { groupId: 'exit-ma100-macd', join: 'OR', actionKey: 'close_long', actionBinding: 'single_action' },
          }],
        },
      ],
    })

    const spec = builder.buildFromSemanticState(state)
    const exitRules = spec.rules.filter(rule => rule.phase === 'exit')

    expect(exitRules).toHaveLength(1)
    expect(exitRules[0]?.condition).toEqual(expect.objectContaining({ kind: 'OR' }))
    expect(exitRules[0]?.actions).toEqual([expect.objectContaining({ type: 'CLOSE_LONG' })])
  })
})
```

Add these imports at the top if missing:

```ts
import type { SemanticState } from '../../types/semantic-state'
```

- [ ] **Step 2: Run focused builder tests to verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts -t "semantic trigger contract rule groups"
```

Expected: FAIL because current builder either ignores standard contracts or splits grouped triggers.

- [ ] **Step 3: Inject the resolver into CanonicalSpecBuilderService**

Modify constructor imports in `canonical-spec-builder.service.ts`:

```ts
import { SemanticTriggerCombinationContractService } from './semantic-trigger-combination-contract.service'
```

Extend the constructor:

```ts
constructor(
  private readonly strategyIrCanonicalAdapter: StrategyIrCanonicalAdapterService = new StrategyIrCanonicalAdapterService(),
  private readonly contracts: SemanticAtomContractService = new SemanticAtomContractService(),
  private readonly shapeNormalizer: SemanticContractShapeNormalizerService = new SemanticContractShapeNormalizerService(),
  private readonly triggerCombinationContracts: SemanticTriggerCombinationContractService = new SemanticTriggerCombinationContractService(),
) {}
```

- [ ] **Step 4: Route entry/exit semantic triggers through executable groups**

In `buildRulesFromSemanticState`, replace the pending trigger grouping path for `entry` and `exit` triggers with resolver output. Keep gate and grid behavior in place. The implementation should follow this shape:

```ts
const executableGroups = this.triggerCombinationContracts.resolveExecutableGroups(state.triggers)
for (const group of executableGroups) {
  const conditions = group.members
    .map(trigger => this.buildConditionFromSemanticTriggerGroup([trigger], defaultTimeframe))
    .filter((condition): condition is CanonicalConditionNode => condition !== null)
  if (conditions.length === 0) continue

  const groupedCondition: CanonicalConditionNode = conditions.length === 1
    ? conditions[0]!
    : {
        kind: group.join,
        predicateForm: 'generic',
        children: conditions,
      }
  const condition = group.phase === 'entry'
    ? this.attachSemanticGateConditions(groupedCondition, gateConditions)
    : groupedCondition
  const actions = this.buildActionsForSemanticActionKey(group.actionKey, sizing)
  if (actions.length === 0) continue

  counters[group.phase] += 1
  rules.push({
    id: `semantic-${group.phase}-${counters[group.phase]}`,
    phase: group.phase,
    sideScope: group.sideScope,
    priority: this.resolveSemanticRulePriority(group.phase, counters[group.phase]),
    condition,
    actions,
  })
}
```

Add helper in the class:

```ts
private buildActionsForSemanticActionKey(
  actionKey: 'open_long' | 'open_short' | 'close_long' | 'close_short',
  sizing: CanonicalStrategySpecV2['sizing'],
): CanonicalRuleV2['actions'] {
  switch (actionKey) {
    case 'open_short':
      return [this.buildOpenAction('OPEN_SHORT', sizing)]
    case 'close_short':
      return [{ type: 'CLOSE_SHORT' }]
    case 'close_long':
      return [{ type: 'CLOSE_LONG' }]
    case 'open_long':
    default:
      return [this.buildOpenAction('OPEN_LONG', sizing)]
  }
}
```

Remove or bypass the old `pendingTriggerRules` path for entry/exit triggers so grouped triggers cannot produce duplicate rules.

- [ ] **Step 5: Run focused builder tests to verify pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts -t "semantic trigger contract rule groups"
```

Expected: PASS.

- [ ] **Step 6: Run existing builder regression tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts
```

Expected: PASS. If a simple single-trigger test fails, preserve the singleton group behavior rather than adding a separate simple-strategy path.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts
git commit -F - <<'MSG'
feat: compile semantic trigger contract groups

变更说明：
- CanonicalSpecBuilder 统一通过 trigger contract group 编译 entry/exit
- 单腿策略使用隐式 singleton group
- AND/OR 组合只绑定一次动作并保留 gate 前置条件

Refs: #981
MSG
```

---

### Task 3: Semantic Extraction And Normalization Emit Standard Contracts

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-normalization.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-combination-semantics.spec.ts`

- [ ] **Step 1: Write failing extraction tests for standard contract metadata**

Extend existing tests in `atomic-contract-combination-semantics.spec.ts`:

```ts
function expectCombinationContract(
  trigger: SemanticTriggerState,
  expected: {
    groupId: string
    join: 'AND' | 'OR'
    actionKey: 'open_long' | 'close_long'
  },
): void {
  expect(trigger.contracts).toEqual(expect.arrayContaining([
    expect.objectContaining({
      kind: 'trigger',
      params: expect.objectContaining({
        groupId: expected.groupId,
        join: expected.join,
        actionKey: expected.actionKey,
        actionBinding: 'single_action',
      }),
    }),
  ]))
}

it('emits standard OR exit contracts for MA100 or MACD death-cross exits', () => {
  const { state } = runPipeline('SOL 30分钟价格在 MA100 上方，MACD 金叉买入；跌破 MA100 或 MACD 死叉卖出。')
  const orExit = state.triggers.find(trigger => trigger.key === 'logical.any_of')
  expect(orExit).toBeDefined()
  if (!orExit) throw new Error('logical_any_of_exit_missing')
  expectCombinationContract(orExit, {
    groupId: 'exit-ma100-macd',
    join: 'OR',
    actionKey: 'close_long',
  })
})
```

If extraction represents OR as two member triggers after implementation, adjust the assertion to locate `indicator.below` and `indicator.cross_under` exit triggers and assert both have the same contract.

- [ ] **Step 2: Run extraction test to verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-combination-semantics.spec.ts -t "standard OR exit contracts"
```

Expected: FAIL because standard contract params are not emitted yet.

- [ ] **Step 3: Add a contract builder helper in semantic-state-normalization**

Add to `semantic-state-normalization.ts`:

```ts
import type { SemanticAtomContract } from '../types/semantic-state'

export function buildTriggerCombinationContract(input: {
  id: string
  groupId: string
  join: 'AND' | 'OR'
  actionKey: 'open_long' | 'open_short' | 'close_long' | 'close_short'
  phase: 'entry' | 'exit'
  sideScope: 'long' | 'short' | 'both'
}): SemanticAtomContract {
  return {
    id: input.id,
    kind: 'trigger',
    capabilities: [{
      domain: 'market',
      verb: 'combine',
      object: 'predicate_group',
      shape: {
        groupId: input.groupId,
        join: input.join,
        role: 'member',
        phase: input.phase,
        sideScope: input.sideScope,
        actionKey: input.actionKey,
        actionBinding: 'single_action',
      },
    }],
    requires: [],
    params: {
      groupId: input.groupId,
      join: input.join,
      role: 'member',
      actionKey: input.actionKey,
      actionBinding: 'single_action',
    },
  }
}
```

- [ ] **Step 4: Emit standard contracts for recognized combination seeds**

In `semantic-seed-extractor.service.ts`, find the existing logic that recognizes:

- EMA/MA stack entry conditions.
- `logical.any_of` exits for "或".
- Bollinger + volume confirmation groups.

When creating each grouped trigger, append `buildTriggerCombinationContract(...)` to `contracts`.

Use these deterministic group ids for the four acceptance strategies:

```ts
entry-ema-stack
exit-ma100-macd
```

For generic cases, derive a stable id from `phase`, `sideScope`, `actionKey`, and the recognized family:

```ts
const groupId = `${phase}-${sideScope}-${actionKey}-${familyKey}`.replace(/\W+/g, '-')
```

- [ ] **Step 5: Run extraction tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-combination-semantics.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-normalization.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-combination-semantics.spec.ts
git commit -F - <<'MSG'
feat: emit standard combination trigger contracts

变更说明：
- 为识别出的组合 trigger 输出标准 contract group 元数据
- 统一 groupId/join/actionKey/actionBinding 结构
- 保留 SemanticState 原子域作为唯一语义源头

Refs: #981
MSG
```

---

### Task 4: Consistency Alignment For Contract Groups And Risk Predicate Effects

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-consistency.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-consistency.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-script-emitter.spec.ts`

- [ ] **Step 1: Write failing tests for risk predicate effects**

Append to `strategy-consistency.service.spec.ts`:

```ts
it('counts ATR risk predicates as implementing force-exit and close-long effects', () => {
  const semanticState = buildLockedAtomicState('atr-risk')
  const canonicalSpec = new CanonicalSpecBuilderService().buildFromSemanticState(semanticState)
  const ir = new CanonicalSpecV2IrCompilerService().compile({
    canonicalSpec,
    fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '1h', positionPct: 10 },
  }).ir
  const ast = new CanonicalStrategyAstCompilerService().compile(ir)
  const scriptCode = new CompiledScriptEmitterService().emit({
    ast,
    executionEnvelope: {
      positionMode: 'long_only',
      marginMode: 'cash',
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
      fillAssumption: 'strict',
    },
  })

  const report = new StrategyConsistencyService(new ScriptProfileExtractorService()).evaluate({
    canonicalSpec,
    scriptCode,
  })

  expect(report.status).toBe('PASSED')
  expect(JSON.stringify(report.checks)).not.toContain('脚本缺少关键动作: FORCE_EXIT')
  expect(JSON.stringify(report.checks)).not.toContain('脚本缺少关键动作: CLOSE_LONG')
})
```

Add imports from existing test helpers or direct services:

```ts
import { buildLockedAtomicState } from './fixtures/semantic-state-golden-cases'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { ScriptProfileExtractorService } from '../script-profile-extractor.service'
import { StrategyConsistencyService } from '../strategy-consistency.service'
```

- [ ] **Step 2: Run the focused test to verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-consistency.service.spec.ts -t "ATR risk predicates"
```

Expected: FAIL with missing action or rule mapping similar to the reported `CONSISTENCY_FAILED`.

- [ ] **Step 3: Include risk predicates in script profile actions and rules**

In `strategy-consistency.service.ts`, update `projectionToProfile`:

```ts
for (const riskPredicate of projection.riskPredicates ?? []) {
  const normalizedAction = this.normalizeRiskPredicateAction(riskPredicate.payload.kind)
  if (!normalizedAction) continue
  pushRule({
    key: this.inferRuleKeyFromRiskPredicate(riskPredicate.payload.kind),
    action: normalizedAction,
    phase: 'risk',
    sideScope: this.resolveRuleSideScope('both', normalizedAction),
  })
}
```

Add helpers:

```ts
private normalizeRiskPredicateAction(kind: string | undefined): CanonicalAction | null {
  if (kind === 'atrMultipleStop' || kind === 'rememberedLevelStop') return 'FORCE_EXIT'
  if (kind === 'atrMultipleTakeProfit') return 'CLOSE_LONG'
  return null
}

private inferRuleKeyFromRiskPredicate(kind: string | undefined): StrategySemanticRuleKey {
  if (kind === 'atrMultipleStop') return 'risk.atr_multiple_stop'
  if (kind === 'atrMultipleTakeProfit') return 'risk.atr_multiple_take_profit'
  if (kind === 'rememberedLevelStop') return 'risk.remembered_level_stop'
  return 'risk.unknown'
}
```

Also include risk predicate actions in the `actions` array:

```ts
...(projection.riskPredicates ?? [])
  .map(predicate => this.normalizeRiskPredicateAction(predicate.payload.kind))
  .filter((action): action is CanonicalAction => action !== null),
```

If `StrategySemanticRuleKey` does not include the new risk keys, extend `apps/quantify/src/modules/llm-strategy-codegen/types/strategy-semantic-profile.ts` with:

```ts
| 'risk.atr_multiple_stop'
| 'risk.atr_multiple_take_profit'
| 'risk.remembered_level_stop'
```

- [ ] **Step 4: Ensure anyOf/OR child predicates are recursively mapped**

In `collectRuleKeysFromProjectionExpr`, treat `allOf` and `anyOf` like `AND` and `OR`:

```ts
if (kind === 'AND' || kind === 'OR' || kind === 'NOT' || kind === 'allOf' || kind === 'anyOf') {
  const key = this.inferRuleKeyFromPredicate({
    predicateKind: kind,
    predicateId: expr.sourceRef,
  })
  return [
    ...(key ? [key] : []),
    ...expr.deps.flatMap(childId => this.collectRuleKeysFromProjectionExpr(childId, exprsById, visited)),
  ]
}
```

- [ ] **Step 5: Run consistency tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-consistency.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-script-emitter.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/strategy-consistency.service.ts apps/quantify/src/modules/llm-strategy-codegen/types/strategy-semantic-profile.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-consistency.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-script-emitter.spec.ts
git commit -F - <<'MSG'
fix: align consistency with semantic risk predicates

变更说明：
- consistency 将 riskPredicates 识别为 risk 原子 effect 承接
- allOf/anyOf 组合 predicate 支持递归规则映射
- 修复 ATR 与 remembered-level 风控被误判缺动作的问题

Refs: #981
MSG
```

---

### Task 5: End-To-End Regressions For Four Reported Strategies

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts`

- [ ] **Step 1: Add end-to-end acceptance tests**

Append to `semantic-only-strategy-regression.spec.ts`:

```ts
describe('reported combination strategy acceptance', () => {
  it('publishes EMA stack entry as one AND entry rule', async () => {
    const state = withLockedMarketContext(
      buildSemanticStateFromMessage('入场：15m k线里面 价格在ema20 ema60 ema144上方时做多开仓；出场：15m k线里价格低于EMA20平多；止损：5%强制平仓；仓位：10usdt'),
      { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '15m' },
    )
    const result = await generateAndPublish('reported-ema-stack', state)
    const entryRules = result.canonicalSpec.rules.filter(rule => rule.phase === 'entry')
    expect(entryRules).toHaveLength(1)
    expect(entryRules[0]?.condition).toEqual(expect.objectContaining({ kind: 'AND' }))
    expect(entryRules[0]?.actions).toEqual([expect.objectContaining({ type: 'OPEN_LONG' })])
  })

  it('publishes MA20 breakout with ATR stop and take-profit', async () => {
    const state = withLockedMarketContext(
      buildSemanticStateFromMessage('ETH 1小时突破 MA20 买入，止损设为 2 倍 ATR，盈利达到 3 倍 ATR 后止盈。'),
      { exchange: 'okx', symbol: 'ETHUSDT', marketType: 'perp', timeframe: '1h' },
    )
    const result = await generateAndPublish('reported-atr-risk', state)
    expect(ruleActionTypes(result.canonicalSpec)).toContain('OPEN_LONG')
    expect(result.canonicalSpec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ condition: expect.objectContaining({ key: 'risk.atr_multiple_stop' }) }),
      expect.objectContaining({ condition: expect.objectContaining({ key: 'risk.atr_multiple_take_profit' }) }),
    ]))
  })

  it('publishes breakout retest with remembered breakout level stop', async () => {
    const state = withLockedMarketContext(
      buildSemanticStateFromMessage('BTC 突破过去 24 小时高点后不立刻买，等回踩不破突破位再买，跌回突破位下方止损。'),
      { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '1h' },
    )
    const result = await generateAndPublish('reported-breakout-retest', state)
    expect(result.canonicalSpec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ condition: expect.objectContaining({ key: 'risk.remembered_level_stop' }) }),
    ]))
  })

  it('publishes MA100 gate plus MACD entry with OR exits', async () => {
    const state = withLockedMarketContext(
      buildSemanticStateFromMessage('SOL 30分钟价格在 MA100 上方，MACD 金叉买入；跌破 MA100 或 MACD 死叉卖出。5%止损'),
      { exchange: 'okx', symbol: 'SOLUSDT', marketType: 'perp', timeframe: '30m' },
    )
    const result = await generateAndPublish('reported-macd-or-exit', state)
    const entryRules = result.canonicalSpec.rules.filter(rule => rule.phase === 'entry')
    const exitRules = result.canonicalSpec.rules.filter(rule => rule.phase === 'exit')
    expect(entryRules).toEqual(expect.arrayContaining([
      expect.objectContaining({ condition: expect.objectContaining({ kind: 'AND' }) }),
    ]))
    expect(exitRules).toEqual(expect.arrayContaining([
      expect.objectContaining({ condition: expect.objectContaining({ kind: 'OR' }) }),
    ]))
  })
})
```

If helper functions are scoped inside the parent `describe`, place this new `describe` inside the same parent scope so it can use `buildSemanticStateFromMessage`, `withLockedMarketContext`, `generateAndPublish`, and `ruleActionTypes`.

- [ ] **Step 2: Run the new acceptance tests to verify failure or partial failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts -t "reported combination strategy acceptance"
```

Expected before prior tasks are complete: FAIL. Expected after Tasks 1-4: PASS.

- [ ] **Step 3: Add singleton regression tests**

Append to the same file:

```ts
describe('singleton strategy acceptance under contract group model', () => {
  it('keeps simple MACD cross strategy as singleton entry and exit rules', async () => {
    const state = withLockedMarketContext(
      buildSemanticStateFromMessage('BTC 1小时 MACD 金叉买入，MACD 死叉卖出，仓位 10%。'),
      { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '1h' },
    )
    const result = await generateAndPublish('singleton-macd-cross', state)
    expect(result.canonicalSpec.rules.filter(rule => rule.phase === 'entry')).toHaveLength(1)
    expect(result.canonicalSpec.rules.filter(rule => rule.phase === 'exit')).toHaveLength(1)
  })
})
```

- [ ] **Step 4: Run the regression tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts -t "reported combination strategy acceptance|singleton strategy acceptance"
```

Expected: PASS.

- [ ] **Step 5: Run focused full suite for codegen services**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-trigger-combination-contract.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-combination-semantics.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-consistency.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts -t "reported combination strategy acceptance|singleton strategy acceptance"
```

Expected: all PASS.

- [ ] **Step 6: Run lint**

Run:

```bash
dx lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts
git commit -F - <<'MSG'
test: cover reported combination strategy publication

变更说明：
- 增加四个组合策略发布验收回归
- 增加简单单腿 singleton group 回归
- 确认组合修复不拆分单腿和组合语义流

Refs: #981
MSG
```

---

## Final Verification

- [ ] Run all focused verification:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-trigger-combination-contract.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-combination-semantics.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-consistency.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts -t "reported combination strategy acceptance|singleton strategy acceptance"
dx lint
```

- [ ] Confirm `git status --short` is clean.

- [ ] Prepare PR summary with:

```markdown
## 变更说明
- 统一 simple singleton 与组合策略的 trigger contract group 编译模型
- 补齐 AND/OR/gate/actionBinding 到 CanonicalSpec/IR/compiled consistency 的承接
- 修复 ATR / remembered-level riskPredicates 被误判缺 FORCE_EXIT/CLOSE_LONG 的一致性问题

## 验证
- dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-trigger-combination-contract.service.spec.ts
- dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts
- dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-combination-semantics.spec.ts
- dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-consistency.service.spec.ts
- dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts -t "reported combination strategy acceptance|singleton strategy acceptance"
- dx lint

Refs: #981
```

---

## Self-Review

- Spec coverage: The plan covers contract normalization, singleton group compilation, explicit AND/OR groups, gate attachment, risk predicate effects, the four reported strategies, and simple strategy regressions.
- Placeholder scan: No `TBD`, `TODO`, or vague implementation-only tasks remain. Each code-changing task includes concrete tests, implementation snippets, commands, and expected results.
- Type consistency: The plan consistently uses `SemanticTriggerCombinationDescriptor`, `groupId`, `join`, `actionKey`, `actionBinding`, `SemanticState`, `CanonicalSpecBuilderService`, and existing compiled projection names.
