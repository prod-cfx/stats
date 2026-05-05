# AI Quant Universal Atomic Semantic Mainflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove residual strategy-family, legacy checklist, and compileability authority from the AI Quant main semantic flow so every strategy expression moves through `triggers/actions/risk/position/contextSlots`, contracts, and `openSlots`.

**Architecture:** Mainline conversation authority becomes semantic-state only: seed extraction emits atomic patches, contract readiness creates owner open slots, clarification ranks those slots, and confirm/generate never asks legacy compileability questions. Checklist, family labels, and legacy compileability remain only in explicitly named compatibility or internal diagnostic code paths.

**Tech Stack:** NestJS service code in `apps/quantify`, TypeScript, Jest unit tests, existing semantic state and contract services.

---

## File Structure

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-clarification-metadata.ts`
  - Owns mapping from semantic slot keys to clarification item metadata. It must stop mapping semantic slots to checklist fields such as `entryRules`, `exitRules`, or `riskRules.positionPct`.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts`
  - Keeps execution-context and atomic ambiguity clarification in mainline. Moves checklist-era detection behind explicit compatibility naming.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
  - Generalizes indicator/boundary wording into atomic trigger/action contracts without strategy-family gating.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
  - Removes strategy family and compileability as mainline authority. Keeps compileability as internal diagnostic after atomic readiness.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
  - Keeps family metadata as routing/display only. Any projection miss must not become user clarification.
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-clarification-metadata.spec.ts`
  - New focused test for semantic slot metadata.
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`
  - Adds cross-expression atomic extraction matrix.
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts`
  - Adds mainline versus compatibility assertions.
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
  - Adds screenshot flow and negative legacy authority assertions.
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/mainflow-legacy-authority.spec.ts`
  - New source-level guardrail test that inventories forbidden mainline old-authority patterns.

## Task 1: Add Legacy Authority Guardrail Test

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/mainflow-legacy-authority.spec.ts`

- [ ] **Step 1: Write the failing source-level guardrail test**

Create `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/mainflow-legacy-authority.spec.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '..')

function readService(relativePath: string): string {
  return readFileSync(join(root, relativePath), 'utf8')
}

describe('AI Quant mainflow legacy authority guardrail', () => {
  it('keeps semantic clarification metadata away from checklist fields and reasons', () => {
    const source = readService('semantic-clarification-metadata.ts')

    expect(source).not.toContain("reason: 'missing_position_pct'")
    expect(source).not.toContain("reason: 'missing_entry_rules'")
    expect(source).not.toContain("reason: 'missing_exit_rules'")
    expect(source).not.toContain("field: 'riskRules.positionPct'")
    expect(source).not.toContain("field: 'entryRules'")
    expect(source).not.toContain("field: 'exitRules'")
  })

  it('does not use semanticState.families as mainflow evidence', () => {
    const source = readService('codegen-conversation.service.ts')

    expect(source).not.toContain('state.families.length > 0')
    expect(source).not.toContain('hasSemanticMainFlowEvidence(state: SemanticState): boolean {\n    return state.families.length > 0')
  })

  it('does not expose canonical compileability wording as user-facing clarification', () => {
    const source = readService('codegen-conversation.service.ts')

    expect(source).not.toContain("reasons.push('未识别可编译入场规则')")
    expect(source).not.toContain("reasons.push('未识别可编译出场规则')")
    expect(source).not.toContain('buildCanonicalProjectionFailureAssistantPrompt(compileability)')
  })
})
```

- [ ] **Step 2: Run the guardrail test and verify it fails**

Run:

```bash
pnpm --dir apps/quantify exec jest --config ./jest-unit.json --runInBand src/modules/llm-strategy-codegen/services/__tests__/mainflow-legacy-authority.spec.ts
```

Expected: FAIL. At least the metadata test should find `missing_position_pct`, `missing_entry_rules`, or checklist fields.

- [ ] **Step 3: Commit the failing test**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/mainflow-legacy-authority.spec.ts
git commit -F - <<'MSG'
test: guard ai quant mainflow against legacy authority

变更说明：
- 增加主流程旧 authority 残留的源代码级负向测试。
- 锁定 semantic slot metadata、families evidence、compileability 文案不能作为主流程 authority。

Refs: #960
MSG
```

## Task 2: Make Semantic Clarification Metadata Atom-Native

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-clarification-metadata.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-clarification-metadata.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts`

- [ ] **Step 1: Write metadata tests for semantic reasons and fields**

Create `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-clarification-metadata.spec.ts`:

```ts
import { resolveSemanticClarificationMetadata } from '../semantic-clarification-metadata'

describe('resolveSemanticClarificationMetadata', () => {
  it('maps position sizing to semantic position metadata instead of checklist riskRules', () => {
    expect(resolveSemanticClarificationMetadata('position.sizing')).toEqual({
      reason: 'missing_semantic_position_sizing',
      field: 'position.sizing',
    })
  })

  it('maps trigger slots to semantic trigger fields instead of entryRules or exitRules', () => {
    expect(resolveSemanticClarificationMetadata('trigger.entry')).toEqual({
      reason: 'missing_semantic_trigger',
      field: 'triggers',
    })
    expect(resolveSemanticClarificationMetadata('trigger.exit')).toEqual({
      reason: 'missing_semantic_trigger',
      field: 'triggers',
    })
  })

  it('maps risk slots to semantic risk fields instead of checklist riskRules', () => {
    expect(resolveSemanticClarificationMetadata('risk.protective_exit')).toEqual({
      reason: 'missing_semantic_risk',
      field: 'risk',
    })
  })
})
```

- [ ] **Step 2: Run metadata tests and verify they fail**

Run:

```bash
pnpm --dir apps/quantify exec jest --config ./jest-unit.json --runInBand src/modules/llm-strategy-codegen/services/__tests__/semantic-clarification-metadata.spec.ts
```

Expected: FAIL because current metadata returns checklist-era reasons and fields.

- [ ] **Step 3: Update semantic metadata mapping**

Replace `resolveSemanticClarificationMetadata()` in `semantic-clarification-metadata.ts` with:

```ts
import type { StrategyClarificationItem } from '../types/strategy-clarification'

export function resolveSemanticClarificationMetadata(
  slotKey: string,
): Pick<StrategyClarificationItem, 'reason' | 'field'> {
  if (slotKey === 'position.sizing') {
    return {
      reason: 'missing_semantic_position_sizing',
      field: 'position.sizing',
    }
  }

  if (slotKey === 'position.mode' || slotKey === 'exposure.position_mode') {
    return {
      reason: 'missing_semantic_position_mode',
      field: 'position.positionMode',
    }
  }

  if (slotKey === 'risk.protective_exit' || slotKey.startsWith('risk.')) {
    return {
      reason: 'missing_semantic_risk',
      field: 'risk',
    }
  }

  if (slotKey === 'grid.sideMode' || slotKey.startsWith('action.') || slotKey.includes('order.intent')) {
    return {
      reason: 'missing_semantic_action',
      field: 'actions',
    }
  }

  if (slotKey.startsWith('grid.')) {
    return {
      reason: 'missing_semantic_contract_requirement',
      field: slotKey,
    }
  }

  if (slotKey.startsWith('contract.requirement.')) {
    return {
      reason: 'missing_semantic_contract_requirement',
      field: slotKey,
    }
  }

  return {
    reason: 'missing_semantic_trigger',
    field: 'triggers',
  }
}
```

- [ ] **Step 4: Extend clarification reason type**

Modify `apps/quantify/src/modules/llm-strategy-codegen/types/strategy-clarification.ts` so the reason union includes:

```ts
| 'missing_semantic_trigger'
| 'missing_semantic_action'
| 'missing_semantic_risk'
| 'missing_semantic_position_sizing'
| 'missing_semantic_position_mode'
| 'missing_semantic_contract_requirement'
```

If `StrategyClarificationItem['reason']` is currently defined through a string union, add the literals to that union. If it is already `string`, no change is needed.

- [ ] **Step 5: Update reason priority mapping**

In `StrategyClarificationRulesService.readReasonPriority()`, add this block before the final return:

```ts
if (
  reason === 'missing_semantic_trigger'
  || reason === 'missing_semantic_action'
  || reason === 'missing_semantic_contract_requirement'
) return 90
if (
  reason === 'missing_semantic_position_sizing'
  || reason === 'missing_semantic_position_mode'
  || reason === 'missing_semantic_risk'
) return 70
```

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm --dir apps/quantify exec jest --config ./jest-unit.json --runInBand src/modules/llm-strategy-codegen/services/__tests__/semantic-clarification-metadata.spec.ts src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts src/modules/llm-strategy-codegen/services/__tests__/mainflow-legacy-authority.spec.ts
```

Expected: PASS for metadata and clarification tests. The guardrail may still fail on conversation compileability until later tasks.

- [ ] **Step 7: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-clarification-metadata.ts apps/quantify/src/modules/llm-strategy-codegen/types/strategy-clarification.ts apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-clarification-metadata.spec.ts
git commit -F - <<'MSG'
fix: make semantic clarification metadata atom native

变更说明：
- 将 semantic openSlot metadata 从 checklist 字段改为 atom 字段。
- 增加 semantic trigger/action/risk/position/contract 缺项原因。
- 调整澄清优先级以使用 semantic 原因。

Refs: #960
MSG
```

## Task 3: Generalize Entry Extraction Around Atomic Boundary Semantics

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`

- [ ] **Step 1: Add cross-expression extraction matrix tests**

Append to `semantic-seed-extractor.service.spec.ts`:

```ts
it.each([
  ['15min 布林线下轨买入 上轨卖出', ['bollinger', 'lower', 'upper']],
  ['15min 布林带下轨做多 上轨平多', ['bollinger', 'lower', 'upper']],
  ['价格碰通道下沿买，上沿卖', ['channel', 'lower', 'upper']],
  ['突破上边界开空，回到中线平仓', ['generic_boundary', 'upper', 'middle']],
  ['RSI 低于30买入，高于70卖出', ['rsi', 'lower_threshold', 'upper_threshold']],
  ['均线金叉买入，死叉卖出', ['moving_average', 'cross_up', 'cross_down']],
  ['前高突破买入，跌破前低卖出', ['previous_extrema', 'previous_high', 'previous_low']],
  ['上涨2%开多，回撤1%平仓', ['percent_change', 'up', 'drawdown']],
])('extracts atomic semantics for %s', (message, expectedTokens) => {
  const patch = service.extract(message)
  const executableNodes = [
    ...(patch.triggers ?? []),
    ...(patch.actions ?? []),
    ...(patch.risk ?? []),
    ...(patch.position ? [patch.position] : []),
  ]
  const serialized = JSON.stringify(executableNodes)

  expect(executableNodes.length).toBeGreaterThan(0)
  for (const token of expectedTokens) {
    expect(serialized).toContain(token)
  }
  for (const node of executableNodes) {
    expect(node.contracts?.length ?? 0).toBeGreaterThan(0)
  }
})
```

- [ ] **Step 2: Run extraction matrix and verify it fails**

Run:

```bash
pnpm --dir apps/quantify exec jest --config ./jest-unit.json --runInBand src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
```

Expected: FAIL for at least `布林线`, `通道下沿`, or generic boundary wording.

- [ ] **Step 3: Add generic indicator boundary helpers**

In `SemanticSeedExtractorService`, add these helpers near the existing Bollinger helpers:

```ts
private hasIndicatorBoundaryLanguage(segment: string): boolean {
  return /布林线|布林带|bollinger|通道|channel|上轨|下轨|中轨|上沿|下沿|中线|上边界|下边界|边界/iu.test(segment)
}

private resolveIndicatorName(segment: string): 'bollinger' | 'channel' | 'generic_boundary' {
  if (/布林线|布林带|bollinger/iu.test(segment)) return 'bollinger'
  if (/通道|channel/iu.test(segment)) return 'channel'
  return 'generic_boundary'
}

private resolveBoundaryRole(clause: string): 'upper' | 'lower' | 'middle' | null {
  if (/上轨|上沿|上边界|upper/iu.test(clause)) return 'upper'
  if (/下轨|下沿|下边界|lower/iu.test(clause)) return 'lower'
  if (/中轨|中线|middle|midline/iu.test(clause)) return 'middle'
  return null
}
```

- [ ] **Step 4: Add generic boundary trigger extraction**

Call `this.pushIndicatorBoundaryTriggers(segment, triggers, seen, aliasContext)` inside `extractTriggers()` immediately after `this.pushBollingerTriggers(...)`.

Add this method:

```ts
private pushIndicatorBoundaryTriggers(
  segment: string,
  triggers: SeedTrigger[],
  seen: Set<string>,
  aliasContext: SemanticAliasContext,
): void {
  if (!this.hasIndicatorBoundaryLanguage(segment)) return

  const indicatorName = this.resolveIndicatorName(segment)
  const bandParams = indicatorName === 'bollinger'
    ? this.extractBollingerBandParams(segment) ?? aliasContext.bollingerBandParams
    : null

  for (const clause of this.splitCommaClauses(segment)) {
    const boundaryRole = this.resolveBoundaryRole(clause)
    if (!boundaryRole) continue

    const intent = this.resolveTradeIntent(clause)
    const phase = intent?.phase ?? (boundaryRole === 'middle' ? 'exit' : 'entry')
    const sideScope = intent?.sideScope
      ?? (boundaryRole === 'upper'
          ? 'short'
          : boundaryRole === 'lower'
            ? 'long'
            : 'both')

    this.pushTrigger(triggers, seen, {
      key: 'price.detect.indicator_boundary',
      phase,
      sideScope,
      params: {
        indicator: {
          name: indicatorName,
          sourceText: this.extractIndicatorSourceText(clause),
          ...(bandParams?.period !== undefined ? { period: bandParams.period } : {}),
          ...(bandParams?.stdDev !== undefined ? { stdDev: bandParams.stdDev } : {}),
        },
        boundaryRole,
        event: this.extractConfirmationMode(clause) ?? 'touch_or_cross',
        sourceText: clause,
      },
    })
  }
}

private extractIndicatorSourceText(clause: string): string {
  const match = clause.match(/布林线|布林带|bollinger|通道|channel|上轨|下轨|中轨|上沿|下沿|中线|上边界|下边界|边界/iu)
  return match?.[0] ?? 'boundary'
}
```

- [ ] **Step 5: Map generic boundary trigger to contract capability**

In `buildTriggerCapability()`, add before the default return:

```ts
if (trigger.key === 'price.detect.indicator_boundary') {
  return {
    domain: 'price',
    verb: 'detect',
    object: 'indicator_boundary',
    shape: this.toCapabilityShape({
      key: trigger.key,
      phase: trigger.phase,
      sideScope: trigger.sideScope ?? null,
      ...(trigger.params ?? {}),
    }),
  }
}
```

- [ ] **Step 6: Run extraction tests**

Run:

```bash
pnpm --dir apps/quantify exec jest --config ./jest-unit.json --runInBand src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
```

Expected: PASS. If existing Bollinger-specific tests produce duplicate triggers, update `harmonizeBollingerTriggers()` to dedupe by `key + phase + sideScope + boundaryRole + indicator.name`.

- [ ] **Step 7: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
git commit -F - <<'MSG'
fix: extract generic boundary semantics as atomic contracts

变更说明：
- 将布林线、通道、边界等表达统一提取为 indicator_boundary trigger atom。
- 为边界语义生成 price.detect.indicator_boundary contract。
- 增加跨表达矩阵，防止再次按策略族窄修。

Refs: #960
MSG
```

## Task 4: Isolate Checklist Clarification as Compatibility-Only

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts`

- [ ] **Step 1: Add mainline no-checklist-fallback tests**

Append to `strategy-clarification-rules.service.spec.ts`:

```ts
it('does not derive mainline clarification from checklist completeness when semantic ambiguities are clear', () => {
  const state = service.detectFromAmbiguities({
    executionContext: {
      context: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', timeframe: '15m' },
      evidence: [],
      ambiguities: [],
    },
    atomicResolution: {
      atomicIntent: { triggers: [], actions: [], sizing: null, risk: [], relations: [] },
      ambiguities: [],
    },
    checklist: {
      entryRules: [],
      exitRules: [],
      riskRules: {},
    },
  })

  expect(state).toEqual({ status: 'CLEAR', items: [] })
})

it('keeps checklist detection only behind the compatibility method', () => {
  const state = service.detectLegacyChecklistForCompatibilityOnly({
    entryRules: [],
    exitRules: [],
    riskRules: {},
  })

  expect(state.status).toBe('NEEDS_CLARIFICATION')
  expect(state.items).toEqual(expect.arrayContaining([
    expect.objectContaining({ reason: 'missing_entry_rules' }),
  ]))
})
```

- [ ] **Step 2: Run clarification tests and verify compatibility method is missing**

Run:

```bash
pnpm --dir apps/quantify exec jest --config ./jest-unit.json --runInBand src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts
```

Expected: FAIL with `detectLegacyChecklistForCompatibilityOnly is not a function`.

- [ ] **Step 3: Rename legacy detect method**

In `StrategyClarificationRulesService`, rename:

```ts
detect(input: StrategyClarificationInput): StrategyClarificationState {
```

to:

```ts
detectLegacyChecklistForCompatibilityOnly(input: StrategyClarificationInput): StrategyClarificationState {
```

Update `collectEvidence()` to call the renamed method:

```ts
const clarificationState = this.detectLegacyChecklistForCompatibilityOnly(input)
```

- [ ] **Step 4: Add guarded compatibility alias if needed**

If non-test compile errors show existing call sites still use `detect(...)`, add this method below the renamed method:

```ts
detect(input: StrategyClarificationInput): StrategyClarificationState {
  return this.detectLegacyChecklistForCompatibilityOnly(input)
}
```

Then add a comment above it:

```ts
/**
 * Compatibility alias for legacy callers. Mainline code must use
 * detectFromAmbiguities() or semantic open slots instead.
 */
```

Do not call this alias from `CodegenConversationService` mainline paths.

- [ ] **Step 5: Make atomic fork clarification independent of checklist text**

In `fromAtomicAmbiguities()`, replace the `findFirstAmbiguousBollingerRule(checklist)` dependency with direct semantic slot metadata:

```ts
if (ambiguity.kind === 'atomic_semantic_fork') {
  const slotKey = ambiguity.slotKey ?? ambiguity.field
  const semanticMetadata = resolveSemanticClarificationMetadata(slotKey)

  return [{
    key: `semantic.${slotKey}`,
    reason: 'atomic_semantic_fork',
    field: semanticMetadata.field,
    ...(ambiguity.choices?.length ? { allowedAnswers: ambiguity.choices } : {}),
    blocking: true,
    question: ambiguity.question ?? ambiguity.message,
    status: 'pending',
    slotKey,
    fieldPath: ambiguity.fieldPath,
    slotId: ambiguity.slotId ?? (ambiguity.fieldPath ? buildSemanticSlotId({ slotKey, fieldPath: ambiguity.fieldPath }) : undefined),
  }]
}
```

- [ ] **Step 6: Run clarification tests**

Run:

```bash
pnpm --dir apps/quantify exec jest --config ./jest-unit.json --runInBand src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts src/modules/llm-strategy-codegen/services/__tests__/mainflow-legacy-authority.spec.ts
```

Expected: PASS for clarification tests. The guardrail may still fail on conversation service until Task 5.

- [ ] **Step 7: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts
git commit -F - <<'MSG'
fix: isolate checklist clarification as compatibility only

变更说明：
- 将 checklist 缺项检测显式命名为 compatibility-only。
- 主流程 detectFromAmbiguities 不再从 checklist 完整性派生问题。
- atomic fork 澄清改为基于 semantic slot metadata。

Refs: #960
MSG
```

## Task 5: Remove Family And Compileability From Conversation Authority

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

- [ ] **Step 1: Add negative conversation authority tests**

Append to `codegen-conversation.service.spec.ts` near existing compileability blocker tests:

```ts
it('keeps Bollinger-line follow-up flow in atomic slots without legacy compileability prompts', async () => {
  mockRepo.createSession.mockImplementation(async (payload: any) => ({
    id: 's-bollinger-line-flow',
    ...payload,
  }))

  const result = await service.startSession({
    userId: 'u1',
    message: '15min 布林线下轨买入 上轨卖出',
  })

  expect(result.assistantPrompt).not.toContain('未识别可编译入场规则')
  expect(result.assistantPrompt).not.toContain('未识别可编译出场规则')
  expect(result.clarificationState?.items ?? []).toEqual(expect.arrayContaining([
    expect.objectContaining({
      slotId: expect.any(String),
      fieldPath: expect.stringMatching(/contextSlots|triggers|actions|position|risk/),
    }),
  ]))

  const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0]
  expect(createPayload.semanticState.triggers.length).toBeGreaterThan(0)
  expect(createPayload.semanticState.actions.length).toBeGreaterThan(0)
})

it('does not treat semanticState.families as mainflow evidence', () => {
  const state = buildEmptySemanticStateForTest({
    families: ['grid.range_rebalance'],
    triggers: [],
    actions: [],
    risk: [],
    position: null,
  })

  expect((service as any).hasSemanticMainFlowEvidence(state)).toBe(false)
})
```

If the test file does not have `buildEmptySemanticStateForTest`, add this helper near other semantic fixtures:

```ts
const buildEmptySemanticStateForTest = (overrides: Record<string, any> = {}) => ({
  version: 1,
  families: [],
  triggers: [],
  actions: [],
  risk: [],
  position: null,
  contextSlots: {
    exchange: null,
    symbol: null,
    marketType: null,
    timeframe: null,
  },
  ...overrides,
})
```

- [ ] **Step 2: Run conversation tests and verify failure**

Run:

```bash
pnpm --dir apps/quantify exec jest --config ./jest-unit.json --runInBand src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts --testNamePattern "Bollinger-line|families as mainflow"
```

Expected: FAIL if `families` is still counted as evidence or if the flow asks legacy compileability questions.

- [ ] **Step 3: Update semantic evidence predicate**

In `CodegenConversationService.hasSemanticMainFlowEvidence()`, replace the body with:

```ts
private hasSemanticMainFlowEvidence(state: SemanticState): boolean {
  return state.triggers.some(trigger => trigger.status !== 'superseded')
    || state.actions.some(action => action.status !== 'superseded')
    || state.risk.some(risk => risk.status !== 'superseded')
    || (state.position !== null && state.position.status !== 'superseded')
    || Object.values(state.contextSlots).some(slot => slot?.status === 'locked' || slot?.status === 'open')
}
```

- [ ] **Step 4: Replace user-facing compileability reasons with internal diagnostics**

In `evaluateCanonicalCompileability()`, replace reason strings:

```ts
if (entryRuleCount === 0) {
  reasons.push('canonical_projection_missing_entry_program')
}
if (exitRuleCount === 0) {
  reasons.push('canonical_projection_missing_exit_program')
}
```

In the confirm path, replace:

```ts
if (!compileability.canCompile && (!semanticReadyForGenerate || hasUnresolvedGenericCompileabilityGap)) {
```

with:

```ts
if (!compileability.canCompile && !semanticReadyForGenerate) {
```

Then replace the response prompt in that branch with a semantic prompt:

```ts
assistantPrompt: clarificationPrompt || '请先补充当前语义中仍未确认的字段，我再继续生成策略。',
```

For the `semanticReadyForGenerate === true` case, do not return to `DRAFTING` because of compileability. Let publication/generation stages surface projection diagnostics.

- [ ] **Step 5: Remove compileability projection failure prompt from mainline**

Rename `buildCanonicalProjectionFailureAssistantPrompt()` to:

```ts
private buildCanonicalProjectionFailureDiagnosticMessage(
  compileability: CanonicalCompileabilityReport,
): string {
  return `canonical projection coverage gap: ${compileability.reasons.join(', ')}`
}
```

Use this only in internal logs or `latestSpecDesc` diagnostic fields if such a field already exists. Do not use it as `assistantPrompt`.

- [ ] **Step 6: Run focused conversation and guardrail tests**

Run:

```bash
pnpm --dir apps/quantify exec jest --config ./jest-unit.json --runInBand src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts src/modules/llm-strategy-codegen/services/__tests__/mainflow-legacy-authority.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -F - <<'MSG'
fix: remove family and compileability from semantic authority

变更说明：
- 主流程 evidence 不再使用 semanticState.families。
- compileability 缺 entry/exit 改为内部投影诊断，不再作为用户澄清文案。
- 增加布林线截图流和 family authority 负向测试。

Refs: #960
MSG
```

## Task 6: Canonical And Family Boundary Audit

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-ir-canonical-adapter.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/mainflow-legacy-authority.spec.ts`

- [ ] **Step 1: Extend guardrail to allow family only as metadata**

Add this test to `mainflow-legacy-authority.spec.ts`:

```ts
it('keeps family labels out of readiness and clarification services', () => {
  const conversation = readService('codegen-conversation.service.ts')
  const clarification = readService('strategy-clarification-rules.service.ts')

  expect(conversation).not.toContain('families.length > 0')
  expect(clarification).not.toContain('looksLikeGridStrategy(input)')
})
```

- [ ] **Step 2: Run guardrail and verify current family residuals**

Run:

```bash
pnpm --dir apps/quantify exec jest --config ./jest-unit.json --runInBand src/modules/llm-strategy-codegen/services/__tests__/mainflow-legacy-authority.spec.ts
```

Expected: FAIL if family readiness or grid-looking clarification remains in mainline service code.

- [ ] **Step 3: Mark canonical family fields as metadata**

In `canonical-spec-builder.service.ts`, any emitted `params: { family: ... }` should be retained only inside rule metadata or diagnostics. If a branch checks `rule.metadata?.normalized?.family === 'grid.range_rebalance'`, add a guard comment and ensure it is compile routing after semantic contract projection:

```ts
// Compatibility routing hint only. Readiness and clarification must be decided
// before this point by SemanticState contracts and openSlots.
```

If a branch is used before semantic contract projection, move the condition behind the existing contract/capability check for the same behavior.

- [ ] **Step 4: Rename strategy-ir canonical adapter family params**

In `strategy-ir-canonical-adapter.service.ts`, replace:

```ts
params: { family: 'grid' },
```

with:

```ts
params: { compatibilityFamilyHint: 'grid' },
```

Update any test snapshots or object assertions that expect `family: 'grid'`.

- [ ] **Step 5: Run canonical tests**

Run:

```bash
pnpm --dir apps/quantify exec jest --config ./jest-unit.json --runInBand src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts src/modules/llm-strategy-codegen/services/__tests__/strategy-ir-canonical-adapter.service.spec.ts src/modules/llm-strategy-codegen/services/__tests__/mainflow-legacy-authority.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/strategy-ir-canonical-adapter.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-ir-canonical-adapter.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/mainflow-legacy-authority.spec.ts
git commit -F - <<'MSG'
fix: quarantine strategy family as compatibility metadata

变更说明：
- 将 canonical/IR 中的 family 用法限定为兼容元数据或编译路由提示。
- 增加 guardrail，防止 family 再进入 readiness 或 clarification authority。

Refs: #960
MSG
```

## Task 7: Full Regression Verification

**Files:**
- Modify only if tests reveal a real remaining gap in files already touched by Tasks 2-6.

- [ ] **Step 1: Run focused AI Quant unit suite**

Run:

```bash
pnpm --dir apps/quantify exec jest --config ./jest-unit.json --runInBand src/modules/llm-strategy-codegen/services/__tests__/semantic-clarification-metadata.spec.ts src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts src/modules/llm-strategy-codegen/services/__tests__/mainflow-legacy-authority.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run full quantify unit tests**

Run:

```bash
pnpm --dir apps/quantify run test:unit
```

Expected: PASS.

- [ ] **Step 3: Run lint for quantify**

Run:

```bash
pnpm nx run quantify:lint
```

Expected: PASS.

- [ ] **Step 4: Inspect old-authority residuals**

Run:

```bash
rg -n "未识别可编译|missing_position_pct|missing_position_mode|missing_entry_rules|missing_exit_rules|families.length > 0|looksLikeGridStrategy\\(|entryRules\\.length|exitRules\\.length|compileability" apps/quantify/src/modules/llm-strategy-codegen
```

Expected: remaining matches are only in:

- compatibility-only method names or tests;
- internal diagnostic names;
- legacy type definitions;
- negative guardrail tests.

For every other match, either remove the mainline authority use or rename it as compatibility/internal diagnostic with an explicit guard.

- [ ] **Step 5: Commit verification fixes if any**

If Step 4 required code changes:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen
git commit -F - <<'MSG'
fix: close residual atomic semantic mainflow gaps

变更说明：
- 清理最终验证发现的旧 authority 残留。
- 保持 legacy 行为仅限兼容或内部诊断路径。

Refs: #960
MSG
```

If Step 4 required no code changes, do not create an empty commit.

## Self-Review

- Spec coverage: Tasks 1, 4, 5, and 6 cover residual old authority as a release blocker. Tasks 2 and 4 cover semantic openSlot clarification. Task 3 covers cross-expression atomic extraction. Task 5 covers compileability diagnostics. Task 7 covers verification.
- Placeholder scan: the plan contains no placeholder markers, no unfinished sections, and no step that says to add unspecified tests.
- Type consistency: new semantic reasons are introduced in Task 2 before code paths use them. New compatibility method is introduced before tests call it. The generic boundary trigger key is introduced in extractor tests and implemented in the same task.
