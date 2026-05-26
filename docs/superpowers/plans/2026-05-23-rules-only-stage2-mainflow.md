# Rules-Only Stage 2 Mainflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the AI Quant production mainflow rules-only from new conversation entry through clarification, display, canonical spec, IR, script, backtest, deploy payload, and runtime execution.

**Architecture:** Keep flat buckets and compatibility code for Stage 3 cleanup, but remove them from production mainflow decisions. Add a centralized rules reader/visitor that exposes typed rule paths, then migrate readiness, display, canonical spec, publication gates, backtest/deploy/runtime checks to rules/canonical/IR truth only.

**Tech Stack:** TypeScript, NestJS, Jest, Prisma, Nx via `dx`, PM2 staging, AI Quant `llm-strategy-codegen` and `account-strategy-view` modules.

---

## File Structure

- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/rules-mainflow-reader.service.ts`  
  Central rules-only visitor for `SemanticState.rules`. Produces source-path-aware condition/effect leaves and rejects empty/non-typed rules for mainflow.

- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-mainflow-reader.service.spec.ts`  
  Unit tests for rule path extraction, role separation, empty-rules rejection, and legacy array effect rejection.

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`  
  Move mainflow readiness and open slot ownership to rule paths. Keep existing flat behavior only in explicitly named compatibility helpers.

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts`  
  Update tests so `rules_empty` is fail-closed in mainflow and missing slots use rule paths.

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`  
  Ensure conversation, clarification answer writes, assistant description, generation confirmation, and publication kickoff use rules-only artifacts and never use flat readers for mainflow readiness/description decisions.

- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-rules-only-mainflow.spec.ts`  
  Conversation-level tests for entry, clarification, assistant prompt, and generation handoff.

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`  
  Restrict display graph source to rules/canonical source paths for new mainflow.

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts`  
  Assert display items use rules/canonical source paths and do not show semantics absent from rules.

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`  
  Add rules visitor based builder path and route `buildFromSemanticState` through rules for mainflow. Keep legacy checklist builder isolated.

- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts`  
  Tests for rules-only canonical condition/actions/risks/positions/orchestration/programs and no flat-only semantic leakage.

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts`  
  Build semantic view, locked params, publish params, and compiled artifacts from rules/canonical/IR only. Add hash-chain output.

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/compiled-publication-gate.service.ts`  
  Add rules/canonical/IR/AST/script trace and hash validation.

- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts`  
  Tests for hash chain, missing trace rejection, and flat-only artifact rejection.

- Modify: `apps/quantify/src/modules/backtesting/services/backtest-strategy-adapter.service.ts`  
  Ensure backtest consumes canonical/IR snapshot truth and does not derive execution semantics from flat/display/specDesc.

- Modify: `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts`  
  Ensure deploy payload requires published snapshot canonical/IR/AST/script bindings and initializes runtime execution only from snapshot truth.

- Modify: `apps/quantify/src/modules/strategy-signals/services/strategy-runtime-execution-state.service.ts`  
  Ensure execution semantic keys come from snapshot IR/AST/execution envelope, not flat state.

- Create: `apps/quantify/src/modules/account-strategy-view/services/__tests__/account-strategy-view-deploy-rules-only.spec.ts`  
  Tests for deploy requires republish when snapshot lacks canonical/IR/AST/script truth and for successful binding from snapshot.

- Create: `apps/quantify/src/modules/llm-strategy-codegen/scripts/staging30-rules-only-mainflow-report.ts`  
  PM2 staging evidence runner for 30 new sessions. Produces per-strategy hashes and fail reason when flat/legacy fallback is observed.

- Create: `apps/quantify/src/modules/llm-strategy-codegen/scripts/staging30-rules-only-mainflow-cases.ts`  
  30 natural-language staging cases. No migration inputs, no old session ids, no fixture replay.

- Create: `apps/quantify/src/modules/llm-strategy-codegen/scripts/__tests__/staging30-rules-only-mainflow-report.spec.ts`  
  Contract tests for evidence output shape and fail-closed conditions.

---

### Task 1: Central Rules Mainflow Reader

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/rules-mainflow-reader.service.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-mainflow-reader.service.spec.ts`

- [ ] **Step 1: Write failing tests for rule paths and role separation**

Add:

```ts
import type { AtomExpr, SemanticRule } from '../../types/atom-expr'
import { RulesMainflowReaderService } from '../rules-mainflow-reader.service'

const atom = (key: string, params: Record<string, unknown> = {}): AtomExpr => ({ kind: 'atom', key, params })

describe('RulesMainflowReaderService', () => {
  const reader = new RulesMainflowReaderService()

  it('extracts condition and typed effect leaves with source paths', () => {
    const rules: SemanticRule[] = [{
      id: 'r1',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'and', children: [atom('indicator.ema_above'), atom('volume.threshold')] },
      effects: {
        actions: [atom('action.open_long')],
        risks: [atom('risk.stop_loss_pct', { pct: 5 })],
        positions: [atom('position.sizing', { value: 10, unit: 'USDT' })],
        orchestration: [atom('scope.timeframe', { timeframe: '15m' })],
        programs: [],
      },
      evidence: { text: 'ema above and volume' },
    }]

    const view = reader.readMainflowRules(rules)

    expect(view.ok).toBe(true)
    if (!view.ok) return
    expect(view.leaves.map(leaf => [leaf.role, leaf.key, leaf.path])).toEqual([
      ['condition', 'indicator.ema_above', 'rules[0].condition.and.children[0]'],
      ['condition', 'volume.threshold', 'rules[0].condition.and.children[1]'],
      ['action', 'action.open_long', 'rules[0].effects.actions[0]'],
      ['risk', 'risk.stop_loss_pct', 'rules[0].effects.risks[0]'],
      ['position', 'position.sizing', 'rules[0].effects.positions[0]'],
      ['orchestration', 'scope.timeframe', 'rules[0].effects.orchestration[0]'],
    ])
  })

  it('rejects empty rules for production mainflow', () => {
    expect(reader.readMainflowRules([])).toEqual({
      ok: false,
      reason: 'rules_missing_or_empty',
      diagnostics: ['SemanticState.rules must be non-empty for rules-only mainflow'],
    })
  })

  it('rejects legacy array effects for production mainflow', () => {
    const rules: SemanticRule[] = [{
      id: 'legacy',
      phase: 'entry',
      sideScope: 'long',
      condition: atom('price.breakout'),
      effects: [atom('action.open_long')],
    }]

    expect(reader.readMainflowRules(rules)).toMatchObject({
      ok: false,
      reason: 'legacy_effects_array',
    })
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-mainflow-reader.service.spec.ts
```

Expected: fail because `rules-mainflow-reader.service.ts` does not exist.

- [ ] **Step 3: Implement rules mainflow reader**

Create:

```ts
import { Injectable } from '@nestjs/common'
import type { AtomExpr, AtomExprAtom, RuleEffectsByRole, SemanticRule } from '../types/atom-expr'
import { isRuleEffectsByRole } from '../types/atom-expr'

export type MainflowLeafRole = 'condition' | 'action' | 'risk' | 'position' | 'orchestration' | 'program'

export interface RulesMainflowLeaf {
  ruleId: string
  ruleIndex: number
  phase: SemanticRule['phase']
  sideScope: SemanticRule['sideScope']
  role: MainflowLeafRole
  key: string
  params: Record<string, unknown>
  path: string
  evidenceText: string | null
}

export interface RulesMainflowView {
  rules: readonly SemanticRule[]
  leaves: readonly RulesMainflowLeaf[]
  byRole: Record<MainflowLeafRole, readonly RulesMainflowLeaf[]>
}

export type RulesMainflowReadResult =
  | { ok: true; view: RulesMainflowView; leaves: readonly RulesMainflowLeaf[] }
  | { ok: false; reason: 'rules_missing_or_empty' | 'legacy_effects_array' | 'invalid_expr'; diagnostics: readonly string[] }

const EFFECT_ROLE_TO_LEAF_ROLE: Record<keyof RuleEffectsByRole, MainflowLeafRole> = {
  actions: 'action',
  risks: 'risk',
  positions: 'position',
  orchestration: 'orchestration',
  programs: 'program',
}

@Injectable()
export class RulesMainflowReaderService {
  readMainflowRules(rules: readonly SemanticRule[] | null | undefined): RulesMainflowReadResult {
    if (!rules || rules.length === 0) {
      return {
        ok: false,
        reason: 'rules_missing_or_empty',
        diagnostics: ['SemanticState.rules must be non-empty for rules-only mainflow'],
      }
    }

    const leaves: RulesMainflowLeaf[] = []
    const diagnostics: string[] = []

    rules.forEach((rule, ruleIndex) => {
      this.collectExprLeaves({
        expr: rule.condition,
        path: `rules[${ruleIndex}].condition`,
        role: 'condition',
        rule,
        ruleIndex,
        leaves,
        diagnostics,
      })

      if (!isRuleEffectsByRole(rule.effects)) {
        diagnostics.push(`rules[${ruleIndex}].effects must be typed RuleEffects`)
        return
      }

      for (const [effectRole, effectLeaves] of Object.entries(rule.effects) as Array<[keyof RuleEffectsByRole, readonly AtomExpr[]]>) {
        effectLeaves.forEach((effect, effectIndex) => {
          this.collectExprLeaves({
            expr: effect,
            path: `rules[${ruleIndex}].effects.${effectRole}[${effectIndex}]`,
            role: EFFECT_ROLE_TO_LEAF_ROLE[effectRole],
            rule,
            ruleIndex,
            leaves,
            diagnostics,
          })
        })
      }
    })

    if (diagnostics.some(item => item.includes('effects must be typed RuleEffects'))) {
      return { ok: false, reason: 'legacy_effects_array', diagnostics }
    }
    if (diagnostics.length > 0) {
      return { ok: false, reason: 'invalid_expr', diagnostics }
    }

    const byRole = {
      condition: leaves.filter(leaf => leaf.role === 'condition'),
      action: leaves.filter(leaf => leaf.role === 'action'),
      risk: leaves.filter(leaf => leaf.role === 'risk'),
      position: leaves.filter(leaf => leaf.role === 'position'),
      orchestration: leaves.filter(leaf => leaf.role === 'orchestration'),
      program: leaves.filter(leaf => leaf.role === 'program'),
    } satisfies Record<MainflowLeafRole, readonly RulesMainflowLeaf[]>

    return { ok: true, view: { rules, leaves, byRole }, leaves }
  }

  private collectExprLeaves(input: {
    expr: AtomExpr
    path: string
    role: MainflowLeafRole
    rule: SemanticRule
    ruleIndex: number
    leaves: RulesMainflowLeaf[]
    diagnostics: string[]
  }): void {
    const { expr, path } = input
    if (expr.kind === 'atom') {
      this.pushAtomLeaf(input, expr)
      return
    }
    if (expr.kind === 'and' || expr.kind === 'or') {
      expr.children.forEach((child, index) => this.collectExprLeaves({ ...input, expr: child, path: `${path}.${expr.kind}.children[${index}]` }))
      return
    }
    if (expr.kind === 'not') {
      this.collectExprLeaves({ ...input, expr: expr.child, path: `${path}.not.child` })
      return
    }
    if (expr.kind === 'sequence') {
      expr.steps.forEach((step, index) => this.collectExprLeaves({ ...input, expr: step, path: `${path}.sequence.steps[${index}]` }))
      return
    }
    input.diagnostics.push(`${path} has unsupported expression kind`)
  }

  private pushAtomLeaf(input: {
    path: string
    role: MainflowLeafRole
    rule: SemanticRule
    ruleIndex: number
    leaves: RulesMainflowLeaf[]
  }, atom: AtomExprAtom): void {
    input.leaves.push({
      ruleId: input.rule.id,
      ruleIndex: input.ruleIndex,
      phase: input.rule.phase,
      sideScope: input.rule.sideScope,
      role: input.role,
      key: atom.key,
      params: atom.params ?? {},
      path: input.path,
      evidenceText: atom.evidence?.text ?? input.rule.evidence?.text ?? null,
    })
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-mainflow-reader.service.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/rules-mainflow-reader.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-mainflow-reader.service.spec.ts
git commit -F - <<'MSG'
feat(ai-quant): add rules mainflow reader

Refs: #1632
MSG
```

---

### Task 2: Readiness And Clarification Rule Paths

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-rules-only-mainflow.spec.ts`

- [ ] **Step 1: Write failing readiness tests**

Append to `semantic-contract-readiness.service.rules-mode.spec.ts`:

```ts
it('mainflow rejects empty rules instead of falling back to flat buckets', () => {
  const r = svc.evaluateMainflowRulesReadiness([])

  expect(r.ready).toBe(false)
  expect(r.blockingReasons).toContain('rules_missing_or_empty')
  expect(JSON.stringify(r.openSlots)).not.toContain('trigger[')
  expect(JSON.stringify(r.openSlots)).not.toContain('risk[')
})

it('mainflow missing stop loss slot points to typed rules path', () => {
  const rules: SemanticRule[] = [
    rule({
      id: 'r-entry',
      phase: 'entry',
      condition: atom('price.breakout_up', { lookback: 20 }),
      effects: {
        actions: [atom('action.open_long')],
        risks: [atom('risk.stop_loss_pct', {})],
        positions: [atom('position.sizing', { value: 10, unit: 'USDT' })],
        orchestration: [atom('scope.timeframe', { timeframe: '15m' })],
        programs: [],
      },
    }),
  ]

  const r = svc.evaluateMainflowRulesReadiness(rules)

  expect(r.ready).toBe(false)
  expect(r.openSlots).toEqual(expect.arrayContaining([
    expect.objectContaining({
      fieldPath: 'rules[0].effects.risks[0].params.pct',
      slotKey: 'risk.stop_loss_pct.pct',
    }),
  ]))
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts
```

Expected: fail because `evaluateMainflowRulesReadiness` does not exist.

- [ ] **Step 3: Add mainflow readiness method**

In `semantic-contract-readiness.service.ts`, inject or construct the reader and add:

```ts
import { RulesMainflowReaderService } from './rules-mainflow-reader.service'

export interface MainflowRulesReadinessResult {
  ready: boolean
  blockingReasons: string[]
  openSlots: SemanticSlotState[]
}

private readonly rulesMainflowReader = new RulesMainflowReaderService()

evaluateMainflowRulesReadiness(rules: readonly SemanticRule[] | null | undefined): MainflowRulesReadinessResult {
  const read = this.rulesMainflowReader.readMainflowRules(rules)
  if (!read.ok) {
    return {
      ready: false,
      blockingReasons: [read.reason],
      openSlots: [],
    }
  }

  const openSlots: SemanticSlotState[] = []
  for (const leaf of read.leaves) {
    if (leaf.role === 'risk' && leaf.key === 'risk.stop_loss_pct' && typeof leaf.params.pct !== 'number') {
      openSlots.push({
        slotKey: 'risk.stop_loss_pct.pct',
        fieldPath: `${leaf.path}.params.pct`,
        status: 'open',
        priority: 'risk',
        questionHint: '请确认止损百分比。',
        affectsExecution: true,
        atomKey: leaf.key,
        paramSlotKey: 'pct',
      })
    }
    if (leaf.role === 'position' && leaf.key === 'position.sizing' && typeof leaf.params.value !== 'number') {
      openSlots.push({
        slotKey: 'position.sizing.value',
        fieldPath: `${leaf.path}.params.value`,
        status: 'open',
        priority: 'risk',
        questionHint: '请确认单笔仓位大小。',
        affectsExecution: true,
        atomKey: leaf.key,
        paramSlotKey: 'value',
      })
    }
  }

  const hasEntry = read.leaves.some(leaf => leaf.role === 'condition' && (leaf.phase === 'entry' || leaf.phase === 'gate' || leaf.phase === 'program'))
  const hasExecutableEffect = read.leaves.some(leaf => leaf.role === 'action' || leaf.role === 'program')
  const hasExit = read.leaves.some(leaf => leaf.phase === 'exit' || (leaf.role === 'risk' && leaf.key.includes('stop')))

  const blockingReasons = [
    ...(!hasEntry || !hasExecutableEffect ? ['missing_entry_rules'] : []),
    ...(!hasExit ? ['missing_exit_rules'] : []),
    ...(openSlots.length > 0 ? ['missing_required_rule_params'] : []),
  ]

  return {
    ready: blockingReasons.length === 0,
    blockingReasons,
    openSlots,
  }
}
```

- [ ] **Step 4: Route conversation deterministic readiness through mainflow method**

In `codegen-conversation.service.ts`, replace mainflow readiness calls that decide whether to ask/generate with `evaluateMainflowRulesReadiness`. Use this guard before any flat-derived readiness:

```ts
const rulesReadiness = this.semanticContractReadiness.evaluateMainflowRulesReadiness(reducedSemanticState.rules)
if (!rulesReadiness.ready) {
  const clarificationState = this.buildRulePathClarificationState(rulesReadiness.openSlots, rulesReadiness.blockingReasons)
  const assistantPrompt = this.renderRulePathClarificationPrompt(clarificationState, responseLocale)
  await this.sessionsRepo.updateSession(session.id, {
    ...this.stateMachine.buildConversationUpdate({
      status: 'DRAFTING',
      semanticState: reducedSemanticState,
      clarificationState,
      constraintPack: nextConstraintPack,
    }),
  } as Prisma.LlmStrategyCodegenSessionUpdateInput)
  return this.returnPersistedSessionResponse(session.id, sessionUserId, this.finalizeSessionResponse({
    id: session.id,
    status: 'DRAFTING',
    missingFields: [],
    assistantPrompt,
    clarificationState,
  }))
}
```

Add helper names with concrete behavior:

```ts
private buildRulePathClarificationState(openSlots: SemanticSlotState[], blockingReasons: string[]): StrategyClarificationState {
  return {
    status: openSlots.length > 0 ? 'NEEDS_USER_INPUT' : 'BLOCKED',
    items: openSlots.map(slot => ({
      key: slot.fieldPath,
      field: slot.fieldPath,
      status: 'open',
      reason: blockingReasons[0] ?? 'missing_required_rule_params',
      question: slot.questionHint,
      priority: slot.priority,
      affectsExecution: slot.affectsExecution,
    })),
  } as StrategyClarificationState
}

private renderRulePathClarificationPrompt(clarificationState: StrategyClarificationState, locale: CodegenConversationLocale): string {
  const first = clarificationState.items.find(item => item.status === 'open')
  if (first?.question) return first.question
  return this.localizedText(locale, 'Please clarify the missing rule parameter before I generate the script.', '请先补充缺失的规则参数，我再生成脚本。')
}
```

- [ ] **Step 5: Write conversation test for rule-path clarification**

Create `codegen-conversation-rules-only-mainflow.spec.ts` with a focused test around helper behavior. Use private access only for the new helper to avoid full LLM setup:

```ts
import type { SemanticSlotState } from '../../types/semantic-state'
import { CodegenConversationService } from '../codegen-conversation.service'

describe('CodegenConversationService rules-only mainflow helpers', () => {
  it('builds clarification items using rule paths', () => {
    const service = Object.create(CodegenConversationService.prototype) as CodegenConversationService & {
      buildRulePathClarificationState: (slots: SemanticSlotState[], reasons: string[]) => { items: Array<{ key: string; field: string }> }
    }

    const state = service.buildRulePathClarificationState([{
      slotKey: 'risk.stop_loss_pct.pct',
      fieldPath: 'rules[0].effects.risks[0].params.pct',
      status: 'open',
      priority: 'risk',
      questionHint: '请确认止损百分比。',
      affectsExecution: true,
    }], ['missing_required_rule_params'])

    expect(state.items[0]).toMatchObject({
      key: 'rules[0].effects.risks[0].params.pct',
      field: 'rules[0].effects.risks[0].params.pct',
    })
  })
})
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-rules-only-mainflow.spec.ts
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-rules-only-mainflow.spec.ts
git commit -F - <<'MSG'
fix(ai-quant): make readiness use rules mainflow paths

Refs: #1632
MSG
```

---

### Task 3: Display Graph Rules-Only Source

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts`

- [ ] **Step 1: Write failing display test**

Append to `display-logic-graph-rules-tree.spec.ts`:

```ts
it('does not render flat-only action when rules omit it', () => {
  const state = {
    version: 1,
    families: [],
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    trigger: [],
    action: [{
      id: 'flat-action',
      key: 'action.open_long',
      phase: 'entry',
      params: {},
      status: 'locked',
      source: 'derived',
      openSlots: [],
    }],
    risk: [],
    positionConstraint: [],
    orchestration: [],
    position: null,
    orchestrationContracts: [],
    normalizationNotes: [],
    updatedAt: new Date(0).toISOString(),
    rules: [{
      id: 'r1',
      phase: 'entry',
      sideScope: 'long',
      condition: { kind: 'atom', key: 'price.breakout_up', params: {} },
      effects: { actions: [], risks: [], positions: [], orchestration: [], programs: [] },
    }],
  } as const

  const graph = service.buildDisplayLogicGraphFromSemanticState(state)

  expect(JSON.stringify(graph)).toContain('rules[0].condition')
  expect(JSON.stringify(graph)).not.toContain('flat-action')
  expect(JSON.stringify(graph)).not.toContain('action.open_long')
})
```

- [ ] **Step 2: Run test to verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts
```

Expected: fail because display still includes flat-only semantics or lacks source path.

- [ ] **Step 3: Implement rules-only display source**

In `semantic-state-projection.service.ts`, route new-session display graph builder through `RulesMainflowReaderService`:

```ts
private readonly rulesMainflowReader = new RulesMainflowReaderService()

buildDisplayLogicGraphFromSemanticState(state: SemanticState): DisplayLogicGraph {
  const read = this.rulesMainflowReader.readMainflowRules(state.rules)
  if (!read.ok) {
    return { blocks: [], diagnostics: [{ code: read.reason, message: read.diagnostics.join('; ') }] } as DisplayLogicGraph
  }

  return {
    blocks: read.view.rules.map((rule, ruleIndex) => ({
      id: rule.id,
      type: rule.phase === 'program' ? 'EXECUTE' : 'IF',
      sourcePath: `rules[${ruleIndex}]`,
      items: read.leaves
        .filter(leaf => leaf.ruleId === rule.id)
        .map(leaf => ({
          id: leaf.path,
          kind: leaf.role === 'condition' ? 'condition' : leaf.role === 'program' ? 'execute' : 'action',
          label: leaf.key,
          sourcePath: leaf.path,
          params: leaf.params,
        })),
    })),
  } as DisplayLogicGraph
}
```

Keep existing legacy display helper under an explicit name:

```ts
buildLegacyDisplayLogicGraphFromFlatProjection(state: SemanticState): DisplayLogicGraph {
  return this.buildExistingFlatDisplayGraph(state)
}
```

- [ ] **Step 4: Run display tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts
git commit -F - <<'MSG'
fix(ai-quant): derive display graph from rules mainflow

Refs: #1632
MSG
```

---

### Task 4: Canonical Spec Builder Rules Visitor Path

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts`

- [ ] **Step 1: Write failing canonical builder tests**

Create:

```ts
import type { SemanticState } from '../../types/semantic-state'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'

const baseState = (overrides: Partial<SemanticState>): SemanticState => ({
  version: 1,
  families: [],
  contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
  trigger: [],
  action: [],
  risk: [],
  positionConstraint: [],
  orchestration: [],
  position: null,
  orchestrationContracts: [],
  normalizationNotes: [],
  updatedAt: new Date(0).toISOString(),
  ...overrides,
})

describe('CanonicalSpecBuilderService rules-only mainflow', () => {
  const builder = new CanonicalSpecBuilderService()

  it('builds canonical actions from rules effects, ignoring flat-only actions', () => {
    const spec = builder.buildFromSemanticState(baseState({
      action: [{
        id: 'flat-open',
        key: 'action.open_short',
        phase: 'entry',
        params: {},
        status: 'locked',
        source: 'derived',
        openSlots: [],
      }],
      rules: [{
        id: 'r-entry',
        phase: 'entry',
        sideScope: 'long',
        condition: { kind: 'atom', key: 'price.breakout_up', params: { lookback: 20 } },
        effects: {
          actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
          risks: [{ kind: 'atom', key: 'risk.stop_loss_pct', params: { pct: 5 } }],
          positions: [{ kind: 'atom', key: 'position.sizing', params: { value: 10, unit: 'USDT' } }],
          orchestration: [{ kind: 'atom', key: 'scope.timeframe', params: { timeframe: '15m' } }],
          programs: [],
        },
      }],
    }))

    expect(JSON.stringify(spec)).toContain('action.open_long')
    expect(JSON.stringify(spec)).toContain('rules[0].effects.actions[0]')
    expect(JSON.stringify(spec)).not.toContain('action.open_short')
    expect(JSON.stringify(spec)).not.toContain('flat-open')
  })

  it('projects program effects into canonical order programs', () => {
    const spec = builder.buildFromSemanticState(baseState({
      rules: [{
        id: 'program-grid',
        phase: 'program',
        sideScope: 'both',
        condition: { kind: 'atom', key: 'execution.on_start', params: {} },
        effects: {
          actions: [],
          risks: [{ kind: 'atom', key: 'risk.stop_loss_pct', params: { pct: 5 } }],
          positions: [{ kind: 'atom', key: 'position.sizing', params: { value: 10, unit: 'USDT' } }],
          orchestration: [{ kind: 'atom', key: 'scope.symbol', params: { symbol: 'BTCUSDT' } }],
          programs: [{ kind: 'atom', key: 'program.fixed_grid', params: { lower: 60000, upper: 80000, stepPct: 0.5 } }],
        },
      }],
    }))

    expect(JSON.stringify(spec)).toContain('program.fixed_grid')
    expect(JSON.stringify(spec)).toContain('rules[0].effects.programs[0]')
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts
```

Expected: fail because canonical builder still reads flat-derived paths or lacks source path.

- [ ] **Step 3: Add rules-only canonical builder path**

In `canonical-spec-builder.service.ts`, add reader and a clear split:

```ts
private readonly rulesMainflowReader = new RulesMainflowReaderService()

buildFromSemanticState(state: SemanticState, fallbackMarket?: unknown): CanonicalStrategySpecV2 {
  const rulesRead = this.rulesMainflowReader.readMainflowRules(state.rules)
  if (!rulesRead.ok) {
    throw new Error(`canonical.rules_mainflow_invalid:${rulesRead.reason}`)
  }
  return this.buildFromRulesMainflowView(state, rulesRead.view, fallbackMarket)
}

private buildFromRulesMainflowView(
  state: SemanticState,
  view: RulesMainflowView,
  fallbackMarket?: unknown,
): CanonicalStrategySpecV2 {
  const market = this.resolveMarketFromRules(view, fallbackMarket)
  const sizing = this.resolveSizingFromRules(view)
  const rules = view.rules.flatMap((rule, ruleIndex) =>
    this.buildCanonicalRulesFromSemanticRule(rule, ruleIndex, view, sizing),
  )

  return {
    version: 2,
    market,
    sizing,
    rules,
    metadata: {
      semanticSource: 'rules-only',
      rulesHash: this.hashJson(view.rules),
    },
  } as CanonicalStrategySpecV2
}
```

Add helpers in the same file using existing canonical types:

```ts
private buildCanonicalRulesFromSemanticRule(
  rule: SemanticRule,
  ruleIndex: number,
  view: RulesMainflowView,
  sizing: CanonicalStrategySpecV2['sizing'],
): CanonicalRuleV2[] {
  const condition = this.compileAtomExprToCanonicalCondition(rule.condition, `rules[${ruleIndex}].condition`)
  const actions = view.byRole.action
    .filter(leaf => leaf.ruleId === rule.id)
    .flatMap(leaf => this.buildActionsForRulesMainflowLeaf(leaf, sizing))
  const riskGuards = view.byRole.risk
    .filter(leaf => leaf.ruleId === rule.id)
    .map(leaf => ({ atomKey: leaf.key, params: leaf.params, sourcePath: leaf.path }))

  return [{
    id: rule.id,
    phase: rule.phase === 'program' ? 'entry' : rule.phase,
    sideScope: rule.sideScope,
    condition,
    actions,
    riskGuards,
    metadata: {
      sourcePath: `rules[${ruleIndex}]`,
      semanticRuleId: rule.id,
    },
  } as CanonicalRuleV2]
}
```

Use existing action mapping helpers where possible. Do not call `readFlatTriggers`, `readFlatActions`, `readFlatRisks`, `state.positionConstraint`, or `state.orchestration` in `buildFromRulesMainflowView`.

- [ ] **Step 4: Add a guard test against flat reader usage in mainflow**

Append:

```ts
it('mainflow builder source does not call flat readers', () => {
  const source = require('node:fs').readFileSync(
    'apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts',
    'utf8',
  )
  const mainflowStart = source.indexOf('buildFromRulesMainflowView')
  const legacyStart = source.indexOf('buildFromLegacyChecklistForTestsOnly')
  const snippet = source.slice(mainflowStart, legacyStart > mainflowStart ? legacyStart : mainflowStart + 5000)

  expect(snippet).not.toContain('readFlatTriggers(')
  expect(snippet).not.toContain('readFlatActions(')
  expect(snippet).not.toContain('readFlatRisks(')
  expect(snippet).not.toContain('state.positionConstraint')
  expect(snippet).not.toContain('state.orchestration')
})
```

- [ ] **Step 5: Run canonical tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.action-atom-key.spec.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts
git commit -F - <<'MSG'
fix(ai-quant): build canonical spec from rules mainflow

Refs: #1632
MSG
```

---

### Task 5: Publication Gate Hash Chain

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/compiled-publication-gate.service.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts`

- [ ] **Step 1: Write failing hash chain tests**

Create:

```ts
import { createHash } from 'node:crypto'
import { CompiledPublicationGateService } from '../compiled-publication-gate.service'

const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')

describe('CompiledPublicationGateService rules-only hash chain', () => {
  const gate = new CompiledPublicationGateService()

  it('passes when canonical, ir, ast, and script all trace to rules hash', () => {
    const rules = [{ id: 'r1', condition: { kind: 'atom', key: 'price.breakout' }, effects: { actions: [], risks: [], positions: [], orchestration: [], programs: [] } }]
    const canonicalSpec = { metadata: { rulesHash: hash(rules) }, rules: [{ metadata: { sourcePath: 'rules[0]' } }] }
    const ir = { metadata: { canonicalSpecHash: hash(canonicalSpec) }, programs: [{ sourcePath: 'rules[0]' }] }
    const ast = { metadata: { irHash: hash(ir) }, body: [{ sourcePath: 'rules[0]' }] }
    const script = `// sourcePath: rules[0]\nexport default {}`

    expect(gate.validateRulesOnlyHashChain({ rules, canonicalSpec, ir, ast, script }).passed).toBe(true)
  })

  it('blocks when IR omits source paths', () => {
    const result = gate.validateRulesOnlyHashChain({
      rules: [{ id: 'r1' }],
      canonicalSpec: { metadata: { rulesHash: 'x' }, rules: [{ metadata: { sourcePath: 'rules[0]' } }] },
      ir: { programs: [{}] },
      ast: {},
      script: 'export default {}',
    })

    expect(result).toMatchObject({
      passed: false,
      blocked: true,
      reason: 'rules_only_trace_missing',
    })
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts
```

Expected: fail because `validateRulesOnlyHashChain` does not exist.

- [ ] **Step 3: Add hash chain validator**

In `compiled-publication-gate.service.ts`:

```ts
import { createHash } from 'node:crypto'

export interface RulesOnlyHashChainInput {
  rules: unknown
  canonicalSpec: unknown
  ir: unknown
  ast: unknown
  script: string
}

export interface RulesOnlyHashChainResult {
  passed: boolean
  blocked: boolean
  reason?: string
  hashes: {
    rulesHash: string
    canonicalSpecHash: string
    irHash: string
    astHash: string
    scriptHash: string
  }
  checks: Array<{ key: string; status: 'passed' | 'failed'; message: string }>
}

validateRulesOnlyHashChain(input: RulesOnlyHashChainInput): RulesOnlyHashChainResult {
  const hashes = {
    rulesHash: this.hashJson(input.rules),
    canonicalSpecHash: this.hashJson(input.canonicalSpec),
    irHash: this.hashJson(input.ir),
    astHash: this.hashJson(input.ast),
    scriptHash: createHash('sha256').update(input.script).digest('hex'),
  }

  const checks = [
    this.checkContainsSourcePath('canonicalSpec', input.canonicalSpec),
    this.checkContainsSourcePath('ir', input.ir),
    this.checkContainsSourcePath('ast', input.ast),
    {
      key: 'script.sourcePath',
      status: input.script.includes('sourcePath: rules[') ? 'passed' as const : 'failed' as const,
      message: input.script.includes('sourcePath: rules[') ? 'script traces to rules path' : 'script does not trace to rules path',
    },
  ]
  const failed = checks.filter(check => check.status === 'failed')

  return {
    passed: failed.length === 0,
    blocked: failed.length > 0,
    ...(failed.length > 0 ? { reason: 'rules_only_trace_missing' } : {}),
    hashes,
    checks,
  }
}

private hashJson(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

private checkContainsSourcePath(key: string, value: unknown): { key: string; status: 'passed' | 'failed'; message: string } {
  const text = JSON.stringify(value)
  const ok = text.includes('rules[')
  return {
    key: `${key}.sourcePath`,
    status: ok ? 'passed' : 'failed',
    message: ok ? `${key} traces to rules path` : `${key} does not trace to rules path`,
  }
}
```

- [ ] **Step 4: Persist hash chain from publication generation**

In `codegen-publication-generation.stage.ts`, after `ast` and `compiledScript` are available:

```ts
const rulesOnlyHashChain = this.compiledPublicationGate?.validateRulesOnlyHashChain?.({
  rules: input.semanticState.rules,
  canonicalSpec,
  ir: compiled.ir,
  ast,
  script: compiledScript,
})

if (rulesOnlyHashChain && !rulesOnlyHashChain.passed) {
  const error = new Error(`publication.rules_only_trace_missing: ${rulesOnlyHashChain.checks.filter(check => check.status === 'failed').map(check => check.message).join('; ')}`)
  ;(error as { publicationGate?: unknown }).publicationGate = rulesOnlyHashChain
  throw error
}
```

Include `rulesOnlyHashChain` in `sessionSpecDesc`:

```ts
rulesOnlyHashChain,
```

- [ ] **Step 5: Run publication tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/compiled-publication-gate.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts
git commit -F - <<'MSG'
fix(ai-quant): gate publication with rules hash chain

Refs: #1632
MSG
```

---

### Task 6: Backtest, Deploy Payload, Runtime Execution Snapshot Truth

**Files:**
- Modify: `apps/quantify/src/modules/backtesting/services/backtest-strategy-adapter.service.ts`
- Modify: `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/services/strategy-runtime-execution-state.service.ts`
- Create: `apps/quantify/src/modules/account-strategy-view/services/__tests__/account-strategy-view-deploy-rules-only.spec.ts`

- [ ] **Step 1: Write failing deploy snapshot truth tests**

Create:

```ts
import { DeploySnapshotRequiresRepublishException } from '../../exceptions'
import { AccountStrategyViewService } from '../account-strategy-view.service'

describe('AccountStrategyViewService deploy rules-only snapshot truth', () => {
  it('requires republish when snapshot lacks rules-only compiled truth', async () => {
    const repo = {
      findDeployRequestByUserAndRequestId: jest.fn().mockResolvedValue(null),
      createDeployRequestProcessing: jest.fn().mockResolvedValue({ id: 'deploy-request-1' }),
      markDeployRequestFailed: jest.fn(),
    }
    const snapshots = {
      findByIdForUser: jest.fn().mockResolvedValue({
        id: 'snapshot-1',
        snapshotHash: 'hash-1',
        strategyConfig: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', marketType: 'perp', positionPct: 10 },
        deploymentExecutionDefaults: { leverage: 1 },
        deploymentExecutionConstraints: { minLeverage: 1, maxLeverage: 5, defaultLeverage: 1 },
        canonicalSnapshot: null,
        irSnapshot: null,
        astSnapshot: null,
        script: null,
      }),
    }

    const service = new AccountStrategyViewService(
      repo as never,
      {} as never,
      {} as never,
      { ensureSymbolsSubscribed: jest.fn() } as never,
      undefined,
      undefined,
      undefined,
      snapshots as never,
      { buildExecutionSemanticKeysFromSnapshot: jest.fn(() => []) } as never,
    )

    await expect(service.deployStrategy({
      userId: 'user-1',
      name: 'strategy',
      deployRequestId: 'deploy-1',
      publishedSnapshotId: 'snapshot-1',
    } as never)).rejects.toBeInstanceOf(DeploySnapshotRequiresRepublishException)
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/account-strategy-view/services/__tests__/account-strategy-view-deploy-rules-only.spec.ts
```

Expected: fail because deploy accepts snapshots without all rules-only bindings or test constructor mocks need adjustment.

- [ ] **Step 3: Add snapshot truth guard**

In `account-strategy-view.service.ts`, add:

```ts
private assertRulesOnlyDeployableSnapshot(snapshot: unknown): void {
  const record = this.readRecord(snapshot)
  const canonical = this.readRecord(record?.canonicalSnapshot)
  const ir = this.readRecord(record?.irSnapshot)
  const ast = this.readRecord(record?.astSnapshot)
  const script = typeof record?.script === 'string' && record.script.trim().length > 0
  const hashChain = this.readRecord(record?.rulesOnlyHashChain)

  if (!canonical || !ir || !ast || !script || !hashChain) {
    throw new DeploySnapshotRequiresRepublishException({
      publishedSnapshotId: typeof record?.id === 'string' ? record.id : 'unknown',
    })
  }
}
```

Call it in `resolveDeployPayload` immediately after snapshot load:

```ts
this.assertRulesOnlyDeployableSnapshot(snapshot)
```

- [ ] **Step 4: Make runtime execution keys use snapshot IR/AST**

In `strategy-runtime-execution-state.service.ts`, ensure `buildExecutionSemanticKeysFromSnapshot` reads only compiled snapshot fields:

```ts
buildExecutionSemanticKeysFromSnapshot(snapshot: unknown): string[] {
  const record = this.readRecord(snapshot)
  const ir = this.readRecord(record?.irSnapshot)
  const ast = this.readRecord(record?.astSnapshot)
  const keys = new Set<string>()

  this.collectSourceKeys(ir, keys)
  this.collectSourceKeys(ast, keys)

  return Array.from(keys).sort()
}

private collectSourceKeys(value: unknown, keys: Set<string>): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) this.collectSourceKeys(item, keys)
    return
  }
  const record = value as Record<string, unknown>
  if (typeof record.sourcePath === 'string' && record.sourcePath.startsWith('rules[')) {
    keys.add(record.sourcePath)
  }
  for (const child of Object.values(record)) this.collectSourceKeys(child, keys)
}
```

- [ ] **Step 5: Guard backtest adapter from flat/display/specDesc fallback**

In `backtest-strategy-adapter.service.ts`, add a local assertion at adapter entry:

```ts
private assertBacktestUsesRulesOnlyTruth(input: { canonicalSpec?: unknown; ir?: unknown }): void {
  if (!input.canonicalSpec || !input.ir) {
    throw new Error('backtest.rules_only_truth_required')
  }
  const canonicalText = JSON.stringify(input.canonicalSpec)
  const irText = JSON.stringify(input.ir)
  if (!canonicalText.includes('rules[') || !irText.includes('rules[')) {
    throw new Error('backtest.rules_only_trace_missing')
  }
}
```

Call it before any adapter path that creates executable backtest logic.

- [ ] **Step 6: Run deploy/backtest/runtime tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/account-strategy-view/services/__tests__/account-strategy-view-deploy-rules-only.spec.ts apps/quantify/src/modules/strategy-signals/services/__tests__/strategy-runtime-execution-state.service.spec.ts apps/quantify/src/modules/backtesting/services/backtest-strategy-adapter.service.spec.ts
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add apps/quantify/src/modules/backtesting/services/backtest-strategy-adapter.service.ts apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts apps/quantify/src/modules/strategy-signals/services/strategy-runtime-execution-state.service.ts apps/quantify/src/modules/account-strategy-view/services/__tests__/account-strategy-view-deploy-rules-only.spec.ts
git commit -F - <<'MSG'
fix(ai-quant): require rules snapshot truth for backtest and deploy

Refs: #1632
MSG
```

---

### Task 7: PM2 Staging 30 Strategy Evidence Runner

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/scripts/staging30-rules-only-mainflow-cases.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/scripts/staging30-rules-only-mainflow-report.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/scripts/__tests__/staging30-rules-only-mainflow-report.spec.ts`

- [ ] **Step 1: Add 30 staging cases**

Create `staging30-rules-only-mainflow-cases.ts`:

```ts
export interface Staging30RulesOnlyCase {
  id: string
  title: string
  prompt: string
}

export const STAGING30_RULES_ONLY_CASES: readonly Staging30RulesOnlyCase[] = [
  { id: 's01', title: 'ema trend long', prompt: '入场：15m k线里面价格在 ema20 ema60 ema144 上方时做多开仓；出场：15m k线里面价格低于 ema20 时平多；止损：5%；仓位：10usdt。' },
  { id: 's02', title: 'ema boll both sides', prompt: '15min k线里面价格在 ema20 ema60 ema144 上方时做多开仓，都位于下方只开空；入场是 boll 下轨开多，上轨开空；币安的 btcusdt 永续合约；风控是亏损 5% 止损。' },
  { id: 's03', title: 'okx btc drop rise', prompt: '在 okx 交易所，我想买 btc，3 分钟之内跌 1% 买入，15 分钟之内涨 2% 卖出，单笔用 10% 资金，止损 5%，止盈 10%。' },
  { id: 's04', title: 'boll middle exit', prompt: 'OKX 合约 BTCUSDT 15m，价格触及/突破布林带(20,2)上轨时做空，触及/突破下轨时做多；多单在价格回到布林带中轨(MA20)时平仓，空单在价格跌破布林带中轨(MA20)时平仓；单笔仓位 10%。' },
  { id: 's05', title: 'range grid', prompt: '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈。' },
  { id: 's06', title: 'spot ord purchase', prompt: '在 OKX 现货 ORDI/USDT 上，主周期 1h，使用 10% 固定仓位只做多；入场动作为立即开始时市价买入；出场规则为价格相对前收盘上涨 1% 时卖出，另有相对入场均价下跌 5% 止损卖出、相对入场均价上涨 10% 止盈卖出。' },
  { id: 's07', title: 'boll scalping', prompt: 'OKX 合约 BTCUSDT 1m，使用布林带 5,1。价格触及或突破上轨时做空，价格触及或突破下轨时做多；多单在价格回到中轨时平仓，空单在价格回到中轨时平仓；单笔仓位 10%，止损 1%，止盈 1.5%。' },
  { id: 's08', title: 'green candle long', prompt: '用 BTCUSDT 1m K 线。每次最新 K 线收盘价高于开盘价时尝试开多。如果已有持仓则不再开仓。收盘价低于开盘价时平多。' },
  { id: 's09', title: 'spot grid stop', prompt: 'OKX 现货 ETHUSDT、1m 网格以部署时当前价为中心，上下各 0.4% 共 10 格、每格 10 USDT、限价单并相邻网格自动挂反向单、不用趋势信号开仓；当价格突破上下边界时执行“立即停止并撤销所有未成交订单”。' },
  { id: 's10', title: 'tight grid', prompt: '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 79200-80200，采用双向网格，每格间距 0.1%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈。' },
  { id: 's11', title: 'ema cross cross margin', prompt: '创建一个 OKX BTCUSDT 永续合约策略，使用 15 分钟 K 线。当 EMA7 上穿 EMA21 时开多；当 EMA7 下穿 EMA21 时平多。每次使用账户权益的 10% 开仓，杠杆 1 倍，逐仓不要使用，使用全仓 cross。' },
  { id: 's12', title: 'boll lower upper', prompt: '15min 布林带下轨买入，上轨卖出。' },
  { id: 's13', title: 'ema cross simple', prompt: 'EMA7 上穿 EMA21 时开多；下穿时平多。' },
  { id: 's14', title: 'macd cross', prompt: 'OKX 上用 BTC/USDT，1 小时 K，MACD 金叉买入死叉卖出。' },
  { id: 's15', title: 'simple grid', prompt: '15m 周期，价格区间 79200-80200，采用双向网格。' },
  { id: 's16', title: 'breakout channel', prompt: 'BTC 4小时突破过去 20 根 K 线最高价做多，跌破过去 10 根 K 线最低价平仓。' },
  { id: 's17', title: 'daily ma regime', prompt: 'ETH 日线在 MA120 上方时，只做多；价格回踩 MA20 后重新站上 MA20 买入，ETH 日线在 MA120 下方时平仓。' },
  { id: 's18', title: 'three red reversal', prompt: 'BTC 连续跌三根 15 分钟 K 线后，如果下一根开始放量反弹就买一点。' },
  { id: 's19', title: 'ma rsi regime', prompt: 'BTC 1小时 MA50 在 MA200 上方时，只在 RSI 跌破 35 后重新上穿 35 买入，RSI 超过 65 卖出。' },
  { id: 's20', title: 'boll volume', prompt: 'ETH 15分钟触碰布林带下轨，并且成交量高于过去 20 根均量的 1.5 倍时买入，上轨卖出。' },
  { id: 's21', title: 'sol ma macd', prompt: 'SOL 30分钟价格在 MA100 上方，MACD 金叉买入；跌破 MA100 或 MACD 死叉卖出。' },
  { id: 's22', title: 'breakout retest', prompt: 'BTC 突破过去 24 小时高点后不立刻买，等回踩不破突破位再买，跌回突破位下方止损。' },
  { id: 's23', title: 'atr stop take profit', prompt: 'ETH 1小时突破 MA20 买入，止损设为 2 倍 ATR，盈利达到 3 倍 ATR 后止盈。' },
  { id: 's24', title: 'multi timeframe ema', prompt: '15min 1h 4h 的价格都在 ema20 的上方买入，15min 跌破 ema20 卖出，在币安交易所 btcusdt 永续合约。' },
  { id: 's25', title: 'webhook whale buy', prompt: 'OKX 合约 BTCUSDT 15m，收到 webhook 事件 signalId 为 whale_buy 且 secret 已配置时开多，每次 100。' },
  { id: 's26', title: 'rsi stop', prompt: 'BTC/USDT 4h，RSI 跌破 30 开多，RSI 回到 70 平仓，止损 2%。' },
  { id: 's27', title: 'boll long short', prompt: 'ETH 1h，价格触及布林下轨开多，回到中轨止盈，触及上轨开空。' },
  { id: 's28', title: 'drawdown breaker', prompt: 'SOL 1d，EMA20 上穿 EMA60 开多，下穿平仓，最大回撤 15% 熔断。' },
  { id: 's29', title: 'add position ladder', prompt: 'BTC 1h 突破前高开多，盈利 3% 后加仓 50%，最多加 3 层。' },
  { id: 's30', title: 'daily dca', prompt: 'ETH 现货每天定投 100 USDT，回撤 5% 加投 200 USDT。' },
]
```

- [ ] **Step 2: Write failing report contract test**

Create `staging30-rules-only-mainflow-report.spec.ts`:

```ts
import { buildStaging30EvidenceSummary } from '../staging30-rules-only-mainflow-report'

describe('staging30 rules-only mainflow report', () => {
  it('fails a case when flat fallback is observed', () => {
    const summary = buildStaging30EvidenceSummary([{
      caseId: 's01',
      status: 'failed',
      hashes: null,
      usedFlatFallback: true,
      steps: [],
      failureReason: 'flat fallback observed',
    }])

    expect(summary.passed).toBe(false)
    expect(summary.failedCaseIds).toEqual(['s01'])
    expect(summary.failures[0]).toContain('flat fallback observed')
  })
})
```

- [ ] **Step 3: Create report script contract**

Create `staging30-rules-only-mainflow-report.ts`:

```ts
import { STAGING30_RULES_ONLY_CASES } from './staging30-rules-only-mainflow-cases'

export interface Staging30EvidenceHashes {
  rulesHash: string
  canonicalSpecHash: string
  irHash: string
  astHash: string
  scriptHash: string
  runtimeEvaluatorVersion: string
}

export interface Staging30CaseEvidence {
  caseId: string
  status: 'passed' | 'failed'
  hashes: Staging30EvidenceHashes | null
  usedFlatFallback: boolean
  steps: string[]
  failureReason: string | null
}

export interface Staging30EvidenceSummary {
  passed: boolean
  total: number
  passedCount: number
  failedCaseIds: string[]
  failures: string[]
}

export function buildStaging30EvidenceSummary(cases: readonly Staging30CaseEvidence[]): Staging30EvidenceSummary {
  const failures = cases
    .filter(item => item.status !== 'passed' || item.usedFlatFallback || !item.hashes)
    .map(item => `${item.caseId}: ${item.failureReason ?? (item.usedFlatFallback ? 'flat fallback observed' : 'hashes missing')}`)

  return {
    passed: failures.length === 0 && cases.length === STAGING30_RULES_ONLY_CASES.length,
    total: cases.length,
    passedCount: cases.length - failures.length,
    failedCaseIds: cases.filter(item => item.status !== 'passed' || item.usedFlatFallback || !item.hashes).map(item => item.caseId),
    failures,
  }
}

async function postJson<T>(apiBaseUrl: string, authToken: string, path: string, body: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${authToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${path}: ${await response.text()}`)
  }
  return await response.json() as T
}

async function getJson<T>(apiBaseUrl: string, authToken: string, path: string): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${authToken}` },
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${path}: ${await response.text()}`)
  }
  return await response.json() as T
}

async function runCase(apiBaseUrl: string, authToken: string, item: Staging30RulesOnlyCase): Promise<Staging30CaseEvidence> {
  const session = await postJson<{ id: string; rulesOnlyHashChain?: unknown }>(apiBaseUrl, authToken, '/llm-strategy-codegen/sessions', {
    initialMessage: item.prompt,
    locale: 'zh',
  })
  const confirmation = await postJson<{ publishedSnapshotId?: string; rulesOnlyHashChain?: Staging30EvidenceHashes }>(
    apiBaseUrl,
    authToken,
    `/llm-strategy-codegen/sessions/${session.id}/messages`,
    { message: '确认，生成脚本并发布。', confirmGenerate: true, locale: 'zh' },
  )
  const hashes = confirmation.rulesOnlyHashChain ?? null
  return {
    caseId: item.id,
    status: hashes ? 'passed' : 'failed',
    hashes,
    usedFlatFallback: JSON.stringify(confirmation).includes('flatFallback'),
    steps: ['session', 'confirmGenerate', 'publish'],
    failureReason: hashes ? null : 'rulesOnlyHashChain missing',
  }
}

async function runAllCases(apiBaseUrl: string, authToken: string): Promise<Staging30EvidenceSummary> {
  const evidence: Staging30CaseEvidence[] = []
  for (const item of STAGING30_RULES_ONLY_CASES) {
    try {
      evidence.push(await runCase(apiBaseUrl, authToken, item))
    } catch (error) {
      evidence.push({
        caseId: item.id,
        status: 'failed',
        hashes: null,
        usedFlatFallback: false,
        steps: ['session'],
        failureReason: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return buildStaging30EvidenceSummary(evidence)
}

if (require.main === module) {
  const apiBaseUrl = process.env.QUANTIFY_STAGING_API_BASE_URL?.trim()
  const authToken = process.env.QUANTIFY_STAGING_AUTH_TOKEN?.trim()
  if (!apiBaseUrl || !authToken) {
    console.error(JSON.stringify({
      passed: false,
      reason: 'staging_env_missing',
      requiredEnv: ['QUANTIFY_STAGING_API_BASE_URL', 'QUANTIFY_STAGING_AUTH_TOKEN'],
    }, null, 2))
    process.exit(1)
  }

  runAllCases(apiBaseUrl, authToken)
    .then((summary) => {
      console.log(JSON.stringify(summary, null, 2))
      process.exit(summary.passed ? 0 : 1)
    })
    .catch((error) => {
      console.error(JSON.stringify({
        passed: false,
        reason: error instanceof Error ? error.message : String(error),
      }, null, 2))
      process.exit(1)
    })
}
```

- [ ] **Step 4: Run report tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/scripts/__tests__/staging30-rules-only-mainflow-report.spec.ts
```

Expected: pass.

- [ ] **Step 5: Add PM2 staging execution instructions to PR notes file**

Create `tmp/rules-only-stage2-staging-command.md` using `apply_patch`:

```md
# Rules-Only Stage 2 PM2 Staging Command

Run after deploying this branch to staging PM2:

```bash
dx start stack
dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen/codegen-to-deploy-pipeline.e2e-spec.ts
node dist/apps/quantify/src/modules/llm-strategy-codegen/scripts/staging30-rules-only-mainflow-report.js
```

Acceptance:

- 30/30 cases start from new sessions.
- 0 cases use old session migration.
- 0 cases use flat fallback.
- Each case records rulesHash, canonicalSpecHash, irHash, astHash, scriptHash, runtimeEvaluatorVersion.
```

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/scripts/staging30-rules-only-mainflow-cases.ts apps/quantify/src/modules/llm-strategy-codegen/scripts/staging30-rules-only-mainflow-report.ts apps/quantify/src/modules/llm-strategy-codegen/scripts/__tests__/staging30-rules-only-mainflow-report.spec.ts tmp/rules-only-stage2-staging-command.md
git commit -F - <<'MSG'
test(ai-quant): add staging rules-only mainflow evidence runner

Refs: #1632
MSG
```

---

### Task 8: Whole-Stage Guards And Verification

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-only-mainflow-source-guard.spec.ts` (create)
- Modify: files touched by previous tasks only if source guard exposes mainflow flat reader leakage.

- [ ] **Step 1: Add source guard test**

Create:

```ts
import { readFileSync } from 'node:fs'

const guardedFiles = [
  'apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts',
  'apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts',
  'apps/quantify/src/modules/backtesting/services/backtest-strategy-adapter.service.ts',
  'apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts',
]

describe('rules-only mainflow source guard', () => {
  it.each(guardedFiles)('%s keeps flat readers out of rules-only mainflow blocks', (file) => {
    const source = readFileSync(file, 'utf8')
    const guardedBlocks = source
      .split('\n')
      .filter(line => line.includes('RulesOnly') || line.includes('rules-only') || line.includes('RulesMainflow') || line.includes('buildFromRulesMainflowView'))
      .join('\n')

    expect(guardedBlocks).not.toContain('readFlatTriggers(')
    expect(guardedBlocks).not.toContain('readFlatActions(')
    expect(guardedBlocks).not.toContain('readFlatRisks(')
    expect(guardedBlocks).not.toContain('state.positionConstraint')
    expect(guardedBlocks).not.toContain('state.orchestration')
  })
})
```

- [ ] **Step 2: Run source guard**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-only-mainflow-source-guard.spec.ts
```

Expected: pass.

- [ ] **Step 3: Run focused Stage 2 unit suite**

Run:

```bash
dx test unit quantify \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-mainflow-reader.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-rules-only-mainflow.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts \
  apps/quantify/src/modules/account-strategy-view/services/__tests__/account-strategy-view-deploy-rules-only.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/scripts/__tests__/staging30-rules-only-mainflow-report.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-only-mainflow-source-guard.spec.ts
```

Expected: pass.

- [ ] **Step 4: Run broader affected tests**

Run:

```bash
dx test unit quantify
```

Expected: pass.

- [ ] **Step 5: Build quantify**

Run:

```bash
dx build quantify --dev
```

Expected: exit 0.

- [ ] **Step 6: Run targeted E2E**

Run:

```bash
dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen/codegen-to-deploy-pipeline.e2e-spec.ts
```

Expected: pass. If environment credentials are missing, record exact missing env key and run the closest unit suite from Step 3.

- [ ] **Step 7: Commit final guards**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/rules-only-mainflow-source-guard.spec.ts
git commit -F - <<'MSG'
test(ai-quant): guard rules-only mainflow boundaries

Refs: #1632
MSG
```

---

## PR Acceptance Checklist

- [ ] Issue #1632 acceptance criteria are copied into PR body with evidence for each item.
- [ ] PR body explains that Stage 2 does not delete flat bucket compatibility code; Stage 3 owns deletion.
- [ ] PR body includes PM2 staging steps and output location.
- [ ] PR body lists 30 staging cases and states each started from a new session.
- [ ] PR body includes hash evidence: `rulesHash / canonicalSpecHash / irHash / astHash / scriptHash / runtimeEvaluatorVersion`.
- [ ] PR body states that no old session migration, compatibility adapter, flat projection semantic fallback, display fallback, or manual DB patch was used.
- [ ] `dx lint` passes.
- [ ] `dx build quantify --dev` passes.
- [ ] Focused Stage 2 unit suite passes.
- [ ] Targeted quantify E2E passes or exact environment blocker is documented.
