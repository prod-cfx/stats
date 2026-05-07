# AI Quant Phase 0 Contract Substrate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade AI Quant Phase 0 so supported atomic semantic contracts must declare explicit runtime/state/order/open-slot substrate, readiness fails closed without legacy compatibility fallback, and the coverage corpus becomes the baseline for #984.

**Architecture:** Keep `SemanticState.triggers/actions/risk/position/contextSlots` as the source of truth and add a thin non-executable `orchestration` boundary. Make contract substrate validation part of `SemanticContractReadinessService`, migrate currently supported atom contract fixtures/builders to explicit substrate arrays, and upgrade the existing corpus fixture/spec instead of creating a parallel corpus path.

**Tech Stack:** NestJS 11, TypeScript 5.9, Jest via `dx test unit quantify`, Nx via `dx`, existing `llm-strategy-codegen` semantic services.

---

## File Structure

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`
  - Owns the canonical TypeScript shape for semantic contracts, requirement substrate, and orchestration state.

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-registry.service.ts`
  - Keeps atom support classification and gains explicit substrate metadata for supported atom definitions.

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-atom-support.ts`
  - Adds registry-level substrate metadata so corpus tests can assert supported atoms have a substrate declaration.

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`
  - Enforces substrate presence for supported owners, merges contract open slots, checks runtime/state/order requirements, and blocks locked orchestration nodes.

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts`
  - Drives readiness behavior with failing tests first.

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/atom-coverage-golden-cases.ts`
  - Upgrades the existing corpus fixture from message/key-only expectations to route/tag/expected atom/substrate expectations.

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atom-coverage-golden-corpus.spec.ts`
  - Keeps current extractor/classifier coverage and adds Phase 0 corpus metadata/substrate assertions.

- Modify existing tests that construct `SemanticAtomContract` literals:
  - `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/**/*.spec.ts`
  - Only update literals touched by type errors or readiness assertions. Do not change unrelated behavior.

---

### Task 1: Add Contract Substrate And Orchestration Types

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts`

- [ ] **Step 1: Write the failing type-focused readiness test**

Append this test near the top of `semantic-contract-readiness.service.spec.ts`, after the `describe` line. It references substrate fields and orchestration state before the production types and service support them.

```ts
  it('accepts supported contracts with explicit empty substrate arrays', () => {
    const state = createSemanticState({
      triggers: [{
        id: 'trigger-1',
        key: 'condition.expression',
        phase: 'entry',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        support: { supportStatus: 'supported_executable' },
        contracts: [{
          id: 'trigger-contract-1',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
      actions: [{
        id: 'action-1',
        key: 'open_long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        support: { supportStatus: 'supported_executable' },
        contracts: [{
          id: 'action-contract-1',
          kind: 'action',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [],
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(true)
    expect(result.missingRequirements).toEqual([])
  })
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts -t "accepts supported contracts with explicit empty substrate arrays"
```

Expected: FAIL with TypeScript errors because `runtimeRequirements`, `stateRequirements`, `orderRequirements`, or orchestration-related types are not defined on `SemanticAtomContract`.

- [ ] **Step 3: Add substrate and orchestration types**

Edit `semantic-state.ts`. Replace the existing `SemanticContractKind` / domain / requirement area with these definitions, keeping existing exported names intact:

```ts
export type SemanticContractKind = 'trigger' | 'action' | 'risk' | 'position' | 'context'
export type SemanticOrchestrationContractKind = 'scope' | 'gate' | 'program' | 'portfolioRisk'
export type SemanticCapabilityDomain =
  | 'market'
  | 'price'
  | 'order_program'
  | 'capital'
  | 'exposure'
  | 'margin'
  | 'guard'
  | 'runtime'
  | 'state'
  | 'order'
  | 'portfolio'
  | 'orchestration'
```

Below `SemanticRequirement`, add:

```ts
export interface SemanticRuntimeRequirement extends SemanticRequirement {
  shape?: SemanticCapabilityShape
}

export interface SemanticStateRequirement extends SemanticRequirement {
  shape?: SemanticCapabilityShape
}

export interface SemanticOrderRequirement extends SemanticRequirement {
  shape?: SemanticCapabilityShape
}
```

Replace `SemanticAtomContract` with:

```ts
export interface SemanticAtomContract {
  id: string
  kind: SemanticContractKind
  capabilities: readonly SemanticCapability[]
  requires: readonly SemanticRequirement[]
  params: Record<string, unknown>
  effects?: readonly SemanticEffect[]
  runtimeRequirements: readonly SemanticRuntimeRequirement[]
  stateRequirements: readonly SemanticStateRequirement[]
  orderRequirements: readonly SemanticOrderRequirement[]
  openSlots: readonly SemanticSlotState[]
}
```

Add orchestration node types below `SemanticPositionState`:

```ts
export interface SemanticOrchestrationContract {
  id: string
  kind: SemanticOrchestrationContractKind
  target: Record<string, unknown>
  params: Record<string, unknown>
  requires: readonly SemanticRequirement[]
  effects?: readonly SemanticEffect[]
  runtimeRequirements: readonly SemanticRuntimeRequirement[]
  stateRequirements: readonly SemanticStateRequirement[]
  orderRequirements: readonly SemanticOrderRequirement[]
  openSlots: readonly SemanticSlotState[]
}

export interface SemanticOrchestrationNode {
  id: string
  key: string
  kind: SemanticOrchestrationContractKind
  status: SemanticNodeStatus
  source: SemanticSource
  target: Record<string, unknown>
  params: Record<string, unknown>
  evidence?: SemanticEvidence
  openSlots: SemanticSlotState[]
  contracts: readonly SemanticOrchestrationContract[]
  support?: SemanticAtomSupportMetadata
}

export interface SemanticOrchestrationState {
  scopes: SemanticOrchestrationNode[]
  gates: SemanticOrchestrationNode[]
  programs: SemanticOrchestrationNode[]
  portfolioRisk: SemanticOrchestrationNode[]
}
```

Add `orchestration?: SemanticOrchestrationState` to `SemanticState` before `normalizationNotes`.

- [ ] **Step 4: Run the focused test again**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts -t "accepts supported contracts with explicit empty substrate arrays"
```

Expected: FAIL may continue because existing contract literals elsewhere now need explicit substrate arrays. That is expected at this step.

- [ ] **Step 5: Commit Task 1**

Stage only the type file and the new test if it compiles far enough to be useful:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts
git commit -F - <<'MSG'
feat: define AI Quant contract substrate types

变更说明：
- 为 SemanticAtomContract 增加 runtime/state/order/openSlots substrate
- 增加薄 orchestration 语义类型边界
- 添加 supported contract 显式空 substrate 的 readiness 用例

Refs: #984
MSG
```

---

### Task 2: Migrate Existing Contract Literals To Explicit Substrate

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/**/*.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/**/*.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/**/*.spec.ts` if TypeScript reports contract literals there

- [ ] **Step 1: Run TypeScript through the focused unit test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts
```

Expected: FAIL with TypeScript errors on `SemanticAtomContract` literals missing `runtimeRequirements`, `stateRequirements`, `orderRequirements`, and `openSlots`.

- [ ] **Step 2: Update readiness spec contract literals**

In `semantic-contract-readiness.service.spec.ts`, add explicit empty substrate arrays to every contract object that currently lacks them:

```ts
runtimeRequirements: [],
stateRequirements: [],
orderRequirements: [],
openSlots: [],
```

For existing tests that should exercise open slot behavior, put the slot on `contract.openSlots` instead of only on owner `openSlots` when the test is about contract-driven slots.

- [ ] **Step 3: Update production contract builders**

Search for contract literals:

```bash
rg -n "contracts:\\s*\\[|kind: 'trigger'|kind: 'action'|kind: 'risk'|kind: 'position'" apps/quantify/src/modules/llm-strategy-codegen
```

For each production `SemanticAtomContract` builder, add the same explicit arrays. Example:

```ts
contracts: [{
  id: 'risk-contract-stop-loss',
  kind: 'risk',
  capabilities: [],
  requires: [],
  params: risk.params,
  runtimeRequirements: [],
  stateRequirements: [],
  orderRequirements: [],
  openSlots: [],
}]
```

If a contract already encodes a runtime fact in `requires`, do not infer a new runtime requirement from loose params in this task. Add an empty substrate first; explicit non-empty substrate comes in Task 6 for registry-backed cases.

- [ ] **Step 4: Update remaining test fixtures**

For each TypeScript error from tests/fixtures, add explicit arrays to contract literals. Use this exact helper locally inside large spec files only if it reduces repetitive fixture noise:

```ts
const emptyContractSubstrate = {
  runtimeRequirements: [],
  stateRequirements: [],
  orderRequirements: [],
  openSlots: [],
} as const
```

Then spread it inside fixture contracts:

```ts
contracts: [{
  id: 'trigger-contract-1',
  kind: 'trigger',
  capabilities: [],
  requires: [],
  params: {},
  ...emptyContractSubstrate,
}]
```

Do not export a shared helper unless at least three files need the same helper; local helpers keep the blast radius small.

- [ ] **Step 5: Run the readiness spec**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts
```

Expected: PASS or runtime failures that are specifically about the new readiness behavior. TypeScript missing-field errors should be gone.

- [ ] **Step 6: Commit Task 2**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen
git commit -F - <<'MSG'
refactor: migrate semantic contracts to explicit substrate

变更说明：
- 为现有 semantic contract literals 补齐显式 substrate arrays
- 保持已跑通单策略语义走新 contract 形态
- 不新增 legacy fallback mapper

Refs: #984
MSG
```

---

### Task 3: Enforce Substrate Presence In Readiness

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts`

- [ ] **Step 1: Add failing tests for missing substrate and contract open slots**

Append these tests to `semantic-contract-readiness.service.spec.ts`:

```ts
  it('fails supported owners whose contracts omit substrate arrays', () => {
    const legacyContract = {
      id: 'legacy-trigger-contract',
      kind: 'trigger' as const,
      capabilities: [],
      requires: [],
      params: {},
    }
    const state = createSemanticState({
      triggers: [{
        id: 'trigger-legacy',
        key: 'condition.expression',
        phase: 'entry',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        support: { supportStatus: 'supported_executable' },
        contracts: [legacyContract as never],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.state.triggers[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'contract.substrate.missing',
        fieldPath: 'triggers[trigger-legacy].contracts[legacy-trigger-contract]',
        affectsExecution: true,
        status: 'open',
      }),
    ])
  })

  it('merges execution-affecting contract open slots into the owner', () => {
    const state = createSemanticState({
      risk: [{
        id: 'risk-1',
        key: 'risk.falling_knife_guard',
        params: {},
        status: 'locked',
        source: 'derived',
        openSlots: [],
        support: { supportStatus: 'supported_requires_slot' },
        contracts: [{
          id: 'risk-contract-1',
          kind: 'risk',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [],
          stateRequirements: [],
          orderRequirements: [],
          openSlots: [{
            slotKey: 'risk.falling_knife_guard.definition',
            fieldPath: 'risk[risk-1].params.definition',
            status: 'open',
            priority: 'risk',
            affectsExecution: true,
            questionHint: '请确认“不接飞刀”的判定方式。',
          }],
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.state.risk[0]).toEqual(expect.objectContaining({
      status: 'open',
      openSlots: [expect.objectContaining({
        slotKey: 'risk.falling_knife_guard.definition',
      })],
    }))
  })
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts -t "fails supported owners whose contracts omit substrate arrays|merges execution-affecting contract open slots"
```

Expected: FAIL because readiness does not yet validate missing substrate or merge contract `openSlots`.

- [ ] **Step 3: Add substrate diagnostics to readiness result internals**

In `semantic-contract-readiness.service.ts`, extend `SemanticContractOwnerRef` contract handling with a local missing-substrate slot builder. Add this helper near `buildMissingRequirementSlots`:

```ts
function buildMissingSubstrateSlots(
  owners: readonly SemanticContractOwnerRef[],
): Map<string, SemanticSlotState[]> {
  const slotsByOwnerKey = new Map<string, SemanticSlotState[]>()

  for (const owner of owners) {
    for (const contract of owner.contracts) {
      if (hasContractSubstrate(contract)) continue

      const key = ownerKey(owner.ownerKind, owner.ownerId)
      const slots = slotsByOwnerKey.get(key) ?? []
      slots.push({
        slotKey: 'contract.substrate.missing',
        fieldPath: buildContractFieldPath(owner.ownerKind, owner.ownerId, contract.id),
        status: 'open',
        priority: 'behavior',
        affectsExecution: true,
        questionHint: '当前 supported atom 缺少 runtime/state/order/openSlots contract substrate，需先迁移 contract 后才能部署。',
        evidence: {
          source: 'derived',
          text: `Missing semantic contract substrate ${contract.id}`,
        },
      })
      slotsByOwnerKey.set(key, slots)
    }
  }

  return slotsByOwnerKey
}

function hasContractSubstrate(contract: SemanticAtomContract): boolean {
  const candidate = contract as Partial<SemanticAtomContract>
  return Array.isArray(candidate.runtimeRequirements)
    && Array.isArray(candidate.stateRequirements)
    && Array.isArray(candidate.orderRequirements)
    && Array.isArray(candidate.openSlots)
}

function buildContractFieldPath(
  ownerKind: SemanticContractOwnerKind,
  ownerId: string,
  contractId: string,
): string {
  if (ownerKind === 'position') {
    return `position.contracts[${contractId}]`
  }

  return `${ownerCollection(ownerKind)}[${ownerId}].contracts[${contractId}]`
}
```

- [ ] **Step 4: Merge substrate and contract open slots in `normalize()`**

In `normalize()`, after `supportedOwners` and `providerNormalization`, build and merge these slot maps:

```ts
const missingSubstrateSlots = buildMissingSubstrateSlots(supportedOwners)
const contractOpenSlots = buildContractOpenSlotMap(supportedOwners)
const slotsByOwnerKey = mergeSlotMaps(
  providerNormalization.shapeSlotsByOwnerKey,
  buildMissingRequirementSlots(missingRequirements),
  missingSubstrateSlots,
  contractOpenSlots,
)
```

Add helper:

```ts
function buildContractOpenSlotMap(
  owners: readonly SemanticContractOwnerRef[],
): Map<string, SemanticSlotState[]> {
  const slotsByOwnerKey = new Map<string, SemanticSlotState[]>()

  for (const owner of owners) {
    const slots = owner.contracts.flatMap(contract => contract.openSlots ?? [])
    if (!slots.length) continue
    slotsByOwnerKey.set(ownerKey(owner.ownerKind, owner.ownerId), slots)
  }

  return slotsByOwnerKey
}
```

Do not include unsupported owners in these maps; unsupported remains fail-closed without user-fillable readiness slots.

- [ ] **Step 5: Run the readiness spec**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts
git commit -F - <<'MSG'
feat: fail closed on missing semantic contract substrate

变更说明：
- supported atom 缺 runtime/state/order/openSlots substrate 时阻断 readiness
- contract openSlots 合并到 owner openSlots
- unsupported atom 继续 fail-closed 且不生成可填写 openSlot

Refs: #984
MSG
```

---

### Task 4: Add Runtime, State, Order Requirement Evaluation

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts`

- [ ] **Step 1: Add failing tests for satisfied and unsatisfied substrate requirements**

Append:

```ts
  it('accepts known runtime state and order requirements', () => {
    const state = createSemanticState({
      triggers: [{
        id: 'trigger-1',
        key: 'indicator.cross_over',
        phase: 'entry',
        params: {},
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        support: { supportStatus: 'supported_executable' },
        contracts: [{
          id: 'trigger-contract-1',
          kind: 'trigger',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [
            { domain: 'runtime', verb: 'provide', object: 'bar_ohlcv' },
            { domain: 'runtime', verb: 'provide', object: 'indicator_helper', shape: { name: 'sma' } },
          ],
          stateRequirements: [],
          orderRequirements: [
            { domain: 'order', verb: 'support', object: 'market_order' },
          ],
          openSlots: [],
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(true)
  })

  it('fails closed on unknown runtime state and order requirements', () => {
    const state = createSemanticState({
      actions: [{
        id: 'action-1',
        key: 'action.grid_ladder',
        status: 'locked',
        source: 'derived',
        openSlots: [],
        support: { supportStatus: 'supported_executable' },
        contracts: [{
          id: 'action-contract-1',
          kind: 'action',
          capabilities: [],
          requires: [],
          params: {},
          runtimeRequirements: [
            { domain: 'runtime', verb: 'provide', object: 'orderbook_depth' },
          ],
          stateRequirements: [
            { domain: 'state', verb: 'write', object: 'grid_anchor' },
          ],
          orderRequirements: [
            { domain: 'order', verb: 'support', object: 'cancel_replace_ladder' },
          ],
          openSlots: [],
        }],
      }],
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.state.actions[0].openSlots).toEqual([
      expect.objectContaining({ slotKey: 'contract.runtime_requirement.runtime.provide.orderbook_depth' }),
      expect.objectContaining({ slotKey: 'contract.state_requirement.state.write.grid_anchor' }),
      expect.objectContaining({ slotKey: 'contract.order_requirement.order.support.cancel_replace_ladder' }),
    ])
  })
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts -t "known runtime state and order requirements|unknown runtime state and order requirements"
```

Expected: FAIL because substrate requirement evaluation does not exist.

- [ ] **Step 3: Implement minimal requirement support sets**

In `semantic-contract-readiness.service.ts`, add support predicates near `hasRequiredCapabilityShape`:

```ts
const SUPPORTED_RUNTIME_REQUIREMENTS = new Set([
  'runtime.provide.bar_ohlcv',
  'runtime.provide.indicator_helper',
  'runtime.provide.compiled_predicate_runtime',
])

const SUPPORTED_STATE_REQUIREMENTS = new Set([
  'state.read.none',
  'state.write.none',
  'state.read.sequence_state',
  'state.write.sequence_state',
  'state.read.remembered_level',
  'state.write.remembered_level',
])

const SUPPORTED_ORDER_REQUIREMENTS = new Set([
  'order.support.market_order',
  'order.support.close_position',
  'order.support.reduce_position',
])
```

Add:

```ts
function requirementKey(requirement: SemanticRequirement): string {
  return `${requirement.domain}.${requirement.verb}.${requirement.object}`
}

function isSupportedRuntimeRequirement(requirement: SemanticRequirement): boolean {
  return SUPPORTED_RUNTIME_REQUIREMENTS.has(requirementKey(requirement))
}

function isSupportedStateRequirement(requirement: SemanticRequirement): boolean {
  return SUPPORTED_STATE_REQUIREMENTS.has(requirementKey(requirement))
}

function isSupportedOrderRequirement(requirement: SemanticRequirement): boolean {
  return SUPPORTED_ORDER_REQUIREMENTS.has(requirementKey(requirement))
}
```

- [ ] **Step 4: Build requirement open slots**

Add:

```ts
function buildUnsupportedSubstrateRequirementSlots(
  owners: readonly SemanticContractOwnerRef[],
): Map<string, SemanticSlotState[]> {
  const slotsByOwnerKey = new Map<string, SemanticSlotState[]>()

  for (const owner of owners) {
    const slots: SemanticSlotState[] = []
    for (const contract of owner.contracts) {
      for (const requirement of contract.runtimeRequirements ?? []) {
        if (!isSupportedRuntimeRequirement(requirement)) {
          slots.push(toSubstrateRequirementSlot(owner, contract.id, 'runtime_requirement', requirement))
        }
      }
      for (const requirement of contract.stateRequirements ?? []) {
        if (!isSupportedStateRequirement(requirement)) {
          slots.push(toSubstrateRequirementSlot(owner, contract.id, 'state_requirement', requirement))
        }
      }
      for (const requirement of contract.orderRequirements ?? []) {
        if (!isSupportedOrderRequirement(requirement)) {
          slots.push(toSubstrateRequirementSlot(owner, contract.id, 'order_requirement', requirement))
        }
      }
    }

    if (slots.length) {
      slotsByOwnerKey.set(ownerKey(owner.ownerKind, owner.ownerId), slots)
    }
  }

  return slotsByOwnerKey
}

function toSubstrateRequirementSlot(
  owner: SemanticContractOwnerRef,
  contractId: string,
  requirementKind: 'runtime_requirement' | 'state_requirement' | 'order_requirement',
  requirement: SemanticRequirement,
): SemanticSlotState {
  const key = requirementKey(requirement)
  return {
    slotKey: `contract.${requirementKind}.${key}`,
    fieldPath: `${buildContractFieldPath(owner.ownerKind, owner.ownerId, contractId)}.${requirementKind}.${key}`,
    status: 'open',
    priority: requirementKind === 'order_requirement' ? 'risk' : 'behavior',
    affectsExecution: true,
    questionHint: `当前执行环境不满足 ${key}，需补齐 runtime/order/state 能力后才能部署。`,
    evidence: {
      source: 'derived',
      text: `Unsupported semantic contract ${requirementKind} ${contractId}: ${key}`,
    },
  }
}
```

Merge it into `slotsByOwnerKey` in `normalize()` after missing substrate slots.

- [ ] **Step 5: Run the readiness spec**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts
git commit -F - <<'MSG'
feat: gate semantic readiness on substrate requirements

变更说明：
- 增加 runtime/state/order requirement 最小 evaluator
- 未满足 substrate requirement 时 owner 进入 execution blocker
- 保持 Phase 0 fail-closed，不推断旧字段

Refs: #984
MSG
```

---

### Task 5: Block Locked Orchestration Nodes In Phase 0

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts`

- [ ] **Step 1: Add failing orchestration tests**

Append:

```ts
  it('blocks locked orchestration nodes because Phase 0 has no orchestration runtime', () => {
    const state = createSemanticState({
      orchestration: {
        scopes: [{
          id: 'scope-1',
          key: 'orchestration.scope.symbol',
          kind: 'scope',
          status: 'locked',
          source: 'user_explicit',
          target: { symbol: 'BTCUSDT' },
          params: {},
          openSlots: [],
          contracts: [{
            id: 'scope-contract-1',
            kind: 'scope',
            target: { symbol: 'BTCUSDT' },
            params: {},
            requires: [],
            runtimeRequirements: [],
            stateRequirements: [],
            orderRequirements: [],
            openSlots: [],
          }],
        }],
        gates: [],
        programs: [],
        portfolioRisk: [],
      },
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.state.orchestration?.scopes[0].openSlots).toEqual([
      expect.objectContaining({
        slotKey: 'orchestration.phase0.unsupported',
        affectsExecution: true,
        status: 'open',
      }),
    ])
  })

  it('does not block draft orchestration nodes that are still open', () => {
    const state = createSemanticState({
      orchestration: {
        scopes: [{
          id: 'scope-draft',
          key: 'orchestration.scope.symbol',
          kind: 'scope',
          status: 'open',
          source: 'user_explicit',
          target: {},
          params: {},
          openSlots: [{
            slotKey: 'orchestration.scope.symbol',
            fieldPath: 'orchestration.scopes[scope-draft].target.symbol',
            status: 'open',
            priority: 'context',
            affectsExecution: true,
            questionHint: '请确认作用域 symbol。',
          }],
          contracts: [],
        }],
        gates: [],
        programs: [],
        portfolioRisk: [],
      },
    })

    const result = new SemanticContractReadinessService().normalize(state)

    expect(result.ready).toBe(false)
    expect(result.state.orchestration?.scopes[0].openSlots).toEqual([
      expect.objectContaining({ slotKey: 'orchestration.scope.symbol' }),
    ])
  })
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts -t "orchestration"
```

Expected: FAIL because readiness does not inspect `state.orchestration`.

- [ ] **Step 3: Add orchestration normalization**

In `normalize()`, after owner normalization, build `orchestrationResult` before `nextState` and include it in `nextState`. The final object should keep the existing trigger/action/risk/position normalization and add orchestration like this:

```ts
const orchestrationResult = normalizePhase0Orchestration(state.orchestration)
const nextState: SemanticState = {
  ...state,
  triggers: state.triggers.map(trigger =>
    mergeOwnerOpenSlots(trigger, slotsByOwnerKey.get(ownerKey('trigger', trigger.id))),
  ),
  actions: state.actions.map(action =>
    mergeOwnerOpenSlots(action, slotsByOwnerKey.get(ownerKey('action', action.id))),
  ),
  risk: state.risk.map(risk =>
    mergeOwnerOpenSlots(risk, slotsByOwnerKey.get(ownerKey('risk', risk.id))),
  ),
  position: state.position
    ? mergeOwnerOpenSlots(state.position, slotsByOwnerKey.get(ownerKey('position', positionOwnerId())))
    : null,
  ...(orchestrationResult.state ? { orchestration: orchestrationResult.state } : {}),
}
```

Add helper:

```ts
function normalizePhase0Orchestration(
  orchestration: SemanticState['orchestration'],
): { state?: SemanticState['orchestration']; hasBlockingSlots: boolean } {
  if (!orchestration) return { hasBlockingSlots: false }

  const next = {
    scopes: orchestration.scopes.map(addPhase0OrchestrationBlocker),
    gates: orchestration.gates.map(addPhase0OrchestrationBlocker),
    programs: orchestration.programs.map(addPhase0OrchestrationBlocker),
    portfolioRisk: orchestration.portfolioRisk.map(addPhase0OrchestrationBlocker),
  }

  return {
    state: next,
    hasBlockingSlots: [...next.scopes, ...next.gates, ...next.programs, ...next.portfolioRisk]
      .some(node => node.openSlots.some(isBlockingSemanticOpenSlot)),
  }
}

function addPhase0OrchestrationBlocker<T extends {
  id: string
  kind: string
  status: SemanticNodeStatus
  openSlots: SemanticSlotState[]
}>(node: T): T {
  if (node.status !== 'locked') return node

  const blocker: SemanticSlotState = {
    slotKey: 'orchestration.phase0.unsupported',
    fieldPath: `orchestration.${node.kind}[${node.id}]`,
    status: 'open',
    priority: 'context',
    affectsExecution: true,
    questionHint: 'Phase 0 仅定义 orchestration contract 草案，尚未接入 runtime，不能部署执行。',
    evidence: {
      source: 'derived',
      text: `Locked orchestration node is not executable in Phase 0: ${node.id}`,
    },
  }
  const ids = new Set(node.openSlots.map(buildSemanticSlotId))
  if (ids.has(buildSemanticSlotId(blocker))) return node

  return {
    ...node,
    status: 'open',
    openSlots: [...node.openSlots, blocker],
  }
}
```

Include `orchestrationResult.hasBlockingSlots` in `ready`:

```ts
ready: unsupportedOrUnknownOwnerKeys.size === 0
  && missingRequirements.length === 0
  && !hasOpenSlots(providerNormalization.shapeSlotsByOwnerKey)
  && !hasBlockingOwnerOpenSlots(nextState)
  && !orchestrationResult.hasBlockingSlots
```

- [ ] **Step 4: Run orchestration tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts -t "orchestration"
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts
git commit -F - <<'MSG'
feat: block orchestration deployment in phase 0

变更说明：
- locked orchestration node 在 Phase 0 自动进入 execution blocker
- open 草案态 orchestration 保持 open slot，不误接入旧单策略 runtime
- 明确 orchestration 只定义 contract 边界，不可部署

Refs: #984
MSG
```

---

### Task 6: Add Registry Substrate Metadata

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-atom-support.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-registry.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-registry.service.spec.ts`

- [ ] **Step 1: Add failing registry tests**

In `semantic-atom-registry.service.spec.ts`, add:

```ts
  it('requires supported atoms to declare phase 0 substrate metadata', () => {
    const supportedAtoms = service.list().filter(atom =>
      atom.supportStatus === 'supported_executable'
      || atom.supportStatus === 'supported_requires_slot',
    )

    expect(supportedAtoms.length).toBeGreaterThan(0)
    for (const atom of supportedAtoms) {
      expect(atom.contractSubstrate).toEqual({
        runtimeRequirements: expect.any(Array),
        stateRequirements: expect.any(Array),
        orderRequirements: expect.any(Array),
        openSlots: expect.any(Array),
      })
    }
  })
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-registry.service.spec.ts -t "phase 0 substrate metadata"
```

Expected: FAIL because `SemanticAtomDefinition` has no `contractSubstrate`.

- [ ] **Step 3: Extend registry type**

In `semantic-atom-support.ts`, add:

```ts
import type {
  SemanticOrderRequirement,
  SemanticRuntimeRequirement,
  SemanticStateRequirement,
} from './semantic-state'
```

Extend `SemanticAtomDefinition`:

```ts
contractSubstrate?: {
  runtimeRequirements: readonly SemanticRuntimeRequirement[]
  stateRequirements: readonly SemanticStateRequirement[]
  orderRequirements: readonly SemanticOrderRequirement[]
  openSlots: readonly SemanticAtomOpenSlotSpec[]
}
```

- [ ] **Step 4: Add default substrate helpers in registry**

In `semantic-atom-registry.service.ts`, add:

```ts
const BASE_EXECUTABLE_SUBSTRATE: NonNullable<SemanticAtomDefinition['contractSubstrate']> = {
  runtimeRequirements: [
    { domain: 'runtime', verb: 'provide', object: 'bar_ohlcv' },
    { domain: 'runtime', verb: 'provide', object: 'compiled_predicate_runtime' },
  ],
  stateRequirements: [],
  orderRequirements: [
    { domain: 'order', verb: 'support', object: 'market_order' },
  ],
  openSlots: [],
}

const POSITION_SUBSTRATE: NonNullable<SemanticAtomDefinition['contractSubstrate']> = {
  runtimeRequirements: [],
  stateRequirements: [],
  orderRequirements: [],
  openSlots: [],
}
```

Update supported atom factory returns:

```ts
contractSubstrate: BASE_EXECUTABLE_SUBSTRATE,
```

For `supportedRequiresSlotRisk`, use:

```ts
contractSubstrate: {
  ...BASE_EXECUTABLE_SUBSTRATE,
  openSlots,
},
```

For positions:

```ts
contractSubstrate: POSITION_SUBSTRATE,
```

Do not add `contractSubstrate` to `unsupported(...)`.

- [ ] **Step 5: Run registry tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-registry.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 6**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/semantic-atom-support.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-registry.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-registry.service.spec.ts
git commit -F - <<'MSG'
feat: add registry substrate metadata for supported atoms

变更说明：
- supported atom definitions 显式声明 Phase 0 contract substrate
- unsupported atom 不声明可执行 substrate
- registry 测试防止 supported atom 漏掉 substrate

Refs: #984
MSG
```

---

### Task 7: Upgrade Coverage Corpus Metadata

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/atom-coverage-golden-cases.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atom-coverage-golden-corpus.spec.ts`

- [ ] **Step 1: Add failing corpus metadata assertions**

In `atom-coverage-golden-corpus.spec.ts`, add these tests before `it.each(...)`:

```ts
  it('declares phase 0 route tags and expected atom metadata for every case', () => {
    for (const goldenCase of atomCoverageGoldenCases) {
      expect(goldenCase).toEqual(expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        message: expect.any(String),
        tags: expect.any(Array),
        expectedRoute: expect.any(String),
        expectedAtoms: expect.any(Array),
      }))
      expect(goldenCase.tags.length).toBeGreaterThan(0)
      expect(goldenCase.expectedAtoms.length).toBeGreaterThan(0)
    }
  })

  it('requires executable expected atoms to opt into minimum substrate', () => {
    for (const goldenCase of atomCoverageGoldenCases) {
      if (goldenCase.expectedRoute !== 'projection_gate') continue
      for (const atom of goldenCase.expectedAtoms) {
        if (atom.category === 'context') continue
        expect(atom.minContractSubstrate).toBe(true)
      }
    }
  })
```

Expected TypeScript failure: existing `AtomCoverageGoldenCase` lacks `id`, `tags`, and `expectedAtoms`.

- [ ] **Step 2: Run the failing corpus tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atom-coverage-golden-corpus.spec.ts -t "phase 0 route tags|minimum substrate"
```

Expected: FAIL with type or assertion errors.

- [ ] **Step 3: Extend fixture types**

In `atom-coverage-golden-cases.ts`, replace the interface with:

```ts
export type AtomicCoverageTag =
  | 'trend'
  | 'mean_reversion'
  | 'breakout'
  | 'grid'
  | 'dca'
  | 'position_lifecycle'
  | 'multi_timeframe'
  | 'state_memory'
  | 'partial_take_profit'
  | 'multi_leg'
  | 'event_driven'
  | 'portfolio_risk'
  | 'context'
  | 'risk'
  | 'orchestration'

export interface AtomCoverageExpectedAtom {
  key: string
  category: 'trigger' | 'action' | 'risk' | 'position' | 'context' | 'orchestration'
  minContractSubstrate?: boolean
}

export interface AtomCoverageGoldenCase {
  id: string
  name: string
  message: string
  tags: AtomicCoverageTag[]
  expectedAtoms: AtomCoverageExpectedAtom[]
  expectedKeys: string[]
  forbiddenKeys?: string[]
  expectedRoute: SemanticSupportRoute
  notes?: string
}
```

- [ ] **Step 4: Add metadata to the existing 50+ cases**

For every existing case, add `id`, `tags`, and `expectedAtoms`. Example:

```ts
{
  id: 'supported-ma-cross-long-fixed-pct-risk',
  name: 'supported ma cross long with fixed pct risk',
  message: 'OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，MA20 下穿 MA50 平多，单笔 10%，止损 5%，止盈 10%。',
  tags: ['trend', 'risk', 'context'],
  expectedAtoms: [
    { key: 'indicator.cross_over', category: 'trigger', minContractSubstrate: true },
    { key: 'indicator.cross_under', category: 'trigger', minContractSubstrate: true },
    { key: 'open_long', category: 'action', minContractSubstrate: true },
    { key: 'close_long', category: 'action', minContractSubstrate: true },
    { key: 'position.fixed_pct', category: 'position', minContractSubstrate: true },
    { key: 'risk.stop_loss_pct', category: 'risk', minContractSubstrate: true },
    { key: 'risk.take_profit_pct', category: 'risk', minContractSubstrate: true },
    { key: 'context.exchange', category: 'context' },
    { key: 'context.symbol', category: 'context' },
    { key: 'context.marketType', category: 'context' },
    { key: 'context.timeframe', category: 'context' },
  ],
  expectedKeys: ['indicator.cross_over', 'indicator.cross_under', 'open_long', 'close_long', 'position.fixed_pct', 'risk.stop_loss_pct', 'risk.take_profit_pct', 'context.exchange', 'context.symbol', 'context.marketType', 'context.timeframe'],
  expectedRoute: 'projection_gate',
}
```

For unsupported cases, use `minContractSubstrate: false` or omit it:

```ts
expectedAtoms: [
  { key: 'volume.threshold', category: 'trigger' },
  { key: 'open_long', category: 'action', minContractSubstrate: true },
  { key: 'position.fixed_pct', category: 'position', minContractSubstrate: true },
]
```

For orchestration-like cases, add tag `orchestration` and category `orchestration`, and keep route unsupported or open-slot. Do not mark them executable.

- [ ] **Step 5: Add coverage statistics assertion**

In `atom-coverage-golden-corpus.spec.ts`, add:

```ts
  it('keeps phase 0 executable coverage below orchestration and lifecycle ambitions', () => {
    const executableCases = atomCoverageGoldenCases.filter(item => item.expectedRoute === 'projection_gate')
    const orchestrationCases = atomCoverageGoldenCases.filter(item => item.tags.includes('orchestration'))

    expect(executableCases.length).toBeGreaterThan(0)
    expect(orchestrationCases.length).toBeGreaterThan(0)
    expect(orchestrationCases.every(item => item.expectedRoute !== 'projection_gate')).toBe(true)
  })
```

- [ ] **Step 6: Run corpus tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atom-coverage-golden-corpus.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Task 7**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/atom-coverage-golden-cases.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atom-coverage-golden-corpus.spec.ts
git commit -F - <<'MSG'
test: establish phase 0 atom coverage corpus baseline

变更说明：
- 为 golden corpus 增加 route/tags/expectedAtoms metadata
- supported executable cases 要求 expected atoms 标记 substrate
- orchestration 高阶能力在 Phase 0 不计入 executable coverage

Refs: #984
MSG
```

---

### Task 8: Wire Registry Substrate Into Contract Builders

**Files:**
- Modify likely: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts`
- Modify likely: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
- Modify likely: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-support-classifier.service.ts`
- Test: existing semantic builder/classifier specs reported by focused runs

- [ ] **Step 1: Locate current contract creation path**

Run:

```bash
rg -n "contracts:|SemanticAtomRegistryService|contractSubstrate|toSemanticSupportOpenSlot" apps/quantify/src/modules/llm-strategy-codegen/services apps/quantify/src/modules/llm-strategy-codegen/types
```

Expected: identify the builder/classifier code that attaches `support` metadata and creates atom contracts from extracted patches.

- [ ] **Step 2: Add a failing builder/classifier test**

In the most specific existing spec that covers supported atom build output, add:

```ts
it('attaches registry substrate to supported atom contracts', () => {
  const patch = {
    triggers: [{
      key: 'indicator.cross_over',
      phase: 'entry' as const,
      sideScope: 'long' as const,
      params: { indicator: 'ma', fastPeriod: 20, slowPeriod: 50 },
    }],
    actions: [{ key: 'open_long' }],
  }

  const state = new SemanticSeedStateBuilderService().build(patch)

  expect(state.triggers[0].contracts?.[0]).toEqual(expect.objectContaining({
    runtimeRequirements: expect.any(Array),
    stateRequirements: expect.any(Array),
    orderRequirements: expect.any(Array),
    openSlots: expect.any(Array),
  }))
})
```

Use the existing constructor pattern in that spec; if dependencies are required, instantiate them the same way nearby tests do.

- [ ] **Step 3: Run the failing spec**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts -t "attaches registry substrate"
```

Expected: FAIL if generated contracts do not yet include registry substrate.

- [ ] **Step 4: Implement a small substrate mapper**

In the builder/classifier file that creates contracts, import `SemanticAtomRegistryService` if not already available. When building a supported atom contract, copy substrate from registry:

```ts
const resolved = this.semanticAtomRegistry.resolve(atom.key)
const substrate = 'contractSubstrate' in resolved ? resolved.contractSubstrate : undefined

const contract: SemanticAtomContract = {
  id: contractId,
  kind,
  capabilities,
  requires,
  params,
  effects,
  runtimeRequirements: substrate?.runtimeRequirements ?? [],
  stateRequirements: substrate?.stateRequirements ?? [],
  orderRequirements: substrate?.orderRequirements ?? [],
  openSlots: (substrate?.openSlots ?? []).map(toSemanticSupportOpenSlot),
}
```

Only use this for registered supported atoms. Do not infer substrate for unsupported atoms.

- [ ] **Step 5: Run builder/classifier tests**

Run the seed-state builder spec, then the support classifier spec:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-support-classifier.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 8**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services apps/quantify/src/modules/llm-strategy-codegen/types
git commit -F - <<'MSG'
feat: attach registry substrate to supported semantic contracts

变更说明：
- supported atom contract 生成时复制 registry substrate
- supported_requires_slot 的 substrate openSlots 转为 SemanticSlotState
- 不为 unsupported atom 推断可执行 substrate

Refs: #984
MSG
```

---

### Task 9: Final Verification And Cleanup

**Files:**
- Modify only files touched by prior tasks if verification finds issues.

- [ ] **Step 1: Check worktree and protect unrelated user edits**

Run:

```bash
git status --short
```

Expected: only files touched by this plan plus the pre-existing unrelated user edits may be modified. Do not revert these pre-existing files unless they are part of your current task:

```text
apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-canonical-ir.spec.ts
apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-script-emitter.spec.ts
packages/shared/src/script-engine/compiled-runtime/evaluate-risk-predicates.spec.ts
```

- [ ] **Step 2: Run focused verification**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-registry.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atom-coverage-golden-corpus.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-support-classifier.service.spec.ts
```

Expected: all PASS.

- [ ] **Step 3: Run build verification**

Run:

```bash
dx build quantify --dev
```

Expected: PASS.

- [ ] **Step 4: Inspect final diff**

Run:

```bash
git diff --stat HEAD
git diff -- apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts
```

Expected: diff matches Phase 0 scope only. No Prisma, frontend, OpenAPI, generated API contract, or runtime execution files should be changed by this plan.

- [ ] **Step 5: Commit verification fixes if any**

If Step 2 or Step 3 required fixes, commit them:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen
git commit -F - <<'MSG'
fix: stabilize phase 0 contract substrate verification

变更说明：
- 修复 Phase 0 focused verification 中发现的问题
- 保持 contract substrate fail-closed 行为

Refs: #984
MSG
```

If no fixes were needed, do not create an empty commit.
