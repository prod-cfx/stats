# Stage 4 PR4 Action Program Atoms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Stage 4 PR4 action/program atom coverage through the rules-only acceptance chain from dialogue utterance to deploy payload, marking unsupported runtime/deploy gaps fail-closed.

**Architecture:** `SemanticState.rules[]` is the only accepted mainflow. Matrix rows define PR4 truth; tests prove typed rules routing, readiness/display/canonical/IR/runtime/backtest/deploy evidence for ready atoms, and concrete blockers for non-ready atoms. No test may use legacy checklist helpers as PR4 acceptance evidence.

**Tech Stack:** TypeScript, Jest, NestJS services under `apps/quantify/src/modules/llm-strategy-codegen`, Nx/DX commands.

---

## File Map

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/atom-coverage-matrix.ts`  
  Add direct PR4 action/program rows, statuses, examples, source-path shape labels, and blockers.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/atom-coverage-matrix.spec.ts`  
  Add PR4 matrix invariants and deploy-ready/non-ready rules.
- Create: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/action-program-dialogue-entrance.spec.ts`  
  Prove attempt-1 utterances enter `rules[].effects.actions` or `rules[].effects.programs` only.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts`  
  Add rules-only action/program canonical source-path checks, using `SemanticState.rules[]` fixtures only.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts`  
  Add display graph checks for action/program source paths.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts`  
  Add deploy/backtest source-chain checks or fail-closed checks for PR4 ready/unsupported rows.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/stage4-real-strategy-corpus.ts`  
  Add action/program real strategy cases, with `expectedFailure` for unsupported runtime/deploy paths.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/real-strategy-corpus.spec.ts`  
  Extend corpus validation if new categories or expected keys require test coverage.

## Guardrails

- Do not use `buildFromLegacyChecklistForTestsOnly` for PR4 acceptance tests.
- Do not add flat projection, legacy fallback, or old five-bucket bypass.
- Do not promote any atom to `deploy_ready` unless it proves the full chain: utterance -> planner/dispatcher -> `semanticPatch.rules[]` -> typed role -> readiness slots -> assistant text -> display -> canonical spec -> IR -> script/runtime evaluator -> backtest -> deploy payload.
- Keep DCA program low-status; existing DCA support remains `position.dca_schedule` under `rules[].effects.positions`.
- Unsupported runtime/deploy rows require a concrete `unsupportedReason` and must not set both `reachesBacktest` and `reachesDeployPayload` to true.

### Task 1: Add PR4 Matrix Tests First

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/atom-coverage-matrix.spec.ts`

- [ ] **Step 1: Add PR4 key lists near existing PR3 lists**

Insert after `pr3PositionAtomKeys`:

```ts
const pr4ActionAtomKeys = [
  'action.open_long',
  'action.open_short',
  'action.close_long',
  'action.close_short',
  'action.add_position',
  'action.reduce_position',
  'action.reverse_position',
  'action.conditional_order',
  'action.limit_order',
] as const

const pr4ProgramAtomKeys = [
  'program.fixed_grid_gated',
  'program.twap',
  'program.dca',
  'program.martingale',
  'program.rebalance',
  'program.iceberg',
] as const
```

- [ ] **Step 2: Add PR4 row constant inside `describe`**

Add after `const pr3Rows = ...`:

```ts
  const pr4Rows = STAGE4_ATOM_COVERAGE_MATRIX.filter(row => row.prBatch === 'pr4-action-program')
```

- [ ] **Step 3: Add direct action/program rule-path tests**

Append in the `describe` block:

```ts
  it('contains direct PR4 action atom rows under typed action effects', () => {
    const rowsByKey = new Map(STAGE4_ATOM_COVERAGE_MATRIX.map(row => [row.atomKey, row]))

    for (const key of pr4ActionAtomKeys) {
      const row = rowsByKey.get(key)
      expect(row).toBeDefined()
      expect(row?.family).toBe('action')
      expect(row?.rulePath).toBe('rules[].effects.actions')
      expect(row?.coveredAtomKeys).toEqual([key])
      expect(row?.prBatch).toBe('pr4-action-program')
    }
  })

  it('contains direct PR4 program atom rows under typed program effects', () => {
    const rowsByKey = new Map(STAGE4_ATOM_COVERAGE_MATRIX.map(row => [row.atomKey, row]))

    for (const key of pr4ProgramAtomKeys) {
      const row = rowsByKey.get(key)
      expect(row).toBeDefined()
      expect(row?.family).toBe('program')
      expect(row?.rulePath).toBe('rules[].effects.programs')
      expect(row?.coveredAtomKeys).toEqual([key])
      expect(row?.prBatch).toBe('pr4-action-program')
    }
  })
```

- [ ] **Step 4: Add PR4 deploy-ready and blocker invariant tests**

Append:

```ts
  it('requires deploy-ready PR4 rows to declare full rules acceptance coverage', () => {
    const invalidRows = pr4Rows.filter(row =>
      isStage4DeployReadyAtom(row)
      && (
        row.utteranceExamples.length < 3
        || !row.displayShape.includes('source path')
        || !row.canonicalShape.includes('source path')
        || !row.irShape.includes('source path')
        || !row.runtimeRequirement.includes('runtime evaluator')
        || !row.deployPayloadImpact.some(item => item.includes('sourcePath'))
        || !row.reachesBacktest
        || !row.reachesDeployPayload
        || row.unsupportedReason !== null
      ),
    )

    expect(invalidRows).toEqual([])
  })

  it('does not let PR4 action and program rows remain empty planned coverage', () => {
    expect(pr4Rows.every(row => row.status === 'planned')).toBe(false)
    expect(pr4Rows.filter(isStage4DeployReadyAtom).length).toBeGreaterThan(0)
  })

  it('requires non deploy-ready PR4 rows to carry concrete blockers', () => {
    const invalidRows = pr4Rows.filter(row =>
      !isStage4DeployReadyAtom(row)
      && (
        row.unsupportedReason === null
        || (row.reachesBacktest && row.reachesDeployPayload)
      ),
    )

    expect(invalidRows).toEqual([])
  })

  it('keeps DCA program distinct from existing position DCA support', () => {
    const dcaProgram = STAGE4_ATOM_COVERAGE_MATRIX.find(row => row.atomKey === 'program.dca')
    const dcaPosition = STAGE4_ATOM_COVERAGE_MATRIX.find(row => row.atomKey === 'position.dca_schedule')

    expect(dcaProgram?.family).toBe('program')
    expect(dcaProgram?.rulePath).toBe('rules[].effects.programs')
    expect(dcaProgram?.unsupportedReason).toBe('program_dca_lifecycle_deploy_binding_missing')
    expect(isStage4DeployReadyAtom(dcaProgram!)).toBe(false)
    expect(dcaPosition?.family).toBe('position')
    expect(dcaPosition?.rulePath).toBe('rules[].effects.positions')
  })
```

- [ ] **Step 5: Run matrix test and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/atom-coverage-matrix.spec.ts
```

Expected: FAIL because PR4 direct rows do not exist yet or are still planned without blockers.

### Task 2: Implement PR4 Matrix Rows

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/atom-coverage-matrix.ts`

- [ ] **Step 1: Replace umbrella action/program PR4 foundation rows with direct rows**

Remove or supersede `action.foundation.open_position` and `program.foundation.fixed_grid` foundation rows by adding direct rows for each PR4 key. Use this exact shape pattern for ready action rows:

```ts
  {
    atomKey: 'action.open_long',
    family: 'action',
    rulePath: 'rules[].effects.actions',
    coveredAtomKeys: ['action.open_long'],
    paramsSchema: ['side', 'orderType', 'sizing'],
    requiredSlots: ['side'],
    utteranceExamples: ['EMA20 上穿 EMA50 开多，单笔 10% 仓位。', 'RSI14 低于 30 时开多。', 'Open long when EMA20 crosses above EMA50.'],
    displayShape: 'action open long effect with rules source path',
    canonicalShape: 'CanonicalRuleAction:OPEN_LONG with source path',
    irShape: 'ruleBlocks.actions:OPEN_LONG with source path',
    runtimeRequirement: 'script/runtime evaluator opens long position from rules action source path',
    requiredDataSources: ['none'],
    deployPayloadImpact: ['ruleBlocks.actions.sourcePath', 'deployPayload.execution.actions.sourcePath'],
    corpusCases: ['pr4-trend-open-close'],
    status: 'deploy_ready',
    unsupportedReason: null,
    prBatch: 'pr4-action-program',
    reachesBacktest: true,
    reachesDeployPayload: true,
  },
```

- [ ] **Step 2: Add ready rows for supported action atoms**

Create equivalent rows for:

```ts
'action.open_short'
'action.close_long'
'action.close_short'
'action.add_position'
'action.reverse_position'
```

Use these status values:

```ts
status: 'deploy_ready'
unsupportedReason: null
reachesBacktest: true
reachesDeployPayload: true
```

Use `runtimeRequirement` text containing `script/runtime evaluator` and `deployPayloadImpact` containing `sourcePath` for every ready row.

- [ ] **Step 3: Add non-ready action rows with blockers**

Add these low-status rows:

```ts
  {
    atomKey: 'action.reduce_position',
    family: 'action',
    rulePath: 'rules[].effects.actions',
    coveredAtomKeys: ['action.reduce_position'],
    paramsSchema: ['side', 'reducePct', 'orderType'],
    requiredSlots: ['reducePct'],
    utteranceExamples: ['盈利 5% 减仓一半。', 'Reduce 50% when profit reaches 5%.', '价格跌破 EMA20 后减仓 30%。'],
    displayShape: 'reduce action effect with rules source path',
    canonicalShape: 'unsupported reduce action canonical source path missing for generic action atom',
    irShape: 'unsupported generic reduce action source path missing',
    runtimeRequirement: 'runtime evaluator only supports reduce through partial take profit paths today',
    requiredDataSources: ['none'],
    deployPayloadImpact: ['unsupported:deployPayload.execution.reduceAction.sourcePath'],
    corpusCases: ['pr4-reduce-unsupported'],
    status: 'dialogue_ready',
    unsupportedReason: 'generic_reduce_action_deploy_binding_missing',
    prBatch: 'pr4-action-program',
    reachesBacktest: false,
    reachesDeployPayload: false,
  },
```

Use the same low-status row shape for these two exact rows, changing `atomKey`, `paramsSchema`, `requiredSlots`, `utteranceExamples`, shapes, corpus case, and blocker as shown:

```ts
{
  atomKey: 'action.conditional_order',
  paramsSchema: ['triggerCondition', 'side', 'orderType'],
  requiredSlots: ['triggerCondition'],
  utteranceExamples: ['突破 70000 后下条件单开多。', 'Only place the order if BTC breaks 70000.', '价格回踩 EMA20 后触发买入条件单。'],
  unsupportedReason: 'conditional_order_runtime_binding_missing',
  corpusCases: ['pr4-conditional-order-unsupported'],
}

{
  atomKey: 'action.limit_order',
  paramsSchema: ['limitPrice', 'side', 'timeInForce'],
  requiredSlots: ['limitPrice'],
  utteranceExamples: ['BTC 到 65000 限价买入。', 'Place a limit buy at 65000.', '反弹到 70000 限价平多。'],
  unsupportedReason: 'limit_order_deploy_payload_binding_missing',
  corpusCases: ['pr4-limit-order-unsupported'],
}
```

- [ ] **Step 4: Add program rows**

Add a ready row only for `program.fixed_grid_gated` if current tests prove full source-path deploy chain. If not proven during implementation, mark it low status with `unsupportedReason: 'program_deploy_payload_binding_missing'`.

Add low-status rows for these exact program gaps:

```ts
{
  atomKey: 'program.twap',
  unsupportedReason: 'program_twap_runtime_binding_missing',
  corpusCases: ['pr4-twap-unsupported'],
}
{
  atomKey: 'program.dca',
  unsupportedReason: 'program_dca_lifecycle_deploy_binding_missing',
  corpusCases: ['pr4-dca-program-unsupported'],
}
{
  atomKey: 'program.martingale',
  unsupportedReason: 'program_martingale_runtime_binding_missing',
  corpusCases: ['pr4-martingale-unsupported'],
}
{
  atomKey: 'program.rebalance',
  unsupportedReason: 'program_rebalance_runtime_binding_missing',
  corpusCases: ['pr4-rebalance-unsupported'],
}
{
  atomKey: 'program.iceberg',
  unsupportedReason: 'program_iceberg_runtime_binding_missing',
  corpusCases: ['pr4-iceberg-unsupported'],
}
```

Each low-status program row must use:

```ts
status: 'dialogue_ready'
reachesBacktest: false
reachesDeployPayload: false
```

- [ ] **Step 5: Run matrix test and verify pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/atom-coverage-matrix.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit matrix changes**

Run:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/stage4/atom-coverage-matrix.ts apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/atom-coverage-matrix.spec.ts
git commit -F - <<'MSG'
test: add stage4 pr4 matrix coverage

Refs: #1738
MSG
```

### Task 3: Add Action/Program Dialogue Entrance Tests

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/action-program-dialogue-entrance.spec.ts`

- [ ] **Step 1: Create the failing test file**

Add:

```ts
import { collectAtomLeaves, isRuleEffectsByRole } from '../../types/atom-expr'
import { GenericSeedDispatcher } from '../../services/generic-seed-dispatcher.service'

type DispatchPatch = ReturnType<GenericSeedDispatcher['dispatch']>
type EffectRole = 'actions' | 'risks' | 'positions' | 'orchestration' | 'programs'

function collectEffectKeys(patch: DispatchPatch, role: EffectRole): string[] {
  return (patch.rules ?? []).flatMap((rule) => {
    if (!isRuleEffectsByRole(rule.effects)) return []
    return rule.effects[role].flatMap(effect => collectAtomLeaves(effect).map(leaf => leaf.key))
  })
}

function collectConditionKeys(patch: DispatchPatch): string[] {
  return (patch.rules ?? []).flatMap(rule => collectAtomLeaves(rule.condition).map(leaf => leaf.key))
}

function expectOnlyRole(patch: DispatchPatch, key: string, role: EffectRole): void {
  expect(collectEffectKeys(patch, role)).toContain(key)
  expect(collectConditionKeys(patch)).not.toContain(key)
  for (const candidate of ['actions', 'risks', 'positions', 'orchestration', 'programs'] as const) {
    if (candidate === role) continue
    expect(collectEffectKeys(patch, candidate)).not.toContain(key)
  }
}

function expectTypedRules(patch: DispatchPatch): void {
  expect(patch.rules?.length ?? 0).toBeGreaterThan(0)
  for (const rule of patch.rules ?? []) {
    expect(isRuleEffectsByRole(rule.effects)).toBe(true)
  }
}

describe('Stage 4 PR4 action and program dialogue entrance', () => {
  const dispatcher = new GenericSeedDispatcher()

  it.each([
    ['action.open_long', 'EMA20 上穿 EMA50 开多，单笔 10% 仓位。'],
    ['action.open_short', 'EMA20 下穿 EMA50 开空，单笔 10% 仓位。'],
    ['action.close_long', 'RSI 高于 70 平多。'],
    ['action.close_short', 'RSI 低于 30 平空。'],
    ['action.add_position', 'EMA20 上穿开多，盈利 2% 后加仓 10%。'],
    ['action.reverse_position', 'EMA20 下穿 EMA50 时从多头反手做空。'],
  ])('attempt-1 routes %s utterance into rules[].effects.actions only', (expectedKey, utterance) => {
    const patch = dispatcher.dispatch(utterance)

    expectTypedRules(patch)
    expectOnlyRole(patch, expectedKey, 'actions')
  })

  it.each([
    ['program.fixed_grid_gated', 'BTC 在 60000 到 70000 之间做 20 格网格，每格 100 USDT。'],
    ['program.twap', '把 1000 USDT 分 10 次在 1 小时内 TWAP 买入 BTC。'],
    ['program.dca', 'BTC 每下跌 3% 做一次 DCA program，最多 3 次。'],
    ['program.martingale', '亏损后按 2 倍 martingale 加码，最多 3 层。'],
    ['program.rebalance', 'BTC 和 ETH 每天再平衡到 50% 50%。'],
    ['program.iceberg', '用 iceberg 订单把 10 BTC 拆成每次 0.5 BTC 卖出。'],
  ])('attempt-1 routes %s utterance into rules[].effects.programs only when recognized', (expectedKey, utterance) => {
    const patch = dispatcher.dispatch(utterance)

    expectTypedRules(patch)
    expectOnlyRole(patch, expectedKey, 'programs')
  })

  it('does not duplicate entry or exit rules when action and position appear together', () => {
    const patch = dispatcher.dispatch('EMA20 上穿 EMA50 开多，盈利 2% 后加仓 10%，单笔 10% 仓位。')

    expectTypedRules(patch)
    expect((patch.rules ?? []).filter(rule => rule.phase === 'entry')).toHaveLength(1)
    expect(collectEffectKeys(patch, 'actions').filter(key => key === 'action.open_long')).toHaveLength(1)
    expect(collectEffectKeys(patch, 'actions').filter(key => key === 'action.add_position')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the new test and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/action-program-dialogue-entrance.spec.ts
```

Expected: FAIL for any unsupported utterance not yet routed to the expected typed role.

- [ ] **Step 3: Adjust unsupported program expectations if current dispatcher cannot route them**

If a low-status program atom is not recognized by dispatcher at all, keep the matrix blocker and change only that test row to assert no deploy-ready claim. Use this helper:

```ts
function expectNotDeployReadyProgramGap(patch: DispatchPatch, expectedKey: string): void {
  expectTypedRules(patch)
  expect(collectEffectKeys(patch, 'actions')).not.toContain(expectedKey)
  expect(collectEffectKeys(patch, 'risks')).not.toContain(expectedKey)
  expect(collectEffectKeys(patch, 'positions')).not.toContain(expectedKey)
}
```

Then split low-status program cases into a separate `it.each` that documents current fail-closed behavior. Do not relax ready action cases.

- [ ] **Step 4: Make minimal dispatcher changes only for supported PR4 atoms**

If ready action atoms fail to route, modify `apps/quantify/src/modules/llm-strategy-codegen/services/generic-seed-dispatcher.service.ts` using existing pattern-based dispatch helpers. Keep changes scoped to mapping natural-language action intent into typed `rules[].effects.actions` or `rules[].effects.programs`. Do not emit flat buckets.

- [ ] **Step 5: Run dialogue entrance test and verify pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/action-program-dialogue-entrance.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit dialogue changes**

Run:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/action-program-dialogue-entrance.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/generic-seed-dispatcher.service.ts
git commit -F - <<'MSG'
test: add stage4 pr4 dialogue routing

Refs: #1738
MSG
```

### Task 4: Prove Rules-Only Canonical Source Paths

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts`

- [ ] **Step 1: Add action canonical test using rules-only fixture**

Add a test that constructs `SemanticState` with `rules[]` and typed `effects.actions` directly. Use this fixture shape:

```ts
const rulesOnlyOpenLongState = {
  version: 1,
  triggers: [],
  actions: [],
  risk: [],
  position: [],
  rules: [
    {
      id: 'entry-open-long',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'indicator.cross_over', params: { indicator: 'EMA', fastPeriod: 20, slowPeriod: 50 } },
      effects: {
        actions: [{ kind: 'atom', key: 'action.open_long', params: { sizing: { mode: 'RATIO', value: 0.1 } } }],
        risks: [],
        positions: [],
        orchestration: [],
        programs: [],
      },
      evidence: { text: 'EMA20 上穿 EMA50 开多，单笔 10% 仓位。', source: 'user_explicit' },
    },
  ],
} as const
```

Assert:

```ts
const spec = builder.buildFromSemanticState(rulesOnlyOpenLongState)
expect(spec.rules[0]?.actions[0]).toMatchObject({ type: 'OPEN_LONG', atomKey: 'action.open_long' })
expect(spec.rules[0]?.metadata?.sourcePath ?? spec.rules[0]?.actions[0]?.sourcePath).toContain('rules[0].effects.actions[0]')
```

- [ ] **Step 2: Add program canonical test if fixed grid is marked ready**

If `program.fixed_grid_gated` is `deploy_ready`, add a rules-only fixture with `effects.programs[0].key = 'program.fixed_grid_gated'` and assert canonical `orderPrograms` or `orchestration.programs` contains a source path rooted at `rules[0].effects.programs[0]`.

If fixed grid is low-status, add a fail-closed test asserting no deploy-ready path is claimed by matrix rather than forcing canonical support.

- [ ] **Step 3: Run focused canonical test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts
```

Expected: PASS after minimal builder/source-path fixes.

- [ ] **Step 4: Commit canonical evidence changes**

Run:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts
git commit -F - <<'MSG'
test: prove pr4 canonical rules source paths

Refs: #1738
MSG
```

### Task 5: Prove Display, IR, Runtime, Backtest, and Deploy Chain

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts`
- Modify as needed: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts`

- [ ] **Step 1: Add display graph action source path assertion**

In `display-logic-graph-rules-tree.spec.ts`, add a rules-only action fixture and assert serialized graph contains:

```ts
expect(serialized).toContain('rules[0].effects.actions[0]')
expect(serialized).toContain('action.open_long')
```

- [ ] **Step 2: Add publication hash-chain action assertion**

In `publication-gate-rules-only-hash-chain.spec.ts`, add or extend a rules-only action case to assert deploy/backtest payload carries one action source path:

```ts
expect(JSON.stringify(result)).toContain('rules[0].effects.actions[0]')
expect(JSON.stringify(result)).toContain('OPEN_LONG')
```

- [ ] **Step 3: Add fail-closed unsupported program assertion**

Add a matrix-backed assertion that low-status program rows do not produce fake deploy payload evidence:

```ts
const unsupportedProgramRows = STAGE4_ATOM_COVERAGE_MATRIX.filter(row =>
  row.prBatch === 'pr4-action-program'
  && row.family === 'program'
  && !isStage4DeployReadyAtom(row),
)

expect(unsupportedProgramRows.map(row => row.unsupportedReason)).not.toContain(null)
expect(unsupportedProgramRows.every(row => !(row.reachesBacktest && row.reachesDeployPayload))).toBe(true)
```

- [ ] **Step 4: Run display and publication tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts
```

Expected: PASS. If source path is missing in IR/deploy, add minimal source-path propagation in `canonical-spec-v2-ir-compiler.service.ts`; do not create deploy payload for unsupported program rows.

- [ ] **Step 5: Commit downstream evidence changes**

Run:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts
git commit -F - <<'MSG'
test: prove pr4 rules source chain

Refs: #1738
MSG
```

### Task 6: Extend Real Strategy Corpus

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/stage4-real-strategy-corpus.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/real-strategy-corpus.spec.ts`

- [ ] **Step 1: Add corpus categories if needed**

If `Stage4RealStrategyCategory` does not include action/program names needed by new cases, extend it with:

```ts
  | 'action_lifecycle'
  | 'execution_program'
```

- [ ] **Step 2: Add action/program cases**

Append cases like:

```ts
  {
    id: 'stage4-action-open-close-reverse',
    category: 'action_lifecycle',
    initialUserMessage: 'BTC 15m EMA20 上穿 EMA50 开多，EMA20 下穿 EMA50 平多并反手做空，单笔 10% 仓位。',
    expectedAtomKeys: ['indicator.cross_over', 'indicator.cross_under', 'action.open_long', 'action.close_long', 'action.reverse_position', 'position.sizing'],
    expectedSemanticIntent: ['trend entry', 'close long', 'reverse to short', 'fixed ratio sizing'],
    clarificationTurns: [],
    expectedFailure: null,
  },
  {
    id: 'stage4-program-dca-gap',
    category: 'execution_program',
    initialUserMessage: 'BTC 每下跌 3% 做一次 DCA program，最多 3 次，每次 100 USDT。',
    expectedAtomKeys: ['program.dca'],
    expectedSemanticIntent: ['DCA program gap tracked separately from position.dca_schedule'],
    clarificationTurns: [],
    expectedFailure: 'deploy_payload_missing_binding',
  },
```

- [ ] **Step 3: Update corpus tests if blocker enum rejects expected failure**

If `Stage4BlockerKind` does not include `deploy_payload_missing_binding`, choose the existing concrete blocker enum used by Stage 4 for missing deploy bindings. Do not add a vague blocker.

- [ ] **Step 4: Run corpus tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/real-strategy-corpus.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit corpus changes**

Run:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/stage4/stage4-real-strategy-corpus.ts apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/real-strategy-corpus.spec.ts
git commit -F - <<'MSG'
test: add stage4 pr4 strategy corpus cases

Refs: #1738
MSG
```

### Task 7: Run Required Verification

**Files:**
- No planned file changes unless verification exposes a real failure.

- [ ] **Step 1: Run Stage 4 unit tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4
```

Expected: PASS.

- [ ] **Step 2: Run atom contract tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/atom-contracts
```

Expected: PASS.

- [ ] **Step 3: Run rules-only mainflow canonical test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Run publication gate hash-chain test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Run display graph rules-tree test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Build quantify**

Run:

```bash
dx build quantify --dev
```

Expected: PASS.

- [ ] **Step 7: Commit verification-only fixes if any**

If verification required code fixes, stage the PR4 files that this plan allows and commit them:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/stage4/atom-coverage-matrix.ts \
  apps/quantify/src/modules/llm-strategy-codegen/stage4/stage4-real-strategy-corpus.ts \
  apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__ \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/generic-seed-dispatcher.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts
git commit -F - <<'MSG'
fix: stabilize stage4 pr4 verification

Refs: #1738
MSG
```

If no fixes were required, do not create an empty commit.

## Self-Review Notes

- Spec coverage: tasks cover matrix, rules-only dialogue entrance, readiness/assistant text requirement via deploy-ready row invariants and downstream source-path tests, display, canonical spec, IR, runtime/backtest/deploy evidence, DCA program low-status blocker, and real corpus updates.
- Red-flag scan: no unfinished markers, angle-bracket file markers, or vague implementation markers are used.
- Type consistency: plan uses existing `Stage4AtomCoverageRow`, `RuleEffectsByRole`, `GenericSeedDispatcher`, `STAGE4_ATOM_COVERAGE_MATRIX`, and existing Stage 4 test command patterns.
