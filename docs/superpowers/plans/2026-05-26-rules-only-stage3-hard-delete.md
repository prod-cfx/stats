# Rules-Only Stage 3 Hard Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the AI Quant flat five-bucket semantic model and all legacy compatibility paths so rules are the only strategy semantics source from conversation entry through deploy/runtime.

**Architecture:** Replace remaining flat readers with a rules-native reader/visitor, then delete the flat state shape and projection compatibility layer. Each task first adds or tightens tests around one boundary, then rewrites that boundary to consume `rules[]` paths only. Staging validation uses the fixed 30-strategy corpus from `.env.staging.local`.

**Tech Stack:** TypeScript, NestJS, Jest, Nx via `dx`, Prisma-backed staging DB, AI Quant quantify service.

---

## File Structure

Core files to modify:

- `apps/quantify/src/modules/llm-strategy-codegen/services/rules-mainflow-reader.service.ts`
  - Owns rules-native traversal and typed facts. Must not expose legacy bucket-shaped objects.
- `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`
  - Removes flat bucket fields from `SemanticState`.
- `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts`
  - Removes legacy patch fields from TypeScript API.
- `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state-flat-readers.ts`
  - Deleted after all imports are gone.
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-rule-projection.service.ts`
  - Removed from production use. Delete if no production-independent test need remains.
- `apps/quantify/src/modules/llm-strategy-codegen/services/planner-dispatcher-merge.service.ts`
  - Keeps raw planner schema rejection for old fields, emits rules-only patches internally.
- `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
  - Converts conversation guards, support checks, open-slot lookup, and canonical context to rules-native APIs.
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-merge.service.ts`
  - Merges rules only.
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-reducer.service.ts`
  - Writes slot answers into rules paths only.
- `apps/quantify/src/modules/llm-strategy-codegen/services/conversation-semantic-edit.service.ts`
  - Edits rules paths only.
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`
  - Computes readiness and open slots directly from rules.
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`
  - Builds display graph from rules/canonical only.
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-support-classifier.service.ts`
  - Classifies support from rule leaves.
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-executable-semantics.service.ts`
  - Detects executable strategy semantics from rule leaves.
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-invariant.service.ts`
  - Checks invariants on rules leaves.
- `apps/quantify/src/modules/llm-strategy-codegen/services/per-trade-sizing-resolver.service.ts`
  - Reads sizing from rules actions.
- `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-execution-context.service.ts`
  - Derives market/execution context from rules/canonical facts.
- `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
  - Removes main-path flat bucket helpers.
- `apps/quantify/src/modules/backtesting/services/backtest-snapshot-loader.service.ts`
  - Removes legacy trigger/text risk inference.
- `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts`
  - Keeps deploy truth on snapshot/hash-chain only.

Test files to create or rewrite:

- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-mainflow-reader.stage3.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage3-source-guard.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/types/__tests__/stage3-no-flat-state-types.spec.ts`
- Existing focused tests listed per task.

Staging files:

- `apps/quantify/src/modules/llm-strategy-codegen/scripts/staging30-rules-only-mainflow-cases.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/scripts/staging30-rules-only-mainflow-report.ts`
- `tmp/stage3-rules-only-staging30-report.json`
  - Generated local raw staging report. Do not commit if it contains session IDs or environment-specific identifiers.
- `docs/superpowers/reports/2026-05-26-stage3-staging30-summary.md`
  - Redacted staging summary for PR evidence when staging validation runs.

## Task 1: Add Stage 3 Source Guards

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage3-source-guard.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage3-source-guard.spec.ts`

- [ ] **Step 1: Write failing source guard test**

```ts
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const repoRoot = join(__dirname, '../../../../../../..')

function rg(pattern: string, paths: string[]): string {
  try {
    return execFileSync('rg', ['-n', pattern, ...paths], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  }
  catch (error) {
    const status = (error as { status?: number }).status
    if (status === 1) return ''
    throw error
  }
}

describe('stage3 rules-only hard-delete source guard', () => {
  const productionPaths = [
    'apps/quantify/src/modules/llm-strategy-codegen',
    'apps/quantify/src/modules/backtesting',
    'apps/quantify/src/modules/account-strategy-view',
  ]

  it.each([
    'readFlatTriggers',
    'readFlatActions',
    'readFlatRisks',
    'readFlatPositionConstraints',
    'projectToFlat',
    'reprojectFromRules',
    'SemanticStateBuckets',
  ])('does not use removed flat helper %s in production code', (pattern) => {
    const output = rg(pattern, productionPaths)
      .split('\n')
      .filter(line => line.trim())
      .filter(line => !line.includes('__tests__'))
      .filter(line => !line.includes('.spec.ts'))
      .filter(line => !line.includes('stage3-source-guard.spec.ts'))
      .join('\n')

    expect(output).toBe('')
  })

  it.each([
    '\\bstate\\.trigger\\b',
    '\\bstate\\.action\\b',
    '\\bstate\\.risk\\b',
    '\\bstate\\.positionConstraint\\b',
    '\\bstate\\.orchestration\\b',
    '\\bsemanticPatch\\.atoms\\b',
    '\\bsemanticPatch\\.triggers\\b',
    '\\bsemanticPatch\\.actions\\b',
  ])('does not use removed flat field pattern %s in production code', (pattern) => {
    const output = rg(pattern, productionPaths)
      .split('\n')
      .filter(line => line.trim())
      .filter(line => !line.includes('__tests__'))
      .filter(line => !line.includes('.spec.ts'))
      .filter(line => !line.includes('stage3-source-guard.spec.ts'))
      .join('\n')

    expect(output).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage3-source-guard.spec.ts
```

Expected: FAIL with matches for `readFlatTriggers`, `SemanticStateBuckets`, or flat fields.

- [ ] **Step 3: Commit guard test**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage3-source-guard.spec.ts
git commit -F - <<'MSG'
test(ai-quant): guard stage3 flat semantic deletion

Refs: #1633
MSG
```

## Task 2: Add Rules-Native Reader Facts

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/rules-mainflow-reader.service.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-mainflow-reader.stage3.spec.ts`

- [ ] **Step 1: Write failing reader tests**

```ts
import type { SemanticRule } from '../../types/atom-expr'
import { RulesMainflowReaderService } from '../rules-mainflow-reader.service'

const atom = (key: string, params: Record<string, unknown> = {}) => ({
  kind: 'atom' as const,
  key,
  params,
})

describe('RulesMainflowReaderService stage3 facts', () => {
  const reader = new RulesMainflowReaderService()

  const rules: SemanticRule[] = [{
    id: 'rule-entry-1',
    phase: 'entry',
    sideScope: 'long',
    condition: atom('indicator.ema_stack_above', { periods: [20, 60, 144], timeframe: '15m' }),
    effects: {
      actions: [atom('action.open_long', { quantity: { mode: 'fixed_quote', value: 10, asset: 'USDT' } })],
      risks: [atom('risk.stop_loss_pct', { valuePct: 5, basis: 'entry_avg_price' })],
      positions: [atom('position.fixed_notional', { value: 10, asset: 'USDT' })],
      orchestration: [atom('scope.symbol', { symbols: ['BTCUSDT'], venue: 'binance', marketType: 'perp' })],
      programs: [],
    },
    evidence: { text: '价格在ema20 ema60 ema144上方时做多开仓' },
  }]

  it('returns rule-path facts for all typed effect roles', () => {
    const facts = reader.readRuleFacts(rules)

    expect(facts.conditions).toEqual([expect.objectContaining({
      ruleId: 'rule-entry-1',
      sourcePath: 'rules[0].condition',
      atomKey: 'indicator.ema_stack_above',
    })])
    expect(facts.actions).toEqual([expect.objectContaining({
      ruleId: 'rule-entry-1',
      sourcePath: 'rules[0].effects.actions[0]',
      atomKey: 'action.open_long',
    })])
    expect(facts.risks).toEqual([expect.objectContaining({
      ruleId: 'rule-entry-1',
      sourcePath: 'rules[0].effects.risks[0]',
      atomKey: 'risk.stop_loss_pct',
    })])
    expect(facts.positions).toEqual([expect.objectContaining({
      ruleId: 'rule-entry-1',
      sourcePath: 'rules[0].effects.positions[0]',
      atomKey: 'position.fixed_notional',
    })])
    expect(facts.orchestration).toEqual([expect.objectContaining({
      ruleId: 'rule-entry-1',
      sourcePath: 'rules[0].effects.orchestration[0]',
      atomKey: 'scope.symbol',
    })])
  })

  it('does not expose legacy bucket names as top-level result keys', () => {
    const facts = reader.readRuleFacts(rules) as unknown as Record<string, unknown>

    expect(facts.trigger).toBeUndefined()
    expect(facts.action).toBeUndefined()
    expect(facts.risk).toBeUndefined()
    expect(facts.positionConstraint).toBeUndefined()
    expect(facts.orchestration).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-mainflow-reader.stage3.spec.ts
```

Expected: FAIL because `readRuleFacts` is missing.

- [ ] **Step 3: Implement rules facts API**

Add these exported interfaces and method to `RulesMainflowReaderService`:

```ts
import type { AtomExpr, SemanticRule } from '../types/atom-expr'

export interface RulesMainflowLeafFact {
  readonly ruleId: string
  readonly ruleIndex: number
  readonly phase: SemanticRule['phase']
  readonly sideScope: SemanticRule['sideScope']
  readonly sourcePath: string
  readonly atomKey: string
  readonly params: Readonly<Record<string, unknown>>
  readonly expr: AtomExpr
}

export interface RulesMainflowFacts {
  readonly conditions: readonly RulesMainflowLeafFact[]
  readonly actions: readonly RulesMainflowLeafFact[]
  readonly risks: readonly RulesMainflowLeafFact[]
  readonly positions: readonly RulesMainflowLeafFact[]
  readonly orchestration: readonly RulesMainflowLeafFact[]
  readonly programs: readonly RulesMainflowLeafFact[]
}
```

Implement traversal:

```ts
  readRuleFacts(rules: readonly SemanticRule[] | null | undefined): RulesMainflowFacts {
    const facts: {
      conditions: RulesMainflowLeafFact[]
      actions: RulesMainflowLeafFact[]
      risks: RulesMainflowLeafFact[]
      positions: RulesMainflowLeafFact[]
      orchestration: RulesMainflowLeafFact[]
      programs: RulesMainflowLeafFact[]
    } = {
      conditions: [],
      actions: [],
      risks: [],
      positions: [],
      orchestration: [],
      programs: [],
    }

    for (const [ruleIndex, rule] of (rules ?? []).entries()) {
      this.collectExprLeaves(rule.condition, `rules[${ruleIndex}].condition`, rule, ruleIndex, facts.conditions)
      for (const [index, expr] of rule.effects.actions.entries()) this.collectExprLeaves(expr, `rules[${ruleIndex}].effects.actions[${index}]`, rule, ruleIndex, facts.actions)
      for (const [index, expr] of rule.effects.risks.entries()) this.collectExprLeaves(expr, `rules[${ruleIndex}].effects.risks[${index}]`, rule, ruleIndex, facts.risks)
      for (const [index, expr] of rule.effects.positions.entries()) this.collectExprLeaves(expr, `rules[${ruleIndex}].effects.positions[${index}]`, rule, ruleIndex, facts.positions)
      for (const [index, expr] of rule.effects.orchestration.entries()) this.collectExprLeaves(expr, `rules[${ruleIndex}].effects.orchestration[${index}]`, rule, ruleIndex, facts.orchestration)
      for (const [index, expr] of rule.effects.programs.entries()) this.collectExprLeaves(expr, `rules[${ruleIndex}].effects.programs[${index}]`, rule, ruleIndex, facts.programs)
    }

    return facts
  }

  private collectExprLeaves(
    expr: AtomExpr,
    sourcePath: string,
    rule: SemanticRule,
    ruleIndex: number,
    out: RulesMainflowLeafFact[],
  ): void {
    if (expr.kind === 'atom') {
      out.push({
        ruleId: rule.id,
        ruleIndex,
        phase: rule.phase,
        sideScope: rule.sideScope,
        sourcePath,
        atomKey: expr.key,
        params: expr.params ?? {},
        expr,
      })
      return
    }
    if (expr.kind === 'and') {
      expr.children.forEach((child, index) => this.collectExprLeaves(child, `${sourcePath}.and.children[${index}]`, rule, ruleIndex, out))
      return
    }
    if (expr.kind === 'or') {
      expr.children.forEach((child, index) => this.collectExprLeaves(child, `${sourcePath}.or.children[${index}]`, rule, ruleIndex, out))
      return
    }
    if (expr.kind === 'not') {
      this.collectExprLeaves(expr.child, `${sourcePath}.not.child`, rule, ruleIndex, out)
      return
    }
    if (expr.kind === 'sequence') {
      expr.steps.forEach((step, index) => this.collectExprLeaves(step, `${sourcePath}.sequence.steps[${index}]`, rule, ruleIndex, out))
    }
  }
```

- [ ] **Step 4: Run reader test**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-mainflow-reader.stage3.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit reader API**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/rules-mainflow-reader.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-mainflow-reader.stage3.spec.ts
git commit -F - <<'MSG'
feat(ai-quant): add rules-native mainflow facts

Refs: #1633
MSG
```

## Task 3: Remove Legacy Patch Type Fields

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/planner-dispatcher-merge.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-planner-schema-reject.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/planner-dispatcher-merge.schema-validation.spec.ts`

- [ ] **Step 1: Add internal type negative test**

Create `apps/quantify/src/modules/llm-strategy-codegen/types/__tests__/stage3-no-flat-state-types.spec.ts`:

```ts
import type { CodegenSemanticPatch } from '../codegen-semantic-patch'
import type { SemanticState } from '../semantic-state'

describe('stage3 no-flat semantic types', () => {
  it('keeps rules as the semantic state root', () => {
    const state: SemanticState = {
      rules: [],
      contextSlots: {},
      position: null,
      orchestrationContracts: [],
      normalizationNotes: [],
      updatedAt: '2026-05-26T00:00:00.000Z',
    }

    expect(state.rules).toEqual([])
  })

  it('keeps semantic patch rules-only', () => {
    const patch: CodegenSemanticPatch = {
      contextSlots: { symbol: 'BTCUSDT' },
      rules: [],
    }

    expect(patch.rules).toEqual([])
  })
})
```

- [ ] **Step 2: Remove fields from `CodegenSemanticPatch`**

Delete these properties and their nested patch-only interfaces from `codegen-semantic-patch.ts` when no longer referenced:

```ts
atoms?: ...
triggers?: ...
actions?: ...
risk?: ...
position?: ...
orchestration?: ...
```

Keep `CodegenSemanticOrchestrationNodePatch` only if another rules-only type still imports it. If only legacy patch uses it, delete it with the legacy fields.

- [ ] **Step 3: Keep raw schema rejection using unknown records**

In `planner-dispatcher-merge.service.ts`, keep `LEGACY_FLAT_FIELDS` and `validatePlannerSemanticPatch(plannerPatch: unknown, userMessage: string)` using `Record<string, unknown>`. Do not use removed `CodegenSemanticPatch` properties.

Use this field list:

```ts
const LEGACY_FLAT_FIELDS = [
  'atoms',
  'triggers',
  'actions',
  'risks',
  'risk',
  'position',
  'positionConstraints',
  'orchestration',
] as const
```

- [ ] **Step 4: Run planner schema tests**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-planner-schema-reject.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/planner-dispatcher-merge.schema-validation.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/types/__tests__/stage3-no-flat-state-types.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit patch type deletion**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts apps/quantify/src/modules/llm-strategy-codegen/services/planner-dispatcher-merge.service.ts apps/quantify/src/modules/llm-strategy-codegen/types/__tests__/stage3-no-flat-state-types.spec.ts
git commit -F - <<'MSG'
refactor(ai-quant): remove legacy semantic patch fields

Refs: #1633
MSG
```

## Task 4: Convert Merge, Reducer, and Edit to Rules-Only Writes

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-merge.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-reducer.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/conversation-semantic-edit.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-merge.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-reducer.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/conversation-semantic-edit.service.spec.ts`

- [ ] **Step 1: Add assertion helpers to existing tests**

Add this helper to the top of each relevant spec file:

```ts
function expectNoFlatBuckets(state: unknown): void {
  const record = state as Record<string, unknown>
  expect(record.trigger).toBeUndefined()
  expect(record.action).toBeUndefined()
  expect(record.risk).toBeUndefined()
  expect(record.positionConstraint).toBeUndefined()
  expect(record.orchestration).toBeUndefined()
}
```

Use it in tests that currently expect `flat === projectToFlat(rules)`. Replace those assertions with:

```ts
expect(result.rules?.length).toBeGreaterThan(0)
expectNoFlatBuckets(result)
```

- [ ] **Step 2: Rewrite merge output**

In `semantic-state-merge.service.ts`, remove code that writes:

```ts
trigger
action
risk
positionConstraint
orchestration
```

Merge only `rules`, `contextSlots`, `position`, `orchestrationContracts` if still needed as non-semantic auxiliary contracts, diagnostics, pending edit, and metadata.

- [ ] **Step 3: Rewrite reducer slot writes**

In `semantic-state-reducer.service.ts`, locate methods that fill open slots by owner IDs from flat atoms. Rewrite them to:

1. Parse slot source path from `rules[n]...`.
2. Clone `state.rules`.
3. Update the matched `AtomExpr.params` value.
4. Return state with updated `rules`.

Use this helper shape:

```ts
function updateRuleAtomParam(
  rules: readonly SemanticRule[],
  sourcePath: string,
  paramKey: string,
  value: unknown,
): SemanticRule[] {
  return rules.map((rule, ruleIndex) => {
    if (!sourcePath.startsWith(`rules[${ruleIndex}]`)) return rule
    return updateRuleBySourcePath(rule, sourcePath, paramKey, value)
  })
}
```

Implement `updateRuleBySourcePath` locally or in a small focused rules helper. It must update only atom params at the matched path and leave all other rules unchanged.

- [ ] **Step 4: Rewrite edit service**

In `conversation-semantic-edit.service.ts`, replace target lookup by `readFlatTriggers(state)` with rules source paths. If no explicit edit target exists, choose the only matching condition leaf when exactly one condition leaf exists:

```ts
const facts = this.rulesMainflowReader.readRuleFacts(state.rules)
const editableConditions = facts.conditions.filter(fact => fact.phase === 'entry' || fact.phase === 'exit')
const target = pendingEdit.targetRef
  ? editableConditions.find(fact => fact.sourcePath === pendingEdit.targetRef)
  : editableConditions.length === 1 ? editableConditions[0] : undefined
```

If no unambiguous target exists, return state unchanged and keep clarification pending.

- [ ] **Step 5: Run focused tests**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-merge.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-reducer.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/conversation-semantic-edit.service.spec.ts
```

Expected: PASS after updating test fixtures to omit flat buckets.

- [ ] **Step 6: Commit rules-only writes**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-merge.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-reducer.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/conversation-semantic-edit.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-merge.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-reducer.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/conversation-semantic-edit.service.spec.ts
git commit -F - <<'MSG'
refactor(ai-quant): write semantic changes to rules only

Refs: #1633
MSG
```

## Task 5: Convert Readiness to Rules Paths

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.rules-empty.spec.ts`

- [ ] **Step 1: Add failing rule-path readiness test**

In `semantic-contract-readiness.service.rules-mode.spec.ts`, add:

```ts
it('emits missing requirements with rules source paths and no flat owner ids', () => {
  const result = service.normalize({
    rules: [{
      id: 'entry-missing-size',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'indicator.cross_over', params: { fastPeriod: 7, slowPeriod: 21 } },
      effects: {
        actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
        risks: [],
        positions: [],
        orchestration: [],
        programs: [],
      },
      evidence: { text: 'EMA7 上穿 EMA21 时开多' },
    }],
    contextSlots: {},
    position: null,
    orchestrationContracts: [],
    normalizationNotes: [],
    updatedAt: '2026-05-26T00:00:00.000Z',
  })

  expect(result.ready).toBe(false)
  expect(JSON.stringify(result)).toContain('rules[0].effects.actions[0]')
  expect(JSON.stringify(result)).not.toContain('"ownerKind":"action"')
  expect(JSON.stringify(result)).not.toContain('"ownerKind":"trigger"')
})
```

- [ ] **Step 2: Remove flat projection from normalize**

Delete the branch that calls `this.ruleProjection.reprojectFromRules(state)` and all `flatNonEmptyCount` fallback logic. Replace rules-empty behavior with:

```ts
if (!state.rules || state.rules.length === 0) {
  return this.buildRulesEmptyResult(state)
}
```

`buildRulesEmptyResult` must mark readiness false with `READINESS_RULES_TREE_EMPTY`.

- [ ] **Step 3: Replace active owner collection**

Replace `collectActiveContractOwners(state)` with a rules-native collector based on `rulesMainflowReader.readRuleFacts(state.rules)`. Each missing requirement must include a rules source path.

- [ ] **Step 4: Run readiness tests**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.rules-empty.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit readiness conversion**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.rules-empty.spec.ts
git commit -F - <<'MSG'
refactor(ai-quant): evaluate readiness from rules paths

Refs: #1633
MSG
```

## Task 6: Convert Display and Support Readers

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-support-classifier.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-executable-semantics.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-invariant.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.rules-only-mainflow.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-support-classifier.service.spec.ts`

- [ ] **Step 1: Add display no-fallback assertion**

In `display-logic-graph-rules-tree.spec.ts`, add:

```ts
it('does not render flat fallback text when rules are present', () => {
  const graph = service.buildDisplayLogicGraph({
    rules: [{
      id: 'entry-1',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'indicator.cross_over', params: { fastPeriod: 7, slowPeriod: 21 } },
      effects: {
        actions: [{ kind: 'atom', key: 'action.open_long', params: { quantity: { mode: 'pct_equity', value: 10 } } }],
        risks: [],
        positions: [],
        orchestration: [],
        programs: [],
      },
      evidence: { text: 'EMA7 上穿 EMA21 时开多' },
    }],
    contextSlots: {},
    position: null,
    orchestrationContracts: [],
    normalizationNotes: [],
    updatedAt: '2026-05-26T00:00:00.000Z',
  })

  const text = JSON.stringify(graph)
  expect(text).toContain('EMA')
  expect(text).not.toContain('策略条件')
  expect(text).not.toContain('legacy')
})
```

- [ ] **Step 2: Replace display flat reads**

In `semantic-state-projection.service.ts`, replace `readFlatTriggers`, `readFlatActions`, and `readFlatRisks` use with `rulesMainflowReader.readRuleFacts(state.rules)`.

Render:

- conditions from `facts.conditions`
- actions from `facts.actions`
- risks from `facts.risks`
- programs from `facts.programs`
- orchestration display from `facts.orchestration`

- [ ] **Step 3: Replace support and executable checks**

In `semantic-support-classifier.service.ts`, `semantic-executable-semantics.service.ts`, and `semantic-atom-invariant.service.ts`, use `readRuleFacts` and operate on `atomKey`, `params`, `phase`, `sideScope`, and `sourcePath`.

- [ ] **Step 4: Run display/support tests**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.rules-only-mainflow.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-support-classifier.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit display/support conversion**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-support-classifier.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-executable-semantics.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-invariant.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.rules-only-mainflow.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-support-classifier.service.spec.ts
git commit -F - <<'MSG'
refactor(ai-quant): render and classify semantics from rules

Refs: #1633
MSG
```

## Task 7: Convert Canonical Spec and Execution Context

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/per-trade-sizing-resolver.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-execution-context.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/per-trade-sizing-resolver.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-execution-context.service.spec.ts`

- [ ] **Step 1: Add canonical no-flat assertion**

In `canonical-spec-builder.rules-only-mainflow.spec.ts`, add:

```ts
it('builds canonical spec from rules without flat state buckets', () => {
  const state = {
    rules: [{
      id: 'ema-entry',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'indicator.cross_over', params: { fastPeriod: 7, slowPeriod: 21 } },
      effects: {
        actions: [{ kind: 'atom', key: 'action.open_long', params: { quantity: { mode: 'pct_equity', value: 10 } } }],
        risks: [{ kind: 'atom', key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' } }],
        positions: [],
        orchestration: [{ kind: 'atom', key: 'scope.symbol', params: { symbols: ['BTCUSDT'], venue: 'okx', marketType: 'perp' } }],
        programs: [],
      },
      evidence: { text: 'EMA7 上穿 EMA21 时开多' },
    }],
    contextSlots: {},
    position: null,
    orchestrationContracts: [],
    normalizationNotes: [],
    updatedAt: '2026-05-26T00:00:00.000Z',
  }

  const spec = builder.buildFromSemanticState(state)
  expect(spec.rules.length).toBeGreaterThan(0)
  expect(JSON.stringify(spec)).toContain('rules[0]')
})
```

- [ ] **Step 2: Remove flat main-path helpers**

In `canonical-spec-builder.service.ts`, keep helpers that convert atom params to canonical nodes, but change signatures from bucket inputs to rule leaf facts.

Example rewrite target:

```ts
private buildConditionFromRuleFact(fact: RulesMainflowLeafFact, defaultTimeframe?: string): CanonicalConditionNode | null
```

Do not accept `NormalizedTriggerAtom`, `SemanticActionState`, or `SemanticRiskState` in main-path helpers.

- [ ] **Step 3: Convert sizing and execution context**

In `per-trade-sizing-resolver.service.ts`, read `facts.actions` and `facts.positions`. In `strategy-execution-context.service.ts`, read `facts.orchestration`, `facts.programs`, and canonical market fallback.

- [ ] **Step 4: Run canonical/context tests**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/per-trade-sizing-resolver.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-execution-context.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit canonical conversion**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/per-trade-sizing-resolver.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/strategy-execution-context.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/per-trade-sizing-resolver.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-execution-context.service.spec.ts
git commit -F - <<'MSG'
refactor(ai-quant): compile canonical semantics from rules only

Refs: #1633
MSG
```

## Task 8: Remove Flat State Type and Flat Readers

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`
- Delete: `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state-flat-readers.ts`
- Modify tests that construct `SemanticState`

- [ ] **Step 1: Remove flat bucket type declarations**

In `semantic-state.ts`, delete:

```ts
export type SemanticStateBuckets = { ... }
export type ReadonlySemanticStateBuckets = ...
export interface SemanticState extends SemanticStateBuckets { ... }
```

Replace with:

```ts
export interface SemanticState {
  families: string[]
  contextSlots: SemanticContextSlotState
  position: SemanticPositionState | null
  orchestrationContracts: readonly SemanticOrchestrationContract[]
  normalizationNotes: string[]
  updatedAt: string
  updatedTurnId?: string
  unsupportedFallback?: UnsupportedFallbackState | null
  rules: readonly import('./atom-expr').SemanticRule[]
  readonly isMultiLeg?: boolean
  readonly diagnostics?: {
    readonly zodQuarantine?: ReadonlyArray<{
      readonly index: number
      readonly errorPath: string
      readonly rawSnippet: string
    }>
  }
}
```

If existing valid state construction expects `rules` optional, make it required and update callers to use `rules: []` only for non-executable empty state.

- [ ] **Step 2: Delete flat reader file**

```bash
git rm apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state-flat-readers.ts
```

- [ ] **Step 3: Update test fixtures**

For every test `SemanticState` object, remove:

```ts
trigger: [],
action: [],
risk: [],
positionConstraint: [],
orchestration: [],
```

If a fixture used those fields to express executable semantics, convert it to `rules`.

- [ ] **Step 4: Run TypeScript build**

```bash
dx build quantify --dev
```

Expected: PASS. If it fails, fix remaining production imports or flat state constructions.

- [ ] **Step 5: Commit type deletion**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts
git add -u apps/quantify/src/modules/llm-strategy-codegen
git commit -F - <<'MSG'
refactor(ai-quant): remove flat semantic state buckets

Refs: #1633
MSG
```

## Task 9: Remove Projection Service from Production

**Files:**
- Modify/Delete: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-rule-projection.service.ts`
- Modify tests importing projection service
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage3-source-guard.spec.ts`

- [ ] **Step 1: Check remaining imports**

```bash
rg -n "SemanticRuleProjectionService|projectToFlat|reprojectFromRules" apps/quantify/src/modules/llm-strategy-codegen apps/quantify/src/modules/backtesting apps/quantify/src/modules/account-strategy-view
```

Expected before this task: only tests or projection service itself remain.

- [ ] **Step 2: Delete or quarantine projection**

If production has no imports and tests no longer need it, run:

```bash
git rm apps/quantify/src/modules/llm-strategy-codegen/services/semantic-rule-projection.service.ts
```

If a few tests still need rule projection only as fixture setup, move the minimal helper into test fixtures:

```text
apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/rules-test-helpers.ts
```

The helper must not be imported by production files.

- [ ] **Step 3: Run source guard**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage3-source-guard.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit projection removal**

```bash
git add -u apps/quantify/src/modules/llm-strategy-codegen
git commit -F - <<'MSG'
refactor(ai-quant): remove flat projection production path

Refs: #1633
MSG
```

## Task 10: Remove Legacy Backtest Snapshot Inference

**Files:**
- Modify: `apps/quantify/src/modules/backtesting/services/backtest-snapshot-loader.service.ts`
- Test: `apps/quantify/src/modules/backtesting/services/backtest-snapshot-loader.service.spec.ts`

- [ ] **Step 1: Add failing legacy inference rejection test**

In `backtest-snapshot-loader.service.spec.ts`, add:

```ts
it('fails closed instead of inferring risk rules from legacy trigger text', async () => {
  repository.findByIdForUser.mockResolvedValueOnce({
    id: 'snapshot-legacy-trigger-only',
    userId: 'user-1',
    specSnapshot: {
      trigger: [{ id: 'legacy-loss', trigger: '亏损 >= 5% 止损' }],
    },
    compiledIr: null,
    astSnapshot: null,
    scriptSnapshot: null,
    deploymentExecutionDefaults: null,
    deploymentExecutionConstraints: null,
  })

  await expect(loader.loadPublishedSnapshot({
    userId: 'user-1',
    publishedSnapshotId: 'snapshot-legacy-trigger-only',
    params: { marketType: 'perp' },
  })).rejects.toThrow(/republish|formal|snapshot/i)
})
```

Use actual mock names from the existing spec; keep assertion on the domain exception message if the file already checks exact `DomainException` codes.

- [ ] **Step 2: Delete legacy trigger parsing**

In `backtest-snapshot-loader.service.ts`, delete or stop calling:

```ts
findGraphTrigger
parseStopLossPct
parseConsecutiveBars
isOutsideBandTrigger
parseOutsideBandAction
parseReduceRatio
```

Keep risk information only when it comes from formal canonical spec / compiled IR / AST truth.

- [ ] **Step 3: Run snapshot loader tests**

```bash
dx test unit quantify apps/quantify/src/modules/backtesting/services/backtest-snapshot-loader.service.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit backtest cleanup**

```bash
git add apps/quantify/src/modules/backtesting/services/backtest-snapshot-loader.service.ts apps/quantify/src/modules/backtesting/services/backtest-snapshot-loader.service.spec.ts
git commit -F - <<'MSG'
refactor(ai-quant): remove legacy backtest snapshot inference

Refs: #1633
MSG
```

## Task 11: Convert or Remove Legacy Fixtures

**Files:**
- Modify: `apps/quantify/e2e/llm-strategy-codegen/original-strategy-flow.e2e-spec.ts`
- Modify: `apps/quantify/e2e/llm-strategy-codegen/full-matrix.e2e-spec.ts`
- Modify: `apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/*`

- [ ] **Step 1: Classify legacy fixtures**

Run:

```bash
rg -n "triggers:|actions:|risk:|positionConstraint:|orchestration:" apps/quantify/e2e/llm-strategy-codegen apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures
```

Expected: list of legacy fixture objects to convert.

- [ ] **Step 2: Convert executable fixtures**

For each executable fixture object, replace old fields with either natural language replay input:

```ts
{
  id: 'ema-cross-long',
  userPrompt: 'EMA7 上穿 EMA21 时开多；下穿时平多。',
}
```

or typed rules:

```ts
{
  id: 'ema-cross-long',
  rules: [{
    id: 'entry-ema-cross',
    phase: 'entry',
    sideScope: 'long',
    condition: { kind: 'atom', key: 'indicator.cross_over', params: { fastPeriod: 7, slowPeriod: 21 } },
    effects: {
      actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
      risks: [],
      positions: [],
      orchestration: [],
      programs: [],
    },
    evidence: { text: 'EMA7 上穿 EMA21 时开多' },
  }],
}
```

- [ ] **Step 3: Keep legacy rejection fixtures only in rejection tests**

If a fixture intentionally verifies old payload rejection, keep it inline inside the rejection test and name it `legacyRejectedPayload`.

- [ ] **Step 4: Run fixture-related tests**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/thirty-one-strategy-rules-tree-main-flow.spec.ts
dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen/original-strategy-flow.e2e-spec.ts
```

Expected: PASS or formal fail-closed expectations for unsupported strategies.

- [ ] **Step 5: Commit fixture conversion**

```bash
git add apps/quantify/e2e/llm-strategy-codegen apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/thirty-one-strategy-rules-tree-main-flow.spec.ts
git commit -F - <<'MSG'
test(ai-quant): convert legacy fixtures to rules corpus

Refs: #1633
MSG
```

## Task 12: Add Stage 3 Staging Report

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/scripts/staging30-rules-only-mainflow-cases.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/scripts/staging30-rules-only-mainflow-report.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/scripts/__tests__/staging30-rules-only-mainflow-report.spec.ts`

- [ ] **Step 1: Verify corpus strings match spec**

Replace the cases file with the 30 prompts from `docs/superpowers/specs/2026-05-26-rules-only-stage3-hard-delete-design.md`. Keep case ids stable as `stage3-01` through `stage3-30`.

Example case shape:

```ts
export const STAGE3_RULES_ONLY_STAGING_CASES = [
  {
    id: 'stage3-01',
    prompt: '入场：15m k线里面 价格在ema20 ema60 ema144上方时做多开仓；出场：15m k线里面 价格低于ema20时平多；止损：5%；仓位：10usdt',
  },
] as const
```

- [ ] **Step 2: Add evidence fields to report**

Ensure report output includes:

```ts
interface Stage3StagingEvidence {
  caseId: string
  conversationId: string | null
  strategyId: string | null
  publishedSnapshotId: string | null
  rulesHash: string | null
  canonicalSpecHash: string | null
  irHash: string | null
  scriptHash: string | null
  backtestStatus: 'passed' | 'failed' | 'not_run'
  deployStatus: 'passed' | 'failed' | 'not_run'
  runtimeStatus: 'passed' | 'failed' | 'not_run'
  failClosedReason: string | null
}
```

- [ ] **Step 3: Add test for all 30 cases and evidence shape**

In `staging30-rules-only-mainflow-report.spec.ts`, add:

```ts
it('contains the fixed stage3 30-case corpus and required evidence fields', () => {
  expect(STAGE3_RULES_ONLY_STAGING_CASES).toHaveLength(30)
  expect(STAGE3_RULES_ONLY_STAGING_CASES[0]?.prompt).toContain('ema20 ema60 ema144')
  expect(STAGE3_RULES_ONLY_STAGING_CASES[29]?.prompt).toContain('每天定投 100 USDT')

  const evidenceKeys = [
    'caseId',
    'conversationId',
    'strategyId',
    'publishedSnapshotId',
    'rulesHash',
    'canonicalSpecHash',
    'irHash',
    'scriptHash',
    'backtestStatus',
    'deployStatus',
    'runtimeStatus',
    'failClosedReason',
  ]
  expect(requiredEvidenceKeys()).toEqual(evidenceKeys)
})
```

Export `requiredEvidenceKeys()` from `staging30-rules-only-mainflow-report.ts` in the same change as the test. The function returns exactly the `evidenceKeys` array above and is used only by tests/report validation.

- [ ] **Step 4: Run staging report tests**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/scripts/__tests__/staging30-rules-only-mainflow-report.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit staging report update**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/scripts/staging30-rules-only-mainflow-cases.ts apps/quantify/src/modules/llm-strategy-codegen/scripts/staging30-rules-only-mainflow-report.ts apps/quantify/src/modules/llm-strategy-codegen/scripts/__tests__/staging30-rules-only-mainflow-report.spec.ts
git commit -F - <<'MSG'
test(ai-quant): define stage3 staging corpus evidence

Refs: #1633
MSG
```

## Task 13: Run Local Integration Gates

**Files:**
- Existing files from previous tasks.

- [ ] **Step 1: Run source guard**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage3-source-guard.spec.ts
```

Expected: PASS with no production matches.

- [ ] **Step 2: Run focused unit suite**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-planner-schema-reject.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Run quantify build**

```bash
dx build quantify --dev
```

Expected: PASS with no TypeScript references to removed fields.

- [ ] **Step 4: Record local gate result**

If source files changed during verification, inspect them with `git diff` and commit only intentional test snapshot/report updates. Do not commit generated logs from `tmp/`, `coverage/`, or local env files.

```bash
git status --short
git diff -- apps/quantify/src/modules/llm-strategy-codegen apps/quantify/src/modules/backtesting apps/quantify/src/modules/account-strategy-view
git add apps/quantify/src/modules/llm-strategy-codegen apps/quantify/src/modules/backtesting apps/quantify/src/modules/account-strategy-view
git commit -F - <<'MSG'
test(ai-quant): update stage3 verification artifacts

Refs: #1633
MSG
```

If `git diff` shows no intentional source/test/report changes, do not run the commit command.

## Task 14: Run Staging Failure Discovery

**Files:**
- Modify or create staging evidence report under a non-ignored path if the repository already stores reports.
- Do not commit `.env.staging.local`.

- [ ] **Step 1: Confirm staging env file exists**

```bash
test -f .env.staging.local && echo "staging env present"
```

Expected: `staging env present`.

- [ ] **Step 2: Run fixed staging 30 report script against `.env.staging.local`**

```bash
pnpm --filter @net/quantify exec tsx src/modules/llm-strategy-codegen/scripts/staging30-rules-only-mainflow-report.ts --env staging --out ../../tmp/stage3-rules-only-staging30-report.json
```

Expected:
- Script loads `.env.staging` and `.env.staging.local`.
- Script reads `QUANTIFY_STAGING_API_BASE_URL` or `QUANTIFY_API_BASE_URL` or `QUANTIFY_BASE_URL`.
- Script reads `QUANTIFY_STAGING_AUTH_TOKEN` or `AI_QUANT_JWT_TOKEN`.
- Raw JSON report written to `tmp/stage3-rules-only-staging30-report.json` from repo root.

If auth token is absent, obtain it through existing staging login flow using the fixed account in Step 3, export it as `QUANTIFY_STAGING_AUTH_TOKEN`, and rerun the same command.

- [ ] **Step 3: Login with fixed account**

Use:

```text
email: 123456@qq.com
verification code: 123456
```

- [ ] **Step 4: Query or replay 30 strategy cases**

For each `stage3-01` through `stage3-30`, record:

```text
caseId
conversationId
strategyId
publishedSnapshotId
rulesHash
canonicalSpecHash
irHash
scriptHash
backtestStatus
deployStatus
runtimeStatus
failClosedReason
```

- [ ] **Step 5: Fix failures generically**

For any failed case, classify failure into one generic bucket:

```text
planner rules emission
schema gate
clarification/readiness
display
canonical spec
IR/AST/script
backtest snapshot truth
deploy snapshot truth
runtime execution
unsupported capability
```

Do not add case-id based logic. Fix only the shared module responsible for that bucket and add a focused regression test in the matching task area.

- [ ] **Step 6: Commit redacted staging evidence**

Create `docs/superpowers/reports/2026-05-26-stage3-staging30-summary.md` with:
- command run
- generated raw report path
- total/pass/fail counts
- failed case IDs
- generic failure bucket for each failed case
- no auth token, no cookie, no database URL, no private user data

Then commit the redacted summary:

```bash
git add -f docs/superpowers/reports/2026-05-26-stage3-staging30-summary.md
git commit -F - <<'MSG'
test(ai-quant): record stage3 staging evidence

Refs: #1633
MSG
```

## Task 15: Final PR Readiness

**Files:**
- PR body only.

- [ ] **Step 1: Run final required checks**

```bash
dx build quantify --dev
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage3-source-guard.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-planner-schema-reject.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts
```

Expected: all PASS.

- [ ] **Step 2: Run final production source scan**

```bash
rg -n "readFlatTriggers|readFlatActions|readFlatRisks|readFlatPositionConstraints|projectToFlat|reprojectFromRules|SemanticStateBuckets|\\bstate\\.trigger\\b|\\bstate\\.action\\b|\\bstate\\.risk\\b|\\bstate\\.positionConstraint\\b|\\bstate\\.orchestration\\b" apps/quantify/src/modules/llm-strategy-codegen apps/quantify/src/modules/backtesting apps/quantify/src/modules/account-strategy-view -g '*.ts' -g '!**/*.spec.ts' -g '!**/__tests__/**'
```

Expected: no output.

- [ ] **Step 3: Prepare PR body**

Use this structure:

```markdown
## 变更目的

- 对应 Issue 验收标准 [1]：TypeScript 已无法构造 flat-only SemanticState。
- 对应 Issue 验收标准 [2]：生产代码无旧五桶字段引用。
- 对应 Issue 验收标准 [3]：旧 fixture 已改为自然语言 replay 或 typed rules corpus。
- 对应 Issue 验收标准 [4]：策略能力通过 typed rules 重建。
- 对应 Issue 验收标准 [5]：30 条 staging corpus 已运行并记录证据。
- 对应 Issue 验收标准 [6]：入口 schema gate 对旧 patch 字段 fail-closed。
- 对应 Issue 验收标准 [7]：display/readiness/canonical/IR/script/runtime 无语义缺失。
- 对应 Issue 验收标准 [8]：入口侧验证覆盖文本对话、识别、补槽、生成和脚本。

## 主要改动和解决的问题

- 删除 flat five-bucket SemanticState 和 readFlat/projection 兼容层。
- 将 conversation/readiness/display/canonical/backtest/deploy 切到 rules-native 读写。
- 删除 legacy snapshot 文案反推执行语义路径。

## 遗留的问题

- 无。

## 已做的验证

- dx build quantify --dev -> PASS
- dx test unit quantify ...stage3-source-guard.spec.ts -> PASS
- dx test unit quantify ...codegen-conversation-planner-schema-reject.spec.ts -> PASS
- dx test unit quantify ...semantic-contract-readiness.service.rules-mode.spec.ts -> PASS
- dx test unit quantify ...canonical-spec-builder.rules-only-mainflow.spec.ts -> PASS
- dx test unit quantify ...publication-gate-rules-only-hash-chain.spec.ts -> PASS
- staging 30 corpus -> attach report path and summary.

##  PR 遗留未做的

- 无。

## 关联

Closes: #1633
Refs: #1629
Refs: #1676
```

- [ ] **Step 4: Create PR**

```bash
gh pr create --title "refactor(ai-quant): hard delete flat semantic paths" --body-file - <<'MSG'
## 变更目的

- 对应 Issue 验收标准 [1]：TypeScript 已无法构造 flat-only SemanticState。
- 对应 Issue 验收标准 [2]：生产代码无旧五桶字段引用。
- 对应 Issue 验收标准 [3]：旧 fixture 已改为自然语言 replay 或 typed rules corpus。
- 对应 Issue 验收标准 [4]：策略能力通过 typed rules 重建。
- 对应 Issue 验收标准 [5]：30 条 staging corpus 已运行并记录证据。
- 对应 Issue 验收标准 [6]：入口 schema gate 对旧 patch 字段 fail-closed。
- 对应 Issue 验收标准 [7]：display/readiness/canonical/IR/script/runtime 无语义缺失。
- 对应 Issue 验收标准 [8]：入口侧验证覆盖文本对话、识别、补槽、生成和脚本。

## 主要改动和解决的问题

- 删除 flat five-bucket SemanticState 和 readFlat/projection 兼容层。
- 将 conversation/readiness/display/canonical/backtest/deploy 切到 rules-native 读写。
- 删除 legacy snapshot 文案反推执行语义路径。

## 遗留的问题

- 无。

## 已做的验证

- dx build quantify --dev -> PASS
- dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/stage3-source-guard.spec.ts -> PASS
- dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-planner-schema-reject.spec.ts -> PASS
- dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts -> PASS
- dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts -> PASS
- dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts -> PASS
- pnpm --filter @net/quantify exec tsx src/modules/llm-strategy-codegen/scripts/staging30-rules-only-mainflow-report.ts --env staging --out ../../tmp/stage3-rules-only-staging30-report.json -> PASS, see docs/superpowers/reports/2026-05-26-stage3-staging30-summary.md

## PR 遗留未做的

- 无。

## 关联

Closes: #1633
Refs: #1629
Refs: #1676
MSG
```
