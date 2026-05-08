# AI Quant Position Lifecycle Atomic Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Issue #984 Phase 2 by adding executable atomic contracts for reduce, add, reverse, pyramiding, max exposure, and DCA position lifecycle semantics.

**Architecture:** Keep `SemanticState` as the truth source and keep the top-level atomic domains unchanged. Add `position.constraints[]` under the existing `position` domain so multiple position atoms can carry independent keys, contracts, support metadata, and open slots; compile action effects and position constraints into canonical spec v2, canonical IR, compiler.v1 runtime, backtest fast path, live signal fast path, and deploy readiness.

**Tech Stack:** NestJS services in `apps/quantify`, TypeScript strict mode, Jest via `dx test unit quantify`, shared compiler runtime in `packages/shared/src/script-engine/compiled-runtime`, Nx builds via `dx`.

---

## Preflight

The current desktop workspace has user changes and a branch created from an older local `main`. Implementation should start from a clean branch based on latest remote main.

- [ ] **Step 1: Create a clean implementation branch from latest remote main**

Run from `/Users/zengmengdan/coinfulx-new/stats`:

```bash
git fetch origin main
git switch -c codex/feat/984-phase2-position-lifecycle origin/main
```

Expected: branch `codex/feat/984-phase2-position-lifecycle` starts at `origin/main`.

- [ ] **Step 2: Keep the design and plan available**

If the clean branch does not contain the docs commits, cherry-pick them:

```bash
git cherry-pick 110f95e3
```

Expected: `docs/superpowers/specs/2026-05-08-ai-quant-position-lifecycle-atomic-contract-design.md` exists.

## File Structure

Modify these files:

- `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`
  - Add `SemanticPositionConstraintState` and `SemanticPositionConstraintKey`.
  - Add `constraints?: SemanticPositionConstraintState[]` to `SemanticPositionState`.
- `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts`
  - Add `position.constraints` patch shape.
- `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec-v2.ts`
  - Add canonical position lifecycle metadata and action metadata for add/reverse/DCA constraints.
- `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ir.ts`
  - Add action kinds and metadata for `ADD_LONG`, `ADD_SHORT`, and reverse/DCA execution constraints.
- `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ast.ts`
  - Preserve action metadata through AST decision programs.
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
  - Extract Phase 2 Chinese expressions into action atoms and position constraints.
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts`
  - Build position constraints and synthesize contracts.
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-registry.service.ts`
  - Register Phase 2 atom support statuses and substrates.
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-support-classifier.service.ts`
  - Classify `position.constraints[]` in addition to sizing.
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`
  - Include position constraints as contract owners and enforce add/DCA guard relationships.
- `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
  - Project Phase 2 semantic atoms into canonical v2 rules and metadata.
- `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts`
  - Compile Phase 2 actions and position constraints into IR rule blocks and runtime requirements.
- `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service.ts`
  - Preserve Phase 2 action metadata into AST decision programs.
- `apps/quantify/src/modules/llm-strategy-codegen/services/compiled-script-emitter.service.ts`
  - No custom script code; verify projection includes new runtime metadata.
- `packages/shared/src/script-engine/compiled-runtime/run-decision-programs.ts`
  - Execute add/reverse/DCA constraints and fail closed.
- `packages/shared/src/strategy-protocol.ts`
  - Add optional typed runtime state fields instead of relying on `Record<string, any>`.
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/atom-coverage-golden-cases.ts`
  - Add Phase 2 corpus cases.

Create these tests:

- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-semantics.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-canonical-ir.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-runtime.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-parity.spec.ts`

## Task 1: Add Phase 2 Golden Corpus And Failing Semantic Tests

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/atom-coverage-golden-cases.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-semantics.spec.ts`

- [ ] **Step 1: Add corpus cases**

Append this export near existing corpus exports:

```ts
export const positionLifecycleGoldenCases: AtomCoverageGoldenCase[] = [
  {
    id: 'phase2-001-reduce-position-percent',
    name: 'reduce position by percent after profit',
    message: '盈利 5% 后减仓 30%。',
    tags: ['position_lifecycle', 'risk'],
    expectedAtoms: [
      { key: 'risk.take_profit_pct', category: 'risk', minContractSubstrate: true },
      { key: 'action.reduce_position', category: 'action', minContractSubstrate: true },
    ],
    expectedKeys: ['risk.take_profit_pct', 'action.reduce_position'],
    expectedRoute: 'projection_gate',
  },
  {
    id: 'phase2-002-add-position-with-pyramiding-limit',
    name: 'add position with pyramiding limit',
    message: 'BTC 回踩 MA20 不破后加仓，每次加仓 20%，最多加仓 3 次。',
    tags: ['position_lifecycle', 'mean_reversion'],
    expectedAtoms: [
      { key: 'condition.sequence', category: 'trigger', minContractSubstrate: true },
      { key: 'action.add_position', category: 'action', minContractSubstrate: true },
      { key: 'position.pyramiding_limit', category: 'position', minContractSubstrate: true },
    ],
    expectedKeys: ['condition.sequence', 'action.add_position', 'position.pyramiding_limit'],
    expectedRoute: 'projection_gate',
  },
  {
    id: 'phase2-003-add-position-missing-constraint',
    name: 'add position asks for exposure guard',
    message: 'BTC 回踩 MA20 不破后加仓，每次加仓 20%。',
    tags: ['position_lifecycle', 'mean_reversion'],
    expectedAtoms: [
      { key: 'condition.sequence', category: 'trigger', minContractSubstrate: true },
      { key: 'action.add_position', category: 'action', minContractSubstrate: true },
    ],
    expectedKeys: ['condition.sequence', 'action.add_position', 'open_slot:action.add_position.constraint'],
    expectedRoute: 'open_slots',
  },
  {
    id: 'phase2-004-reverse-position',
    name: 'reverse position close then open opposite',
    message: '跌破 MA50 平多并反手做空，反手仓位沿用原仓位，允许同一根 K 线内反手。',
    tags: ['position_lifecycle', 'trend'],
    expectedAtoms: [
      { key: 'indicator.below', category: 'trigger', minContractSubstrate: true },
      { key: 'action.reverse_position', category: 'action', minContractSubstrate: true },
    ],
    expectedKeys: ['indicator.below', 'action.reverse_position'],
    expectedRoute: 'projection_gate',
  },
  {
    id: 'phase2-005-dca-fixed-schedule',
    name: 'fixed DCA schedule with cap and exit',
    message: '每跌 5% 补仓一次，每次 100 USDT，最多 4 次，总投入不超过 500 USDT，跌破前低停止。',
    tags: ['position_lifecycle', 'dca', 'risk'],
    expectedAtoms: [
      { key: 'price.percent_change', category: 'trigger', minContractSubstrate: true },
      { key: 'position.dca_schedule', category: 'position', minContractSubstrate: true },
      { key: 'risk.remembered_level_stop', category: 'risk', minContractSubstrate: true },
    ],
    expectedKeys: ['price.percent_change', 'position.dca_schedule', 'risk.remembered_level_stop'],
    expectedRoute: 'projection_gate',
  },
  {
    id: 'phase2-006-dca-missing-exit-rule',
    name: 'DCA asks for exit rule',
    message: '每跌 5% 补仓一次，每次 100 USDT，最多 4 次，总投入不超过 500 USDT。',
    tags: ['position_lifecycle', 'dca'],
    expectedAtoms: [
      { key: 'price.percent_change', category: 'trigger', minContractSubstrate: true },
      { key: 'position.dca_schedule', category: 'position', minContractSubstrate: true },
    ],
    expectedKeys: ['position.dca_schedule', 'open_slot:position.dca_schedule.exit_rule'],
    expectedRoute: 'open_slots',
  },
]
```

- [ ] **Step 2: Write failing semantic tests**

Create `atomic-contract-position-lifecycle-semantics.spec.ts`:

```ts
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'

describe('atomic contract position lifecycle semantics', () => {
  const extractor = new SemanticSeedExtractorService()
  const builder = new SemanticSeedStateBuilderService()
  const classifier = new SemanticSupportClassifierService(new SemanticAtomRegistryService())
  const readiness = new SemanticContractReadinessService()

  function classify(message: string) {
    const patch = extractor.extract(message)
    const state = builder.build(patch)
    if (!state) throw new Error('state_not_built')
    const classified = classifier.classify(state)
    const normalized = readiness.normalize(classified.state)
    return { patch, classified, normalized }
  }

  it('extracts reduce_position as an exposure-reducing action', () => {
    const result = classify('盈利 5% 后减仓 30%。')

    expect(result.classified.route).toBe('projection_gate')
    expect(result.classified.state.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'action.reduce_position',
        params: expect.objectContaining({
          reduceBasis: 'ratio',
          reduceValue: 0.3,
          sideScope: 'long',
        }),
      }),
    ]))
    expect(result.normalized.state.actions[0]?.contracts?.[0]).toEqual(expect.objectContaining({
      effects: expect.arrayContaining([
        expect.objectContaining({ domain: 'exposure', verb: 'reduce', object: 'position' }),
      ]),
      orderRequirements: expect.arrayContaining([
        expect.objectContaining({ domain: 'order', verb: 'enforce', object: 'no_exposure_increase' }),
      ]),
    }))
  })

  it('requires an exposure guard for add_position', () => {
    const result = classify('BTC 回踩 MA20 不破后加仓，每次加仓 20%。')

    expect(result.classified.route).toBe('open_slots')
    expect(result.classified.state.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'action.add_position',
        openSlots: expect.arrayContaining([
          expect.objectContaining({ slotKey: 'action.add_position.constraint', affectsExecution: true }),
        ]),
      }),
    ]))
    expect(result.normalized.ready).toBe(false)
  })

  it('extracts add_position with pyramiding limit', () => {
    const result = classify('BTC 回踩 MA20 不破后加仓，每次加仓 20%，最多加仓 3 次。')

    expect(result.classified.route).toBe('projection_gate')
    expect(result.classified.state.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'action.add_position' }),
    ]))
    expect(result.classified.state.position?.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'position.pyramiding_limit',
        params: expect.objectContaining({ maxLayers: 3 }),
      }),
    ]))
  })

  it('extracts reverse_position with same-bar and sizing source', () => {
    const result = classify('跌破 MA50 平多并反手做空，反手仓位沿用原仓位，允许同一根 K 线内反手。')

    expect(result.classified.route).toBe('projection_gate')
    expect(result.classified.state.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'action.reverse_position',
        params: expect.objectContaining({
          fromSide: 'long',
          toSide: 'short',
          sameBarPolicy: 'allow',
          sizingSource: 'current_position',
        }),
      }),
    ]))
  })

  it('requires DCA exit rule before deployment', () => {
    const result = classify('每跌 5% 补仓一次，每次 100 USDT，最多 4 次，总投入不超过 500 USDT。')

    expect(result.classified.route).toBe('open_slots')
    expect(result.classified.state.position?.constraints).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'position.dca_schedule',
        openSlots: expect.arrayContaining([
          expect.objectContaining({ slotKey: 'position.dca_schedule.exit_rule', affectsExecution: true }),
        ]),
      }),
    ]))
  })
})
```

- [ ] **Step 3: Run semantic test and verify it fails**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-semantics.spec.ts
```

Expected: FAIL because Phase 2 atoms and `position.constraints` do not exist yet.

- [ ] **Step 4: Commit failing tests**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/atom-coverage-golden-cases.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-semantics.spec.ts
git commit -F - <<'MSG'
test(ai-quant): add phase2 position lifecycle semantic coverage

Refs: #984
MSG
```

## Task 2: Add Position Constraint Types, Builder, Registry, And Readiness

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-registry.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-support-classifier.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-semantics.spec.ts`

- [ ] **Step 1: Add semantic position constraint types**

In `semantic-state.ts`, add:

```ts
export type SemanticPositionConstraintKey =
  | 'position.pyramiding_limit'
  | 'position.max_exposure_pct'
  | 'position.dca_schedule'

export interface SemanticPositionConstraintState {
  id: string
  key: SemanticPositionConstraintKey
  params: Record<string, unknown>
  status: SemanticNodeStatus
  source: SemanticSource
  evidence?: SemanticEvidence
  openSlots: SemanticSlotState[]
  supersedes?: string[]
  contracts?: SemanticAtomContract[]
  support?: SemanticAtomSupportMetadata
}
```

Then add this field to `SemanticPositionState`:

```ts
constraints?: SemanticPositionConstraintState[]
```

- [ ] **Step 2: Add patch shape for position constraints**

In `codegen-semantic-patch.ts`, add `constraints` inside the `position` patch type:

```ts
constraints?: Array<CodegenSemanticNodeEnvelope & {
  key: SemanticPositionConstraintKey
  params?: Record<string, unknown>
  contracts?: SemanticAtomContract[]
}>
```

Also import `SemanticPositionConstraintKey`.

- [ ] **Step 3: Build position constraints in state builder**

In `SemanticSeedStateBuilderService.toPositionState`, read constraints from the position patch:

```ts
const constraints = Array.isArray(update.constraints)
  ? update.constraints
    .map((item, index) => this.toPositionConstraintState(item, index))
    .filter((item): item is SemanticPositionConstraintState => item !== null)
  : []
```

Return them on the position:

```ts
...(constraints.length > 0 ? { constraints } : {}),
```

Add method:

```ts
private toPositionConstraintState(update: unknown, index: number): SemanticPositionConstraintState | null {
  if (!this.isRecord(update)) return null
  const key = this.readTrimmedString(update.key)
  if (
    key !== 'position.pyramiding_limit'
    && key !== 'position.max_exposure_pct'
    && key !== 'position.dca_schedule'
  ) {
    return null
  }

  const params = this.readParams(update.params)
  const openSlots = this.readOpenSlots(update.openSlots)
  const evidence = this.readEvidence(update.evidence)
  const supersedes = this.readStringArray(update.supersedes)
  const contracts = this.readContracts(update.contracts)
    ?? (this.hasOwnProperty(update, 'contracts') ? null : this.synthesizePositionConstraintContracts(key, params, index))
  const contractCoverage = this.resolveContractCoverage({
    contracts,
    openSlots,
    statusValue: update.status,
    fieldPath: `position.constraints[${index}].contracts`,
    priority: 'behavior',
  })

  return {
    id: this.readTrimmedString(update.id) ?? `planner-position-constraint-${index + 1}`,
    key,
    params,
    status: contractCoverage.status,
    source: this.readSource(update.source),
    ...(evidence ? { evidence } : {}),
    openSlots: contractCoverage.openSlots,
    ...(supersedes ? { supersedes } : {}),
    ...(contracts ? { contracts } : {}),
  }
}
```

- [ ] **Step 4: Synthesize contracts for Phase 2 constraints**

Add `synthesizePositionConstraintContracts` to the same service:

```ts
private synthesizePositionConstraintContracts(
  key: SemanticPositionConstraintState['key'],
  params: Record<string, unknown>,
  index: number,
): SemanticAtomContract[] {
  if (key === 'position.pyramiding_limit') {
    return [{
      id: `contract-position-pyramiding-limit-${index + 1}`,
      kind: 'position',
      capabilities: [{
        domain: 'exposure',
        verb: 'limit',
        object: 'pyramiding_layers',
        shape: {
          maxLayers: readFiniteNumber(params.maxLayers),
          layerSizing: readUnknownShape(params.layerSizing),
        },
      }],
      requires: [],
      params,
      runtimeRequirements: [{ domain: 'runtime', verb: 'provide', object: 'position_snapshot' }],
      stateRequirements: [{ domain: 'state', verb: 'read_write', object: 'pyramiding_layer_count' }],
      orderRequirements: [],
      openSlots: [],
      effects: [{ domain: 'guard', verb: 'block', object: 'exposure_increase' }],
    }]
  }

  if (key === 'position.max_exposure_pct') {
    return [{
      id: `contract-position-max-exposure-${index + 1}`,
      kind: 'position',
      capabilities: [{
        domain: 'exposure',
        verb: 'limit',
        object: 'max_exposure_pct',
        shape: {
          scope: typeof params.scope === 'string' ? params.scope : null,
          valuePct: readFiniteNumber(params.valuePct),
          basis: typeof params.basis === 'string' ? params.basis : null,
        },
      }],
      requires: [],
      params,
      runtimeRequirements: [{ domain: 'runtime', verb: 'provide', object: 'position_snapshot' }],
      stateRequirements: [],
      orderRequirements: [],
      openSlots: [],
      effects: [{ domain: 'guard', verb: 'block', object: 'exposure_increase' }],
    }]
  }

  return [{
    id: `contract-position-dca-schedule-${index + 1}`,
    kind: 'position',
    capabilities: [{
      domain: 'runtime',
      verb: 'schedule',
      object: 'dca_orders',
      shape: {
        maxCount: readFiniteNumber(params.maxCount),
        capitalCap: readFiniteNumber(params.capitalCap),
        triggerMode: typeof params.triggerMode === 'string' ? params.triggerMode : null,
      },
    }],
    requires: [{ domain: 'guard', verb: 'define', object: 'dca_exit_rule' }],
    params,
    runtimeRequirements: [{ domain: 'runtime', verb: 'provide', object: 'position_snapshot' }],
    stateRequirements: [{ domain: 'state', verb: 'read_write', object: 'dca_fired_count' }],
    orderRequirements: [{ domain: 'order', verb: 'support', object: 'market_order' }],
    openSlots: [],
    effects: [{ domain: 'exposure', verb: 'increase', object: 'position' }],
  }]
}
```

Define helper functions at file bottom:

```ts
function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function readUnknownShape(value: unknown): SemanticCapabilityShape | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as SemanticCapabilityShape
    : null
}
```

- [ ] **Step 5: Register Phase 2 atoms**

In `SemanticAtomRegistryService`, replace current unsupported entries for `action.add_position`, `action.reverse_position`, and `position.dca_schedule`, and add missing supported atom entries:

```ts
executableAction('action.reduce_position'),
supportedRequiresSlotAction('action.add_position', ['constraint'], [{
  slotKey: 'action.add_position.constraint',
  fieldPath: 'actions[action.add_position].params.constraint',
  priority: 'behavior',
  questionHint: '请确认加仓最大限制，例如最多加仓 3 次，或总仓位不超过策略资金 30%。',
}]),
supportedRequiresSlotAction('action.reverse_position', ['sameBarPolicy', 'sizingSource'], [
  {
    slotKey: 'action.reverse_position.same_bar_policy',
    fieldPath: 'actions[action.reverse_position].params.sameBarPolicy',
    priority: 'behavior',
    questionHint: '请确认反手时是否允许同一根 K 线内先平仓再反向开仓。',
  },
  {
    slotKey: 'action.reverse_position.sizing_source',
    fieldPath: 'actions[action.reverse_position].params.sizingSource',
    priority: 'behavior',
    questionHint: '请确认反手后的仓位大小，例如沿用原仓位、固定金额，或固定比例。',
  },
]),
executablePosition('position.pyramiding_limit', ['maxLayers', 'layerSizing']),
executablePosition('position.max_exposure_pct', ['scope', 'valuePct', 'basis']),
supportedRequiresSlotPosition('position.dca_schedule', ['maxCount', 'capitalCap', 'perOrderSizing', 'triggerMode', 'exitRule'], [
  {
    slotKey: 'position.dca_schedule.exit_rule',
    fieldPath: 'position.constraints[position.dca_schedule].params.exitRule',
    priority: 'behavior',
    questionHint: '请确认 DCA 仓位什么时候停止或退出，例如跌破前低、固定止损，或趋势失效。',
  },
]),
```

Add helpers mirroring existing risk helper:

```ts
function supportedRequiresSlotAction(
  key: string,
  requiredParams: string[],
  openSlots: SemanticAtomDefinition['openSlots'],
): SemanticSupportedAtomDefinition {
  return {
    key,
    category: 'action',
    supportStatus: 'supported_requires_slot',
    requiredParams,
    defaultableParams: [],
    executableProjection: ['canonical_spec_v2', 'compiled_runtime'],
    openSlots,
    contractSubstrate: {
      ...baseExecutableSubstrate(),
      openSlots: cloneOpenSlotSpecs(openSlots),
    },
  }
}

function supportedRequiresSlotPosition(
  key: string,
  requiredParams: string[],
  openSlots: SemanticAtomDefinition['openSlots'],
): SemanticSupportedAtomDefinition {
  return {
    key,
    category: 'position',
    supportStatus: 'supported_requires_slot',
    requiredParams,
    defaultableParams: [],
    executableProjection: ['semantic_position_contract', 'compiled_runtime'],
    openSlots,
    contractSubstrate: {
      ...positionSubstrate(),
      openSlots: cloneOpenSlotSpecs(openSlots),
    },
  }
}
```

- [ ] **Step 6: Classify position constraints**

In `SemanticSupportClassifierService.classifyPosition`, map `position.constraints`:

```ts
const constraints = (position.constraints ?? []).map((constraint) => {
  if (constraint.status === 'superseded') return { ...constraint }
  const resolved = this.registry.resolve(constraint.key)
  this.collectSupportResult(resolved, unsupportedAtoms, unknownAtoms)
  return withRegistryOpenSlots(withSupportMetadata(constraint, resolved), resolved)
})

return {
  ...withRegistryOpenSlots(withSupportMetadata(position, resolved), resolved),
  ...(constraints.length > 0 ? { constraints } : {}),
}
```

Update generic bounds for `withSupportMetadata`, `withoutSupportMetadata`, `withRegistryOpenSlots`, `hasMissingRequiredParam`, and `hasParams` to include `SemanticPositionConstraintState`.

- [ ] **Step 7: Include position constraints in readiness owners**

In `SemanticContractReadinessService`, include `position.constraints` in `collectActiveContractOwners` and merge their open slots back into `position.constraints`. Use owner ids `position-constraint:${constraint.id}`.

Add relationship check after registry slots:

```ts
function buildPositionLifecycleRelationshipSlots(state: SemanticState): Map<string, SemanticSlotState[]> {
  const slots = new Map<string, SemanticSlotState[]>()
  const hasAddPosition = state.actions.some(action => action.status !== 'superseded' && action.key === 'action.add_position')
  if (!hasAddPosition) return slots

  const constraints = state.position?.constraints ?? []
  const hasPyramiding = constraints.some(item => item.status !== 'superseded' && item.key === 'position.pyramiding_limit')
  const hasMaxExposure = constraints.some(item => item.status !== 'superseded' && item.key === 'position.max_exposure_pct')
  if (hasPyramiding || hasMaxExposure) return slots

  for (const action of state.actions.filter(item => item.key === 'action.add_position')) {
    slots.set(ownerKey('action', action.id), [{
      slotKey: 'action.add_position.constraint',
      fieldPath: `actions[${action.id}].params.constraint`,
      status: 'open',
      priority: 'behavior',
      affectsExecution: true,
      questionHint: '请确认加仓最大限制，例如最多加仓 3 次，或总仓位不超过策略资金 30%。',
    }])
  }
  return slots
}
```

Merge it into `slotsByOwnerKey`.

- [ ] **Step 8: Run semantic tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-semantics.spec.ts
```

Expected: still FAIL only on extraction/canonical gaps, not on TypeScript compile errors.

- [ ] **Step 9: Commit type, registry, and readiness substrate**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts \
  apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-registry.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/semantic-support-classifier.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts
git commit -F - <<'MSG'
feat(ai-quant): add position lifecycle contract substrate

Refs: #984
MSG
```

## Task 3: Extract Phase 2 Natural Language Into Atomic Patches

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-semantics.spec.ts`

- [ ] **Step 1: Add extraction helpers**

Add methods to `SemanticSeedExtractorService`:

```ts
private extractPositionLifecycleActions(text: string): SeedAction[] {
  const actions: SeedAction[] = []

  const reduceMatch = text.match(/(?:减仓|减持|卖出一部分).*?(\d+(?:\.\d+)?)\s*%/u)
  if (reduceMatch) {
    actions.push({
      key: 'action.reduce_position',
      params: {
        sideScope: this.resolveLifecycleSideScope(text),
        reduceBasis: 'ratio',
        reduceValue: Number(reduceMatch[1]) / 100,
      },
    })
  }

  if (/加仓|补仓/u.test(text) && !/每跌|定投|DCA|dca/u.test(text)) {
    const layerSizingPct = this.extractPercentAfterKeywords(text, ['每次加仓', '加仓'])
    actions.push({
      key: 'action.add_position',
      params: {
        sideScope: this.resolveLifecycleSideScope(text),
        ...(layerSizingPct !== null ? { sizing: { kind: 'ratio', value: layerSizingPct / 100, unit: 'percent' } } : {}),
      },
    })
  }

  if (/反手/u.test(text)) {
    actions.push({
      key: 'action.reverse_position',
      params: {
        fromSide: /平空|做多/u.test(text) ? 'short' : 'long',
        toSide: /做空|空/u.test(text) ? 'short' : 'long',
        ...(text.includes('允许同一根') ? { sameBarPolicy: 'allow' } : {}),
        ...(text.includes('沿用原仓') || text.includes('沿用原仓位') ? { sizingSource: 'current_position' } : {}),
      },
    })
  }

  return actions
}

private extractPositionLifecycleConstraints(text: string): NonNullable<CodegenSemanticPatch['position']>['constraints'] {
  const constraints: NonNullable<CodegenSemanticPatch['position']>['constraints'] = []
  const maxLayers = this.extractNumberBefore(text, ['次', '层'], /最多加仓\s*(\d+)\s*(?:次|层)/u)
  const layerSizingPct = this.extractPercentAfterKeywords(text, ['每次加仓', '加仓'])

  if (maxLayers !== null) {
    constraints.push({
      key: 'position.pyramiding_limit',
      params: {
        maxLayers,
        layerSizing: layerSizingPct !== null
          ? { kind: 'ratio', value: layerSizingPct / 100, unit: 'percent' }
          : null,
      },
    })
  }

  const maxExposurePct = this.extractPercentAfterKeywords(text, ['总仓位不超过', '仓位不超过'])
  if (maxExposurePct !== null) {
    constraints.push({
      key: 'position.max_exposure_pct',
      params: {
        scope: text.includes('品种') ? 'symbol' : 'strategy',
        valuePct: maxExposurePct,
        basis: 'strategy_capital',
      },
    })
  }

  if (/每跌|补仓|DCA|dca/u.test(text) && /最多\s*\d+\s*次/u.test(text) && /总投入不超过/u.test(text)) {
    constraints.push({
      key: 'position.dca_schedule',
      params: {
        maxCount: this.extractNumberBefore(text, ['次'], /最多\s*(\d+)\s*次/u),
        capitalCap: this.extractQuoteAmountAfter(text, '总投入不超过'),
        perOrderSizing: this.extractQuoteAmountAfter(text, '每次'),
        triggerMode: text.includes('每跌') ? 'price_interval' : 'signal',
        priceIntervalPct: this.extractPercentAfterKeywords(text, ['每跌']),
        ...(this.hasDcaExitRule(text) ? { exitRule: this.resolveDcaExitRule(text) } : {}),
      },
    })
  }

  return constraints
}
```

Add small helpers:

```ts
private resolveLifecycleSideScope(text: string): 'long' | 'short' | 'both' {
  if (/空|short/i.test(text)) return 'short'
  return 'long'
}

private extractPercentAfterKeywords(text: string, keywords: readonly string[]): number | null {
  for (const keyword of keywords) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = text.match(new RegExp(`${escaped}[^，。；;]*?(\\d+(?:\\.\\d+)?)\\s*%`, 'u'))
    if (match) return Number(match[1])
  }
  return null
}

private extractNumberBefore(text: string, _units: readonly string[], pattern: RegExp): number | null {
  const match = text.match(pattern)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

private extractQuoteAmountAfter(text: string, keyword: string): { kind: 'quote'; value: number; asset: 'USDT' } | null {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = text.match(new RegExp(`${escaped}[^，。；;]*?(\\d+(?:\\.\\d+)?)\\s*(?:USDT|U)`, 'iu'))
  if (!match) return null
  return { kind: 'quote', value: Number(match[1]), asset: 'USDT' }
}

private hasDcaExitRule(text: string): boolean {
  return /跌破前低|停止|止损|退出/u.test(text)
}

private resolveDcaExitRule(text: string): Record<string, string> {
  if (text.includes('跌破前低')) return { kind: 'previous_low_break' }
  if (text.includes('止损')) return { kind: 'stop_loss' }
  return { kind: 'manual_stop' }
}
```

- [ ] **Step 2: Wire extraction into `extract`**

When building `actions`, merge lifecycle actions:

```ts
const actions = this.atomizeActions(this.mergeSeedActions(
  eventFramePatch.actions ?? [],
  this.mergeSeedActions(
    this.extractActions(text, triggers),
    this.extractPositionLifecycleActions(text),
  ),
))
```

After `const position = this.atomizePosition(...)`, merge constraints:

```ts
const lifecycleConstraints = this.extractPositionLifecycleConstraints(text)
const position = this.atomizePosition(this.extractPosition(text, triggers))
const positionWithConstraints = lifecycleConstraints.length > 0
  ? {
      ...(position ?? {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
      }),
      constraints: [
        ...((position as { constraints?: typeof lifecycleConstraints } | null)?.constraints ?? []),
        ...lifecycleConstraints,
      ],
    }
  : position
```

Use `positionWithConstraints` when assigning `patch.position`.

- [ ] **Step 3: Add DCA trigger extraction**

If message contains `每跌 N%`, ensure `price.percent_change` gate trigger exists:

```ts
if (/每跌\s*\d+(?:\.\d+)?\s*%/u.test(text)) {
  triggers.push({
    key: 'price.percent_change',
    phase: 'entry',
    sideScope: 'long',
    params: {
      direction: 'down',
      valuePct: this.extractPercentAfterKeywords(text, ['每跌']),
    },
  })
}
```

- [ ] **Step 4: Run semantic tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-semantics.spec.ts
```

Expected: PASS for semantic extraction and readiness tests.

- [ ] **Step 5: Commit extractor support**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts
git commit -F - <<'MSG'
feat(ai-quant): extract position lifecycle atoms

Refs: #984
MSG
```

## Task 4: Compile Phase 2 Atoms Into Canonical Spec, IR, And AST

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec-v2.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ir.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ast.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-canonical-ir.spec.ts`

- [ ] **Step 1: Add failing canonical/IR test**

Create `atomic-contract-position-lifecycle-canonical-ir.spec.ts`:

```ts
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'

describe('position lifecycle canonical IR', () => {
  const extractor = new SemanticSeedExtractorService()
  const builder = new SemanticSeedStateBuilderService()
  const readiness = new SemanticContractReadinessService()
  const canonical = new CanonicalSpecBuilderService()
  const irCompiler = new CanonicalSpecV2IrCompilerService()

  function compile(message: string) {
    const patch = extractor.extract(message)
    const state = builder.build(patch)
    if (!state) throw new Error('state_not_built')
    const normalized = readiness.normalize(state).state
    const spec = canonical.build({ semanticState: normalized, market: { symbol: 'BTCUSDT', timeframe: '15m' } })
    return irCompiler.compile({
      canonicalSpec: spec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 0.1,
      },
    }).ir
  }

  it('compiles reduce_position to REDUCE_LONG with no-exposure-increase metadata', () => {
    const ir = compile('盈利 5% 后减仓 30%。')
    expect(ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actions: expect.arrayContaining([
          expect.objectContaining({
            kind: 'REDUCE_LONG',
            quantity: expect.objectContaining({ mode: 'position_pct', value: 0.3 }),
          }),
        ]),
      }),
    ]))
    expect(ir.runtimeRequirements?.helpers).toEqual(expect.arrayContaining(['positionLifecycle']))
  })

  it('compiles add_position with pyramiding state requirement', () => {
    const ir = compile('BTC 回踩 MA20 不破后加仓，每次加仓 20%，最多加仓 3 次。')
    expect(ir.portfolio.allowPyramiding).toBe(true)
    expect(ir.portfolio.maxPyramidingLayers).toBe(3)
    expect(ir.runtimeRequirements?.stateKeys).toEqual(expect.arrayContaining(['pyramiding_layer_count']))
    expect(ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actions: expect.arrayContaining([
          expect.objectContaining({
            kind: 'ADD_LONG',
            quantity: expect.objectContaining({ mode: 'pct_equity', value: 0.2 }),
          }),
        ]),
      }),
    ]))
  })

  it('compiles reverse_position as close-before-open metadata', () => {
    const ir = compile('跌破 MA50 平多并反手做空，反手仓位沿用原仓位，允许同一根 K 线内反手。')
    expect(ir.ruleBlocks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        metadata: expect.objectContaining({
          reversePosition: expect.objectContaining({
            fromSide: 'long',
            toSide: 'short',
            sameBarPolicy: 'allow',
            sizingSource: 'current_position',
          }),
        }),
        actions: expect.arrayContaining([
          expect.objectContaining({ kind: 'CLOSE_LONG' }),
          expect.objectContaining({ kind: 'OPEN_SHORT' }),
        ]),
      }),
    ]))
  })
})
```

- [ ] **Step 2: Run canonical/IR test and verify it fails**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-canonical-ir.spec.ts
```

Expected: FAIL because canonical and IR types do not support Phase 2 action metadata yet.

- [ ] **Step 3: Extend canonical and IR types**

In `canonical-strategy-ir.ts`, add:

```ts
export interface PositionLifecycleActionMetadata {
  reversePosition?: {
    fromSide: 'long' | 'short'
    toSide: 'long' | 'short'
    sameBarPolicy: 'allow' | 'next_bar_only'
    sizingSource: 'current_position' | 'fixed' | 'position_sizing'
  }
  addPosition?: {
    maxLayers?: number
    maxExposurePct?: number
    stateKey: string
  }
  dcaSchedule?: {
    maxCount: number
    capitalCap: number
    stateKey: string
  }
}
```

Extend `ActionDef.kind`:

```ts
| 'ADD_LONG' | 'ADD_SHORT'
```

Extend `RuleBlock.metadata`:

```ts
metadata?: {
  partialTakeProfit?: PartialTakeProfitProgramMetadata
} & PositionLifecycleActionMetadata
```

Mirror this metadata in `canonical-strategy-ast.ts` `DecisionProgramNode`.

- [ ] **Step 4: Project semantic state in canonical builder**

In `CanonicalSpecBuilderService.build`, detect `semanticState` input before legacy text-based fallbacks:

```ts
const semanticState = this.readSemanticState(checklist)
if (semanticState) {
  return this.buildFromSemanticState(semanticState, normalizedLogicSnapshot, riskRules)
}
```

Add a focused `buildFromSemanticState` that:

- reuses `resolveMarket`
- creates rules from semantic triggers and actions
- maps `action.reduce_position` to `{ type: 'REDUCE_LONG' | 'REDUCE_SHORT', sizing }`
- maps `action.add_position` to `{ type: 'ADD_LONG' | 'ADD_SHORT', sizing, metadata.addPosition }`
- maps `action.reverse_position` to close + open actions with `metadata.reversePosition`
- stores DCA metadata from `position.constraints`

Use this action mapping:

```ts
private buildPositionLifecycleCanonicalAction(action: SemanticActionState): CanonicalRuleAction | null {
  if (action.key === 'action.reduce_position') {
    const side = action.params?.sideScope === 'short' ? 'SHORT' : 'LONG'
    return {
      type: `REDUCE_${side}` as CanonicalRuleActionType,
      sizing: this.resolveLifecycleSizing(action.params, 'reduce'),
    }
  }

  if (action.key === 'action.add_position') {
    const side = action.params?.sideScope === 'short' ? 'SHORT' : 'LONG'
    return {
      type: `ADD_${side}` as CanonicalRuleActionType,
      sizing: this.resolveLifecycleSizing(action.params, 'add'),
    }
  }

  return null
}
```

- [ ] **Step 5: Compile lifecycle actions into IR**

In `CanonicalSpecV2IrCompilerService.compileActions`, map:

```ts
case 'ADD_LONG':
  return { kind: 'ADD_LONG', quantity: this.resolveActionQuantity(action, spec, fallbackPositionPct) }
case 'ADD_SHORT':
  return { kind: 'ADD_SHORT', quantity: this.resolveActionQuantity(action, spec, fallbackPositionPct) }
```

When building IR portfolio:

```ts
const pyramidingLimit = this.resolvePyramidingLimit(input.canonicalSpec)
allowPyramiding: hasOrderPrograms || pyramidingLimit.maxLayers > 1,
maxPyramidingLayers: hasOrderPrograms ? orderProgramLevelCount : pyramidingLimit.maxLayers,
```

Add runtime requirements when Phase 2 actions exist:

```ts
if (this.hasPositionLifecycleActions(input.canonicalSpec)) {
  context.runtimeRequirements.helpers.add('positionLifecycle')
  context.runtimeRequirements.stateKeys.add('pyramiding_layer_count')
}
```

- [ ] **Step 6: Preserve metadata through AST**

In `CanonicalStrategyAstCompilerService`, copy `rule.metadata` onto `DecisionProgramNode`:

```ts
metadata: rule.metadata,
```

This must include `reversePosition`, `addPosition`, and `dcaSchedule`.

- [ ] **Step 7: Run canonical/IR tests**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-canonical-ir.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit canonical and IR support**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec-v2.ts \
  apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ir.ts \
  apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ast.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-canonical-ir.spec.ts
git commit -F - <<'MSG'
feat(ai-quant): compile position lifecycle atoms to IR

Refs: #984
MSG
```

## Task 5: Execute Phase 2 Decisions In Shared Runtime

**Files:**
- Modify: `packages/shared/src/strategy-protocol.ts`
- Modify: `packages/shared/src/script-engine/compiled-runtime/run-decision-programs.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-runtime.spec.ts`

- [ ] **Step 1: Add failing runtime tests**

Create `atomic-contract-position-lifecycle-runtime.spec.ts`:

```ts
import { runDecisionPrograms } from '@ai/shared/script-engine/compiled-runtime'
import type { StrategyExecutionContextV1 } from '@ai/shared'

describe('compiled runtime position lifecycle', () => {
  function ctx(overrides: Partial<StrategyExecutionContextV1> = {}): StrategyExecutionContextV1 {
    return {
      currentPrice: 100,
      accountEquity: 1000,
      position: { side: 'long', qty: 2, avgPrice: 90, notional: 200 },
      semanticRuntimeState: {},
      ...overrides,
    } as StrategyExecutionContextV1
  }

  it('truncates reduce quantity to current position and never reverses', () => {
    const decision = runDecisionPrograms(
      ctx(),
      [{
        id: 'reduce-too-much',
        phase: 'exit',
        priority: 1,
        when: 'always',
        actions: [{ kind: 'REDUCE_LONG', quantity: { mode: 'fixed_base', value: 5 } }],
      }],
      { always: true },
      {},
      ['reduce-too-much'],
    )

    expect(decision).toEqual(expect.objectContaining({
      action: 'ADJUST_POSITION',
      adjustMode: 'DELTA',
      size: { mode: 'QTY', value: -2 },
    }))
  })

  it('blocks add when max layers is reached', () => {
    const decision = runDecisionPrograms(
      ctx({ semanticRuntimeState: { pyramiding_layer_count: { value: 3 } } }),
      [{
        id: 'add-long',
        phase: 'entry',
        priority: 1,
        when: 'always',
        metadata: { addPosition: { maxLayers: 3, stateKey: 'pyramiding_layer_count' } },
        actions: [{ kind: 'ADD_LONG', quantity: { mode: 'pct_equity', value: 0.2 } }],
      }],
      { always: true },
      {},
      ['add-long'],
    )

    expect(decision).toEqual(expect.objectContaining({
      action: 'NOOP',
      reason: 'compiled.add-long.pyramiding_limit',
    }))
  })

  it('returns close-before-open reverse decision before opening opposite side', () => {
    const decision = runDecisionPrograms(
      ctx(),
      [{
        id: 'reverse-short',
        phase: 'exit',
        priority: 1,
        when: 'always',
        metadata: {
          reversePosition: {
            fromSide: 'long',
            toSide: 'short',
            sameBarPolicy: 'allow',
            sizingSource: 'current_position',
          },
        },
        actions: [
          { kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 1 } },
          { kind: 'OPEN_SHORT', quantity: { mode: 'position_pct', value: 1 } },
        ],
      }],
      { always: true },
      {},
      ['reverse-short'],
    )

    expect(decision).toEqual(expect.objectContaining({
      action: 'CLOSE_LONG',
      reason: 'compiled.reverse-short.reverse.close_first',
    }))
  })
})
```

- [ ] **Step 2: Run runtime test and verify it fails**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-runtime.spec.ts
```

Expected: FAIL because runtime does not understand `ADD_LONG` and reverse metadata.

- [ ] **Step 3: Type runtime context fields**

In `packages/shared/src/strategy-protocol.ts`, add optional fields:

```ts
position?: {
  side?: 'long' | 'short' | 'flat'
  qty?: number
  avgPrice?: number
  notional?: number
}
accountEquity?: number
semanticRuntimeState?: Record<string, Record<string, unknown>>
```

- [ ] **Step 4: Extend runtime action types**

In `run-decision-programs.ts`, extend action kinds:

```ts
kind:
  | 'OPEN_LONG' | 'OPEN_SHORT'
  | 'CLOSE_LONG' | 'CLOSE_SHORT'
  | 'REDUCE_LONG' | 'REDUCE_SHORT'
  | 'ADD_LONG' | 'ADD_SHORT'
```

Extend metadata:

```ts
metadata?: {
  partialTakeProfit?: PartialTakeProfitMeta
  addPosition?: { maxLayers?: number; maxExposurePct?: number; stateKey: string }
  reversePosition?: {
    fromSide: 'long' | 'short'
    toSide: 'long' | 'short'
    sameBarPolicy: 'allow' | 'next_bar_only'
    sizingSource: 'current_position' | 'fixed' | 'position_sizing'
  }
  dcaSchedule?: { maxCount: number; capitalCap: number; stateKey: string }
}
```

- [ ] **Step 5: Implement fail-closed lifecycle decisions**

In `buildFirstApplicableDecision`, before iterating actions, add:

```ts
const lifecycleBlock = evaluatePositionLifecycleBlock(program, ctx)
if (lifecycleBlock) return lifecycleBlock
```

Add helper:

```ts
function evaluatePositionLifecycleBlock(
  program: DecisionProgramNode,
  ctx: StrategyExecutionContextV1,
): StrategyDecisionV1 | null {
  const reverse = program.metadata?.reversePosition
  if (reverse) {
    const qty = Math.abs(readCurrentQty(ctx))
    if (qty === 0) {
      return { action: 'NOOP', reason: `compiled.${program.id}.reverse.no_position` }
    }
    return {
      action: reverse.fromSide === 'long' ? 'CLOSE_LONG' : 'CLOSE_SHORT',
      size: { mode: 'QTY', value: qty },
      reason: `compiled.${program.id}.reverse.close_first`,
    }
  }

  const add = program.metadata?.addPosition
  if (add?.maxLayers !== undefined) {
    const state = readSemanticStateSlot(ctx, add.stateKey)
    const currentLayers = typeof state.value === 'number' ? state.value : 0
    if (currentLayers >= add.maxLayers) {
      return { action: 'NOOP', reason: `compiled.${program.id}.pyramiding_limit` }
    }
  }

  const dca = program.metadata?.dcaSchedule
  if (dca) {
    const state = readSemanticStateSlot(ctx, dca.stateKey)
    const firedCount = typeof state.value === 'number' ? state.value : 0
    if (firedCount >= dca.maxCount) {
      return { action: 'NOOP', reason: `compiled.${program.id}.dca_max_count` }
    }
  }

  return null
}

function readSemanticStateSlot(
  ctx: StrategyExecutionContextV1,
  key: string,
): Record<string, unknown> {
  const root = ctx.semanticRuntimeState
  const slot = root?.[key]
  return slot && typeof slot === 'object' && !Array.isArray(slot) ? slot : {}
}
```

- [ ] **Step 6: Map add actions and harden reduce truncation**

In `buildDecision`, handle add:

```ts
if (action.kind === 'ADD_LONG' || action.kind === 'ADD_SHORT') {
  return {
    action: action.kind === 'ADD_LONG' ? 'OPEN_LONG' : 'OPEN_SHORT',
    size: mapQuantityToDecisionSize(action.quantity, ctx),
    reason: `compiled.${programId}`,
  }
}
```

Ensure reduce delta never exceeds current quantity:

```ts
const cappedDeltaQty = Math.min(Math.abs(deltaQty), Math.abs(currentQty))
const signedDeltaQty = currentQty > 0 ? -cappedDeltaQty : cappedDeltaQty
```

Return `signedDeltaQty`.

- [ ] **Step 7: Run runtime tests**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-runtime.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit runtime support**

```bash
git add packages/shared/src/strategy-protocol.ts \
  packages/shared/src/script-engine/compiled-runtime/run-decision-programs.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-runtime.spec.ts
git commit -F - <<'MSG'
feat(shared): execute position lifecycle decisions

Refs: #984
MSG
```

## Task 6: Add Backtest, Live Signal, And Deploy Closure Tests

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-parity.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/compiled-script-parser.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/compiled-script-parser.service.spec.ts`

- [ ] **Step 1: Write parity test**

Create `atomic-contract-position-lifecycle-parity.spec.ts`:

```ts
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptParserService } from '../compiled-script-parser.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { runDecisionPrograms } from '@ai/shared/script-engine/compiled-runtime'

describe('position lifecycle backtest/live compiled parity', () => {
  it('uses the same compiled decision program for add_position in both paths', () => {
    const extractor = new SemanticSeedExtractorService()
    const builder = new SemanticSeedStateBuilderService()
    const readiness = new SemanticContractReadinessService()
    const canonical = new CanonicalSpecBuilderService()
    const irCompiler = new CanonicalSpecV2IrCompilerService()
    const astCompiler = new CanonicalStrategyAstCompilerService()
    const emitter = new CompiledScriptEmitterService()
    const parser = new CompiledScriptParserService()

    const state = builder.build(extractor.extract('BTC 回踩 MA20 不破后加仓，每次加仓 20%，最多加仓 3 次。'))
    if (!state) throw new Error('state_not_built')
    const normalized = readiness.normalize(state)
    expect(normalized.ready).toBe(true)

    const spec = canonical.build({ semanticState: normalized.state, market: { symbol: 'BTCUSDT', timeframe: '15m' } })
    const ir = irCompiler.compile({
      canonicalSpec: spec,
      fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 0.1 },
    }).ir
    const ast = astCompiler.compile({ ir })
    const script = emitter.emit({ ast, executionEnvelope: { accountId: 'acct-1', exchangeAccountId: 'ex-1' } })
    const parsed = parser.parse(script)

    expect(parsed.decisionPrograms).toEqual(expect.arrayContaining([
      expect.objectContaining({
        actions: expect.arrayContaining([expect.objectContaining({ kind: 'ADD_LONG' })]),
      }),
    ]))

    const sharedCtx = {
      currentPrice: 100,
      accountEquity: 1000,
      position: { side: 'long', qty: 1, avgPrice: 90, notional: 100 },
      semanticRuntimeState: { pyramiding_layer_count: { value: 0 } },
    }
    const exprValues = Object.fromEntries((parsed.decisionPrograms ?? []).map(program => [program.when, true]))
    const decisionA = runDecisionPrograms(sharedCtx, parsed.decisionPrograms ?? [], exprValues, {}, parsed.topology?.decisionOrder ?? [])
    const decisionB = runDecisionPrograms(sharedCtx, parsed.decisionPrograms ?? [], exprValues, {}, parsed.topology?.decisionOrder ?? [])

    expect(decisionA).toEqual(decisionB)
    expect(decisionA.action).toBe('OPEN_LONG')
  })
})
```

- [ ] **Step 2: Run parity test and verify parser metadata is preserved**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-parity.spec.ts
```

Expected: PASS after Tasks 4 and 5. A failure that shows `metadata` missing means `CompiledScriptParserService` is dropping decision program metadata.

- [ ] **Step 3: Preserve decision program metadata in parser**

Update `CompiledScriptParserService` so parsed compiler.v1 decision programs keep their `metadata` field. Add this assertion to parser-related tests:

```ts
expect(parsed.decisionPrograms?.[0]?.metadata).toEqual(expect.objectContaining({
  addPosition: expect.objectContaining({ stateKey: 'pyramiding_layer_count' }),
}))
```

- [ ] **Step 4: Commit parity coverage**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-parity.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/compiled-script-parser.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/compiled-script-parser.service.spec.ts
git commit -F - <<'MSG'
test(ai-quant): cover position lifecycle compiled parity

Refs: #984
MSG
```

## Task 7: Final Verification

**Files:**
- All files touched by Tasks 1-6.

- [ ] **Step 1: Run targeted Phase 2 tests**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-semantics.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-canonical-ir.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-runtime.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-position-lifecycle-parity.spec.ts
```

Expected: all PASS.

- [ ] **Step 2: Run adjacent regression tests**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-canonical-ir.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-script-emitter.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-backtest-runtime-parity.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts
```

Expected: all PASS.

- [ ] **Step 3: Build affected target**

```bash
dx build quantify --dev
```

Expected: PASS.

- [ ] **Step 4: Check whitespace**

```bash
git diff --check
```

Expected: no output.

- [ ] **Step 5: Commit verification report**

Create `docs/testing/reports/2026-05-08-ai-quant-position-lifecycle-contract-verification.md` with command results. Then:

```bash
git add docs/testing/reports/2026-05-08-ai-quant-position-lifecycle-contract-verification.md
git commit -F - <<'MSG'
docs(ai-quant): record phase2 position lifecycle verification

Refs: #984
MSG
```
