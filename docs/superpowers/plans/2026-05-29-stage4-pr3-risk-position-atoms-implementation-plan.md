# Stage 4 PR3 Risk and Position Atoms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand Stage 4 PR3 risk and position atoms through the full rules-only dataflow from dialogue utterance to deploy payload.

**Architecture:** Follow PR #1743's atom expansion pattern: matrix rows, utterance corpus, atom contracts/catalog, parser/dispatcher placement, readiness slots, assistant text, display, canonical spec, IR, runtime/script, backtest, and deploy payload tests. PR3 does not change the main rules-only dataflow and does not introduce key aliases; matrix atom keys are direct execution atom keys.

**Tech Stack:** NestJS / TypeScript, Jest via `dx test unit quantify`, Nx build via `dx build quantify --dev`, existing Quantify `llm-strategy-codegen` atom contracts and rules-only pipeline.

---

## File Map

### Stage 4 Matrix And Runner

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/atom-coverage-matrix.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/atom-coverage-matrix.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/staging-dialogue-runner.spec.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/risk-position-dialogue-entrance.spec.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/risk-position-full-dataflow.spec.ts`

### Utterance Corpus And Atom Contracts

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/nl-gateway/utterance-corpus/utterance-corpus.types.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/nl-gateway/utterance-corpus/index.ts`
- Create or modify: `apps/quantify/src/modules/llm-strategy-codegen/nl-gateway/utterance-corpus/atoms/risk.trailing_stop_pct.utterance.ts`
- Create or modify: `apps/quantify/src/modules/llm-strategy-codegen/nl-gateway/utterance-corpus/atoms/risk.max_drawdown_pct.utterance.ts`
- Create or modify: `apps/quantify/src/modules/llm-strategy-codegen/nl-gateway/utterance-corpus/atoms/risk.cooldown.utterance.ts`
- Create or modify: `apps/quantify/src/modules/llm-strategy-codegen/nl-gateway/utterance-corpus/atoms/risk.max_loss_per_trade.utterance.ts`
- Create or modify: `apps/quantify/src/modules/llm-strategy-codegen/nl-gateway/utterance-corpus/atoms/position.budget_cap.utterance.ts`
- Create or modify: `apps/quantify/src/modules/llm-strategy-codegen/nl-gateway/utterance-corpus/atoms/position.leverage.utterance.ts`
- Create or modify: `apps/quantify/src/modules/llm-strategy-codegen/nl-gateway/utterance-corpus/atoms/position.max_exposure_pct.utterance.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/atom-contracts/atom-contract-registry.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/prompts/conversation-planner-system.prompt.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/conversation-planner-system-prompt-atom-catalog.spec.ts`

### Parser, Merge, Readiness, And Assistant Text

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/generic-seed-dispatcher.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/planner-dispatcher-merge.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-open-slot-answer-resolver.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/planner-dispatcher-merge.schema-validation.spec.ts`

### Display, Canonical, IR, Runtime, Backtest, Deploy

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/display-logic-graph.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts`
- Modify: `apps/quantify/src/modules/backtesting/services/backtest-strategy-adapter.service.ts`
- Modify as needed: `packages/shared/src/script-engine/compiled-runtime/evaluate-guards.ts`
- Modify as needed: `packages/shared/src/script-engine/compiled-runtime/run-decision-programs.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-ir-compiler.service.spec.ts`
- Test: `apps/quantify/src/modules/backtesting/services/__tests__/backtest-compiled-runtime-compat.atr-stop.spec.ts`

## Atom Set

Risk atoms:

- `risk.stop_loss_pct`
- `risk.trailing_stop_pct`
- `risk.partial_take_profit`
- `risk.max_drawdown_pct`
- `risk.cooldown`
- `risk.max_loss_per_trade`

Position atoms:

- `position.sizing` fixed quote mode
- `position.sizing` fixed percent mode
- `position.pyramiding_limit`
- `position.dca_schedule`
- `position.budget_cap`
- `position.leverage`
- `position.max_exposure_pct`

Rows using `coveredAtomKeys` must self-reference the same execution key. For `position.sizing`, use one matrix row and validate fixed quote plus fixed percent as params/mode coverage in tests.

---

### Task 1: Matrix Rows And Coverage Gates

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/atom-coverage-matrix.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/atom-coverage-matrix.spec.ts`

- [ ] **Step 1: Write failing matrix tests for direct PR3 atom keys**

Add this test block to `atom-coverage-matrix.spec.ts`:

```ts
const PR3_RISK_ATOMS = [
  'risk.stop_loss_pct',
  'risk.trailing_stop_pct',
  'risk.partial_take_profit',
  'risk.max_drawdown_pct',
  'risk.cooldown',
  'risk.max_loss_per_trade',
] as const

const PR3_POSITION_ATOMS = [
  'position.sizing',
  'position.pyramiding_limit',
  'position.dca_schedule',
  'position.budget_cap',
  'position.leverage',
  'position.max_exposure_pct',
] as const

describe('Stage 4 PR3 risk and position atoms', () => {
  it('registers direct execution atom keys without cross-key mapping', () => {
    const rows = new Map(STAGE4_ATOM_COVERAGE_MATRIX.map(row => [row.atomKey, row]))

    for (const key of PR3_RISK_ATOMS) {
      const row = rows.get(key)
      expect(row).toBeDefined()
      expect(row?.family).toBe('risk')
      expect(row?.rulePath).toBe('rules[].effects.risks')
      expect(row?.coveredAtomKeys).toEqual([key])
      expect(row?.prBatch).toBe('pr3-risk-position')
    }

    for (const key of PR3_POSITION_ATOMS) {
      const row = rows.get(key)
      expect(row).toBeDefined()
      expect(row?.family).toBe('position')
      expect(row?.rulePath).toBe('rules[].effects.positions')
      expect(row?.coveredAtomKeys).toEqual([key])
      expect(row?.prBatch).toBe('pr3-risk-position')
    }
  })

  it('requires full dataflow flags for deploy-ready PR3 atoms', () => {
    const pr3DeployReady = STAGE4_ATOM_COVERAGE_MATRIX.filter(row =>
      row.prBatch === 'pr3-risk-position'
      && STAGE4_DEPLOY_READY_STATUSES.includes(row.status),
    )

    for (const row of pr3DeployReady) {
      expect(row.utteranceExamples.length).toBeGreaterThanOrEqual(3)
      expect(row.displayShape).toContain('source path')
      expect(row.canonicalShape).not.toBe('unsupported')
      expect(row.irShape).not.toBe('unsupported')
      expect(row.reachesBacktest).toBe(true)
      expect(row.reachesDeployPayload).toBe(true)
      expect(row.unsupportedReason).toBeNull()
    }
  })
})
```

- [ ] **Step 2: Run matrix test to verify it fails**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/atom-coverage-matrix.spec.ts
```

Expected: FAIL because PR3 rows are missing or not self-referential.

- [ ] **Step 3: Add PR3 rows to the matrix**

Append rows to `STAGE4_ATOM_COVERAGE_MATRIX`. Use this exact shape and adjust only `status`/`unsupportedReason` after each atom has actual dataflow evidence:

```ts
  {
    atomKey: 'risk.stop_loss_pct',
    family: 'risk',
    rulePath: 'rules[].effects.risks',
    coveredAtomKeys: ['risk.stop_loss_pct'],
    paramsSchema: ['valuePct', 'basis', 'scope'],
    requiredSlots: ['valuePct'],
    utteranceExamples: ['亏损 3% 止损。', 'Stop loss at 4 percent loss.', '入场后跌 2.5% 强制平仓。'],
    displayShape: 'fixed stop loss risk effect with source path',
    canonicalShape: 'risk guard STOP_LOSS_PCT',
    irShape: 'guard:STOP_LOSS_PCT',
    runtimeRequirement: 'position entry price and current price',
    requiredDataSources: ['ohlcv'],
    deployPayloadImpact: ['riskPolicy.guards', 'ir.guards.sourcePath'],
    corpusCases: ['pr3-trend-fixed-stop'],
    status: 'deploy_ready',
    unsupportedReason: null,
    prBatch: 'pr3-risk-position',
    reachesBacktest: true,
    reachesDeployPayload: true,
  },
```

Add the remaining rows with direct keys and self-referential `coveredAtomKeys`. Use `status: 'planned'`, `reachesBacktest: false`, `reachesDeployPayload: false`, and a concrete `unsupportedReason` until the later tasks prove full dataflow.

- [ ] **Step 4: Run matrix test to verify it passes**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/atom-coverage-matrix.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit matrix rows**

Run:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/stage4/atom-coverage-matrix.ts apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/atom-coverage-matrix.spec.ts
git commit -F - <<'MSG'
feat: add stage4 pr3 risk position matrix rows

Refs: #1737
Refs: #1631
MSG
```

---

### Task 2: Utterance Corpus And Prompt Catalog

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/nl-gateway/utterance-corpus/utterance-corpus.types.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/nl-gateway/utterance-corpus/index.ts`
- Create or modify atom utterance files listed in File Map
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/atom-contracts/atom-contract-registry.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/conversation-planner-system-prompt-atom-catalog.spec.ts`

- [ ] **Step 1: Add failing corpus type test by compiling targeted corpus files**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/atom-contracts/__tests__/atom-coverage-full-registration.spec.ts
```

Expected: FAIL after adding new keys to tests until `SupportedAtomKey`, corpus exports, and registry entries include the PR3 atoms.

- [ ] **Step 2: Add PR3 keys to `SupportedAtomKey`**

Extend the union in `utterance-corpus.types.ts`:

```ts
  | 'risk.trailing_stop_pct'
  | 'risk.max_drawdown_pct'
  | 'risk.cooldown'
  | 'risk.max_loss_per_trade'
  | 'position.budget_cap'
  | 'position.leverage'
  | 'position.max_exposure_pct'
```

- [ ] **Step 3: Create utterance files with three cases each**

Use this pattern for each new file. Example `risk.trailing_stop_pct.utterance.ts`:

```ts
import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const riskTrailingStopPctUtterances = [
  {
    id: 'risk-trailing-stop-pct-zh-1',
    atomKey: 'risk.trailing_stop_pct',
    locale: 'zh',
    coverage: 'locked',
    utterance: '开多后用 3% 移动止损保护利润。',
    expected: { owner: 'risk', key: 'risk.trailing_stop_pct', status: 'locked', params: { valuePct: 3 } },
  },
  {
    id: 'risk-trailing-stop-pct-en-1',
    atomKey: 'risk.trailing_stop_pct',
    locale: 'en',
    coverage: 'locked',
    utterance: 'Use a 4 percent trailing stop after entry.',
    expected: { owner: 'risk', key: 'risk.trailing_stop_pct', status: 'locked', params: { valuePct: 4 } },
  },
  {
    id: 'risk-trailing-stop-pct-mixed-1',
    atomKey: 'risk.trailing_stop_pct',
    locale: 'mixed',
    coverage: 'locked',
    utterance: 'BTC 突破后做多，trailing stop 2.5%。',
    expected: { owner: 'risk', key: 'risk.trailing_stop_pct', status: 'locked', params: { valuePct: 2.5 } },
  },
] as const satisfies readonly UtteranceCorpusCase[]
```

Use equivalent three-case files for `risk.max_drawdown_pct`, `risk.cooldown`, `risk.max_loss_per_trade`, `position.budget_cap`, `position.leverage`, and `position.max_exposure_pct`. For `position.sizing`, reuse existing sizing utterances or add cases that expect `position.sizing` with fixed quote and fixed percent params.

- [ ] **Step 4: Export PR3 utterances from corpus index**

Add imports and include arrays in `utteranceCorpus`. Add the new atom keys to `SUPPORTED_EXECUTABLE_UTTERANCE_ATOMS` only after parser and full dataflow tests pass; otherwise add them to `SUPPORTED_REQUIRES_SLOT_UTTERANCE_ATOMS` with explicit open-slot coverage.

- [ ] **Step 5: Add prompt catalog assertions**

In `conversation-planner-system-prompt-atom-catalog.spec.ts`, add:

```ts
it('exposes Stage 4 PR3 risk and position atoms in the planner catalog', () => {
  const prompt = buildConversationPlannerSystemPrompt()

  expect(prompt).toContain('risk.stop_loss_pct')
  expect(prompt).toContain('risk.trailing_stop_pct')
  expect(prompt).toContain('risk.partial_take_profit')
  expect(prompt).toContain('risk.max_drawdown_pct')
  expect(prompt).toContain('risk.cooldown')
  expect(prompt).toContain('risk.max_loss_per_trade')
  expect(prompt).toContain('position.sizing')
  expect(prompt).toContain('position.pyramiding_limit')
  expect(prompt).toContain('position.dca_schedule')
  expect(prompt).toContain('position.budget_cap')
  expect(prompt).toContain('position.leverage')
  expect(prompt).toContain('position.max_exposure_pct')
  expect(prompt).toContain('effects.risks')
  expect(prompt).toContain('effects.positions')
})
```

- [ ] **Step 6: Implement registry/catalog entries**

In `atom-contract-registry.ts`, add missing PR3 keys to bucket, role, allowed slot, readiness, public name, examples, and emit metadata. Keep existing entries for `risk.stop_loss_pct`, `risk.partial_take_profit`, `position.dca_schedule`, and `position.pyramiding_limit`; extend them only where full dataflow metadata is missing.

- [ ] **Step 7: Run atom contract tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/atom-contracts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/conversation-planner-system-prompt-atom-catalog.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit corpus and catalog**

Run:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/nl-gateway/utterance-corpus apps/quantify/src/modules/llm-strategy-codegen/atom-contracts apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/conversation-planner-system-prompt-atom-catalog.spec.ts
git commit -F - <<'MSG'
feat: expose stage4 pr3 risk position atom catalog

Refs: #1737
Refs: #1631
MSG
```

---

### Task 3: Dialogue Entrance And Typed Effect Placement

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/risk-position-dialogue-entrance.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/generic-seed-dispatcher.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/planner-dispatcher-merge.service.ts`

- [ ] **Step 1: Write failing dialogue entrance tests**

Create `risk-position-dialogue-entrance.spec.ts` with helpers that feed utterances through the same local parser/dispatcher helper used by `predicate-dialogue-entrance.spec.ts`. Include these assertions:

```ts
describe('Stage 4 PR3 risk and position dialogue entrance', () => {
  it('places fixed stop loss and fixed percent sizing in typed effects on attempt one', async () => {
    const result = await runStage4DialogueUtterance('EMA20 上穿开多，亏损 3% 止损，单笔 10% 仓位。')

    expect(result.attemptCount).toBe(1)
    expect(result.rules).toHaveLength(1)
    expect(result.rules[0]?.effects.risks).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'risk.stop_loss_pct', params: expect.objectContaining({ valuePct: 3 }) }),
    ]))
    expect(result.rules[0]?.effects.positions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'position.sizing' }),
    ]))
    expect(result.rules[0]?.effects.actions.length).toBeLessThanOrEqual(1)
  })

  it('places partial take profit under effects.risks without creating duplicate exit rules', async () => {
    const result = await runStage4DialogueUtterance('RSI 低于 30 做多，盈利 5% 平一半，盈利 10% 平剩余。')

    const riskLeaves = result.rules.flatMap(rule => rule.effects.risks)
    expect(riskLeaves).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'risk.partial_take_profit' }),
    ]))
    expect(result.rules.filter(rule => rule.phase === 'exit').length).toBeLessThanOrEqual(1)
  })

  it('places DCA, budget, leverage, and exposure cap under effects.positions', async () => {
    const result = await runStage4DialogueUtterance('BTC 回撤 3% 补仓，最多 3 次，总预算 1000 USDT，2 倍杠杆，最大敞口 30%。')

    const positionLeaves = result.rules.flatMap(rule => rule.effects.positions)
    expect(positionLeaves.map(leaf => leaf.key)).toEqual(expect.arrayContaining([
      'position.dca_schedule',
      'position.budget_cap',
      'position.leverage',
      'position.max_exposure_pct',
    ]))
  })
})
```

If `predicate-dialogue-entrance.spec.ts` exposes no reusable helper, define `runStage4DialogueUtterance` locally with the same fake dispatcher setup used there.

- [ ] **Step 2: Run dialogue test to verify it fails**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/risk-position-dialogue-entrance.spec.ts
```

Expected: FAIL for missing atom parse, wrong effect role, or duplicate rules.

- [ ] **Step 3: Implement parser/dispatcher placement**

Update `generic-seed-dispatcher.service.ts` and merge logic so:

- risk atom leaves route to `effects.risks`.
- position atom leaves route to `effects.positions`.
- `position.sizing` supports fixed quote and fixed percent params.
- same-sentence entry plus risk/position stays one semantic rule where the existing merge signature allows it.
- slot-answer-only turns merge into the existing rule instead of creating a new rule.

- [ ] **Step 4: Run dialogue entrance test to pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/risk-position-dialogue-entrance.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit dialogue entrance support**

Run:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/risk-position-dialogue-entrance.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/generic-seed-dispatcher.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/planner-dispatcher-merge.service.ts
git commit -F - <<'MSG'
feat: route stage4 pr3 atoms into typed effects

Refs: #1737
Refs: #1631
MSG
```

---

### Task 4: Readiness Slots, Slot Answers, And Assistant Text

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-open-slot-answer-resolver.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts`

- [ ] **Step 1: Add failing readiness tests for one-slot-per-turn**

Add tests that build rules with missing params and assert exactly one slot:

```ts
it('asks one risk slot at a time and points to the original risk effect path', () => {
  const state = buildRulesOnlyStateWithRule({
    id: 'rule-risk-slot',
    phase: 'entry',
    sideScope: 'long',
    condition: alwaysCondition(),
    effects: {
      actions: [],
      risks: [{ kind: 'atom', key: 'risk.stop_loss_pct', params: {} }],
      positions: [],
      orchestration: [],
      programs: [],
    },
  })

  const result = service.evaluate(state)

  expect(result.openSlots).toHaveLength(1)
  expect(result.openSlots[0]).toEqual(expect.objectContaining({
    slotKey: 'risk.stop_loss_pct.valuePct',
    fieldPath: 'rules[0].effects.risks[0].params.valuePct',
  }))
})

it('asks one position slot at a time and points to the original position effect path', () => {
  const state = buildRulesOnlyStateWithRule({
    id: 'rule-position-slot',
    phase: 'entry',
    sideScope: 'long',
    condition: alwaysCondition(),
    effects: {
      actions: [],
      risks: [],
      positions: [{ kind: 'atom', key: 'position.leverage', params: {} }],
      orchestration: [],
      programs: [],
    },
  })

  const result = service.evaluate(state)

  expect(result.openSlots).toHaveLength(1)
  expect(result.openSlots[0]).toEqual(expect.objectContaining({
    slotKey: 'position.leverage.value',
    fieldPath: 'rules[0].effects.positions[0].params.value',
  }))
})
```

Use the existing helper names in this spec file. If helper names differ, adapt only the helper calls, not the assertions.

- [ ] **Step 2: Add failing slot answer merge test**

Add a test where an answer like `3%` fills `rules[0].effects.risks[0].params.valuePct` and the rule/effect counts remain unchanged:

```ts
expect(after.rules).toHaveLength(before.rules.length)
expect(after.rules[0]?.effects.risks).toHaveLength(before.rules[0]?.effects.risks.length)
expect(after.rules[0]?.effects.risks[0]).toEqual(expect.objectContaining({
  key: 'risk.stop_loss_pct',
  params: expect.objectContaining({ valuePct: 3 }),
}))
```

- [ ] **Step 3: Run readiness tests to verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts
```

Expected: FAIL because new slot paths or answer merge behavior are missing.

- [ ] **Step 4: Implement readiness and answer resolver support**

Update readiness to emit paths under `rules[i].effects.risks[j].params.*` and `rules[i].effects.positions[j].params.*` for all PR3 atoms. Update answer resolver to parse numeric percent, USDT amount, leverage number, DCA count, and interval answers into existing atom params.

- [ ] **Step 5: Ensure assistant text follows the open slot**

Where assistant clarification text is built from open slots, ensure PR3 slot keys return concrete text:

```ts
if (slotKey === 'risk.stop_loss_pct.valuePct') return '请补充固定止损百分比，例如 3%。'
if (slotKey === 'risk.partial_take_profit.tiers') return '请补充分批止盈档位，例如盈利 5% 平 50%，盈利 10% 平剩余。'
if (slotKey === 'position.leverage.value') return '请确认杠杆倍数，例如 2 倍。'
if (slotKey === 'position.budget_cap.value') return '请确认总预算上限，例如 1000 USDT。'
```

- [ ] **Step 6: Run readiness tests to pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit readiness support**

Run:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-open-slot-answer-resolver.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts
git commit -F - <<'MSG'
feat: add stage4 pr3 risk position readiness slots

Refs: #1737
Refs: #1631
MSG
```

---

### Task 5: Full Dataflow Contract

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/risk-position-full-dataflow.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/display-logic-graph.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts`
- Modify: `apps/quantify/src/modules/backtesting/services/backtest-strategy-adapter.service.ts`

- [ ] **Step 1: Write failing full dataflow tests**

Create `risk-position-full-dataflow.spec.ts` and assert each deploy-ready PR3 atom survives the whole chain. Use one compact table:

```ts
const CASES = [
  { id: 'fixed-stop-fixed-percent', utterance: 'EMA20 上穿开多，亏损 3% 止损，单笔 10% 仓位。', riskKeys: ['risk.stop_loss_pct'], positionKeys: ['position.sizing'] },
  { id: 'partial-take-profit', utterance: 'RSI 低于 30 做多，盈利 5% 平一半，盈利 10% 平剩余。', riskKeys: ['risk.partial_take_profit'], positionKeys: [] },
  { id: 'dca-budget-leverage-exposure', utterance: 'BTC 回撤 3% 补仓，最多 3 次，总预算 1000 USDT，2 倍杠杆，最大敞口 30%。', riskKeys: [], positionKeys: ['position.dca_schedule', 'position.budget_cap', 'position.leverage', 'position.max_exposure_pct'] },
] as const

describe('Stage 4 PR3 full dataflow', () => {
  it.each(CASES)('preserves $id semantics through deploy payload', async (item) => {
    const result = await runRiskPositionFullDataflow(item.utterance)

    expect(result.attemptCount).toBe(1)
    expect(result.semanticPatch.rules.length).toBeGreaterThan(0)
    expect(result.rulesEffectKeys.risks).toEqual(expect.arrayContaining(item.riskKeys))
    expect(result.rulesEffectKeys.positions).toEqual(expect.arrayContaining(item.positionKeys))
    expect(result.openSlots.length).toBeLessThanOrEqual(1)
    expect(result.assistantTextSourcePaths).toEqual(expect.arrayContaining(result.openSlots.map(slot => slot.fieldPath)))
    expect(result.displaySourcePaths).toEqual(expect.arrayContaining(result.ruleSourcePaths))
    expect(result.canonicalSourcePaths).toEqual(expect.arrayContaining(result.ruleSourcePaths))
    expect(result.irSourcePaths).toEqual(expect.arrayContaining(result.canonicalSourcePaths))
    expect(result.scriptSemantics.keys).toEqual(expect.arrayContaining([...item.riskKeys, ...item.positionKeys]))
    expect(result.backtest.irHash).toBe(result.irHash)
    expect(result.deployPayload.irHash).toBe(result.irHash)
    expect(result.deployPayload.atomKeys).toEqual(expect.arrayContaining([...item.riskKeys, ...item.positionKeys]))
  })
})
```

Implement `runRiskPositionFullDataflow` in the test using existing local services/fakes from `atom-coverage-ir-end-to-end.contract.spec.ts` and `predicate-dialogue-entrance.spec.ts`. Return plain arrays of keys and source paths so the test stays stable.

- [ ] **Step 2: Run full dataflow test to verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/risk-position-full-dataflow.spec.ts
```

Expected: FAIL at the first missing layer.

- [ ] **Step 3: Implement missing display and canonical mappings**

Update display and canonical services so each deploy-ready PR3 atom is represented from rules/canonical data with source path metadata. Do not read legacy flat buckets.

- [ ] **Step 4: Implement missing IR and runtime/script mappings**

Update IR compiler and script/runtime bridge so risk guards, partial take profit rule blocks, sizing, DCA, budget, leverage, and exposure semantics are represented in IR and consumed by runtime/script generation.

- [ ] **Step 5: Implement backtest and deploy preservation**

Update backtest adapter and deploy payload builder path so the same IR hash and atom semantics are present in backtest and deploy payload. Do not reconstruct behavior from display text.

- [ ] **Step 6: Run full dataflow test to pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/risk-position-full-dataflow.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit full dataflow support**

Run:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/risk-position-full-dataflow.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/display-logic-graph.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts apps/quantify/src/modules/backtesting/services/backtest-strategy-adapter.service.ts packages/shared/src/script-engine/compiled-runtime/evaluate-guards.ts packages/shared/src/script-engine/compiled-runtime/run-decision-programs.ts
git commit -F - <<'MSG'
feat: preserve stage4 pr3 atoms through deploy payload

Refs: #1737
Refs: #1631
MSG
```

---

### Task 6: Matrix Status Finalization And Reporter Guard

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/atom-coverage-matrix.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/staging-dialogue-runner.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/atom-coverage-matrix.spec.ts`

- [ ] **Step 1: Add retry-not-counted assertion if missing**

In `staging-dialogue-runner.spec.ts`, keep or add:

```ts
expect(isStage4AttemptOnePass({ attemptCount: 2, passed: true, semanticHashesStable: true })).toBe(false)
expect(isStage4AttemptOnePass({ attemptCount: 1, passed: true, semanticHashesStable: false })).toBe(false)
```

- [ ] **Step 2: Finalize PR3 row statuses**

Set `status: 'deploy_ready'`, `unsupportedReason: null`, `reachesBacktest: true`, and `reachesDeployPayload: true` only for atoms passing Task 5. Keep incomplete atoms below `deploy_ready` with a concrete blocker:

```ts
status: 'ir_ready',
unsupportedReason: 'runtime_missing_data',
reachesBacktest: false,
reachesDeployPayload: false,
```

- [ ] **Step 3: Run Stage 4 unit tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4
```

Expected: PASS.

- [ ] **Step 4: Commit status finalization**

Run:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/stage4
git commit -F - <<'MSG'
test: finalize stage4 pr3 atom coverage gates

Refs: #1737
Refs: #1631
MSG
```

---

### Task 7: Focused Regression And Build

**Files:**
- Test only unless failures require fixes.

- [ ] **Step 1: Run atom contracts**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/atom-contracts
```

Expected: PASS.

- [ ] **Step 2: Run readiness and canonical focused tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-ir-compiler.service.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Run backtesting focused tests if runtime/backtest files changed**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/backtesting/services
```

Expected: PASS.

- [ ] **Step 4: Run focused staging30/staging31 rules-only regression if touched paths affect staging scripts or reports**

Run the focused unit specs that cover the changed staging files, for example:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/staging31-report.contract.spec.ts
```

Expected: PASS. Do not run full E2E unless a focused unit regression is insufficient.

- [ ] **Step 5: Build quantify**

Run:

```bash
dx build quantify --dev
```

Expected: exit 0.

- [ ] **Step 6: Commit any verification fixes**

If verification required code/test fixes, commit them:

```bash
git status --short
git add apps/quantify/src/modules/llm-strategy-codegen apps/quantify/src/modules/backtesting packages/shared/src/script-engine
git commit -F - <<'MSG'
fix: stabilize stage4 pr3 risk position verification

Refs: #1737
Refs: #1631
MSG
```

Skip this commit if no files changed.

---

### Task 8: Final Commit, Push, And PR

**Files:**
- All changed implementation and test files.

- [ ] **Step 1: Confirm worktree only has intended changes**

Run:

```bash
git status --short
```

Expected: changed files are only PR3 implementation/test/docs files. Preserve existing unrelated dirty file `packages/api-contracts/src/generated/quantify.ts` unless it was intentionally regenerated for this PR.

- [ ] **Step 2: Create final feature commit if staged implementation remains**

Run:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen packages/shared/src/script-engine apps/quantify/src/modules/backtesting docs/superpowers/specs docs/superpowers/plans
git commit -F - <<'MSG'
feat: add stage4 risk position atoms

Refs: #1737
Refs: #1631
MSG
```

Expected: commit created, or no-op if all tasks already committed.

- [ ] **Step 3: Push branch**

Run:

```bash
git push -u origin feat/1737-stage4-risk-position-atoms
```

Expected: push succeeds. If pre-push build fails, fix and repeat; do not bypass hooks unless PR body documents why.

- [ ] **Step 4: Open PR with acceptance mapping**

Run:

```bash
gh pr create --title "feat: add stage4 risk position atoms" --body-file - <<'MSG'
## 变更目的

- 对应 #1737：扩展 Stage 4 PR3 risk / position atoms，并证明从 dialogue utterance 到 deploy payload 的 full dataflow。
- 不改 rules-only 主数据流，不引入 key alias，不恢复 legacy fallback / flat projection。

## 主要改动和解决的问题

- Matrix：新增 PR3 risk / position atom rows，直接使用执行 atom key，`coveredAtomKeys` 自引用。
- Dialogue：自然语言 attempt-1 进入 `rules[].effects.risks` / `rules[].effects.positions`。
- Readiness：缺槽位每轮只问一个 slot，slot answer 写回原 rule path。
- Dataflow：assistant text、display、canonical spec、IR、script/runtime evaluator、backtest、deploy payload 保留 risk / position 语义。
- Safety：retry pass 不计入通过；runtime 不完整 atom fail closed。

## 遗留的问题

- PR4 action/program atoms 不在本 PR 范围。
- PR5 orchestration/data-source binding 不在本 PR 范围。
- PR6 90% staging corpus acceptance 不在本 PR 范围。

## 已做的验证

- dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4
- dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/atom-contracts
- dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts
- dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts
- dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-ir-compiler.service.spec.ts
- dx build quantify --dev

##  PR 遗留未做的

- 无。

## 关联

Closes: #1737
Refs: #1631
MSG
```

Expected: PR URL created.

---

## Self-Review Checklist

- Spec coverage: Tasks cover matrix, utterances, planner/dispatcher parse, typed rules, readiness slots, assistant text, display, canonical spec, IR, script/runtime evaluator, backtest, deploy payload, retry gate, staging30/staging31 regression, and build.
- No key mapping: PR3 rows use direct execution atom keys; `coveredAtomKeys` is self-reference only.
- Mainflow: No task changes `RuleEffectsByRole` or reintroduces flat/legacy paths.
- TDD: Each behavior-changing task starts with a failing test and a pass command.
- Verification: Final commands include Stage 4, atom contracts, readiness, canonical/IR, backtesting when touched, and `dx build quantify --dev`.
