# AI Quant Semantic Confirm Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove planner-driven false fallbacks from AI Quant conversation flow by making deterministic semantic state the source of truth for confirmation, clarification, and compileability decisions.

**Architecture:** Keep `planner` as an auxiliary layer for wording, summary, and semantic patch suggestions, but move first-round and follow-up status decisions onto the deterministic semantic pipeline inside `codegen-conversation.service.ts`. Rename the old checklist-era confirmation state to `CONFIRM_GATE`, add explicit planner failure diagnostics for observability only, and protect the flow with mandatory regression tests across the four user-specified strategy cases.

**Tech Stack:** NestJS, TypeScript, Jest, Swagger DTOs, AI Quant semantic state pipeline

---

## File Map

### Core conversation flow

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
  Purpose: move start/continue conversation status decisions from `planner.logicReady` fallback behavior to deterministic semantic state, replace generic fallback prompts, and add planner failure observability hooks.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation-state-machine.ts`
  Purpose: rename the checklist-era confirmation state and stop treating `logicReady` as the primary decision input.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation-start-session.helper.ts`
  Purpose: bootstrap `startSession` from deterministic decision outputs and `CONFIRM_GATE`, not `CHECKLIST_GATE`.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-compileability-decision.service.ts`
  Purpose: replace the old “补充入场和出场条件” compileability prompt with precise semantic or compileability wording.

### Types and API surface

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-session-status.ts`
  Purpose: rename `CHECKLIST_GATE` to `CONFIRM_GATE` and keep confirmable status helpers aligned.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/dto/codegen-session.response.dto.ts`
  Purpose: expose `CONFIRM_GATE` in the API enum instead of the removed checklist-era status.

### Planner contract and prompt tests

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/prompts/conversation-planner-system.prompt.ts`
  Purpose: keep `planner` focused on assistant wording and patch suggestions, while clarifying that server-side semantic state remains authoritative.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-question.service.spec.ts`
  Purpose: adjust wording expectations if prompt contract text changes.

### Tests

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-state-machine.spec.ts`
  Purpose: rename state expectations and cover deterministic confirmation decisions.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-start-session.helper.spec.ts`
  Purpose: verify bootstrap behavior now targets `CONFIRM_GATE`.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
  Purpose: add planner empty / invalid JSON / schema mismatch regressions for the four required strategy cases and rename old state assertions.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.spec.ts`
  Purpose: align persisted status fixtures with `CONFIRM_GATE`.

## Task 1: Rename the confirmation status from `CHECKLIST_GATE` to `CONFIRM_GATE`

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-session-status.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation-state-machine.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation-start-session.helper.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/dto/codegen-session.response.dto.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-state-machine.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-start-session.helper.spec.ts`

- [ ] **Step 1: Write the failing rename assertions**

```ts
expect(result.status).toBe('CONFIRM_GATE')
expect(CODEGEN_CONFIRMABLE_SESSION_STATUSES).toContain('CONFIRM_GATE')
expect(CODEGEN_CONFIRMABLE_SESSION_STATUSES).not.toContain('CHECKLIST_GATE')
```

- [ ] **Step 2: Run the targeted tests to verify they fail on the old status name**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-state-machine.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-start-session.helper.spec.ts
```

Expected: FAIL with assertions still seeing `CHECKLIST_GATE`.

- [ ] **Step 3: Apply the status rename in the shared types and state machine**

```ts
export type LlmCodegenConversationStatus = 'DRAFTING' | 'CONFIRM_GATE'

export const CODEGEN_CONFIRMABLE_SESSION_STATUSES = [
  'DRAFTING',
  'CONFIRM_GATE',
] as const satisfies readonly LlmCodegenConversationStatus[]
```

```ts
resolvePlannerStatus(input: {
  shouldEnterConfirmGate: boolean
}): LlmCodegenConversationStatus {
  return input.shouldEnterConfirmGate ? 'CONFIRM_GATE' : 'DRAFTING'
}
```

```ts
const status: LlmCodegenSessionStatus = input.decisionKind === 'CONFIRM_INFERRED'
  ? 'DRAFTING'
  : (input.plannerStatus === 'CONFIRM_GATE'
    && (input.compileability?.canCompile === false || input.normalizationBlocked === true)
      ? 'DRAFTING'
      : input.plannerStatus)

const shouldEnterConfirmationGate = status === 'CONFIRM_GATE'
```

- [ ] **Step 4: Update the response DTO enum and the state-machine tests**

```ts
@ApiProperty({
  description: '会话状态',
  enum: ['DRAFTING', 'CONFIRM_GATE', 'GENERATING', 'VALIDATING_STATIC', 'VALIDATING_RUNTIME', 'VALIDATING_OUTPUT', 'VALIDATING_CONSISTENCY', 'PUBLISHED', 'CONSISTENCY_FAILED', 'REJECTED'],
})
status!: string
```

```ts
expect(machine.resolvePlannerStatus({ shouldEnterConfirmGate: true })).toBe('CONFIRM_GATE')
expect(result.status).toBe('CONFIRM_GATE')
```

- [ ] **Step 5: Re-run the targeted rename tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-state-machine.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-start-session.helper.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the rename slice**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/codegen-session-status.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation-state-machine.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation-start-session.helper.ts \
  apps/quantify/src/modules/llm-strategy-codegen/dto/codegen-session.response.dto.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-state-machine.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-start-session.helper.spec.ts
git commit -m "refactor: rename AI Quant confirm gate status"
```

## Task 2: Make deterministic semantic state the source of truth for `startSession`

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-compileability-decision.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

- [ ] **Step 1: Write failing tests for planner-empty and planner-invalid-json start-session regressions**

```ts
it('enters CONFIRM_GATE for the ORDI spot strategy even when planner returns empty content', async () => {
  mockRepo.createSession.mockResolvedValue({ id: 's-ordi-empty-planner' })
  mockAi.chat.mockResolvedValue({ content: '' })

  const result = await service.startSession({
    userId: 'u1',
    initialMessage: '策略一：OKX 现货 ORDI/USDT，主周期 1h，10% 固定仓位做多；已有出场规则为价格相对前收盘上涨 1% 时平多；止损为相对入场均价下跌 5% 强制平仓；止盈为相对入场均价上涨 10% 平仓。',
  })

  expect(result.status).toBe('CONFIRM_GATE')
  expect(result.assistantPrompt).not.toContain('请补充入场和出场条件')
})

it('enters CONFIRM_GATE for the Bollinger strategy when planner returns invalid JSON', async () => {
  mockRepo.createSession.mockResolvedValue({ id: 's-boll-invalid-json' })
  mockAi.chat.mockResolvedValue({ content: 'not-json' })

  const result = await service.startSession({
    userId: 'u1',
    initialMessage: 'OKX 合约 BTCUSDT 15m，价格触及/突破布林带(20,2)上轨时做空，触及/突破下轨时做多；多空单都回到布林带中轨(MA20)时平仓；单笔仓位 10%。',
  })

  expect(result.status).toBe('CONFIRM_GATE')
  expect(result.assistantPrompt).toContain('请确认是否按此逻辑生成')
})
```

- [ ] **Step 2: Run just the new start-session regressions**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts -t "planner returns empty content|planner returns invalid JSON"
```

Expected: FAIL because the current implementation falls back to `logicReady: false` and the generic补条件 prompt.

- [ ] **Step 3: Refactor `startSession` to derive confirmation from semantic closure instead of `plan.logicReady`**

```ts
const normalization = this.buildNormalizationFromSemanticState(initialSemanticState)
const initialCanonicalSpec = this.buildCanonicalSpecForConversation(checklist, normalization, initialSemanticState)
const compileability = this.evaluateCanonicalCompileability(initialCanonicalSpec)
const decision = this.buildStrategyDecision({
  checklist,
  clarification,
  compileability,
  constraintPack: initialConstraintPack,
})

const shouldEnterConfirmGate =
  clarificationState.status === 'CLEAR'
  && decision.kind !== 'ASK_CLARIFY'
  && !normalization.blocked
  && !!compileability?.canCompile

const plannerStatus = this.stateMachine.resolvePlannerStatus({
  shouldEnterConfirmGate,
})
```

```ts
const confirmationAssistantPrompt = shouldEnterConfirmGate
  ? this.buildChecklistGateAssistantPrompt(checklist, normalization.normalizedIntent)
  : null
```

- [ ] **Step 4: Replace the generic compileability wording with precise diagnostics**

```ts
question: `当前规则还不能稳定生成脚本：${input.compileability.reasons.join('，')}。请先确认这些具体阻塞项，我再继续整理逻辑图。`
```

```ts
private buildCompileabilityAssistantPrompt(report: CanonicalCompileabilityReport): string {
  return `当前规则还不能稳定生成脚本：${report.reasons.join('，')}。请先补齐这些明确阻塞项后再确认逻辑图。`
}
```

- [ ] **Step 5: Add planner failure observability without changing user-visible state**

```ts
type PlannerOutcomeKind =
  | 'ok'
  | 'planner_empty'
  | 'planner_invalid_json'
  | 'planner_schema_mismatch'
  | 'planner_transport_error'
```

```ts
this.logger.warn(`event=planner_fallback kind=${plannerOutcome.kind} session=start`)
```

- [ ] **Step 6: Re-run the focused start-session tests and one compileability test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts -t "ORDI spot strategy even when planner returns empty content|Bollinger strategy when planner returns invalid JSON|keeps drafting when planner logic text cannot compile"
```

Expected: PASS, with complete strategies entering `CONFIRM_GATE` and non-compilable strategies staying on precise blockers.

- [ ] **Step 7: Commit the start-session decision slice**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/strategy-compileability-decision.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -m "fix: make semantic state authoritative for AI Quant start sessions"
```

## Task 3: Apply the same deterministic decision model to `continueSession`

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

- [ ] **Step 1: Write failing follow-up regressions for planner failures during `continueSession`**

```ts
it('keeps the raw price-change strategy in CONFIRM_GATE after symbol clarification even when planner says unrelated', async () => {
  // reuse existing staging fixture with locked context
  expect(afterSymbol.status).toBe('CONFIRM_GATE')
  expect(afterSymbol.assistantPrompt).toContain('请确认是否按此逻辑生成')
})

it('keeps the grid strategy in CONFIRM_GATE when planner only returns free text and no usable patch', async () => {
  expect(result.status).toBe('CONFIRM_GATE')
  expect(result.assistantPrompt).toContain('双向网格')
})
```

- [ ] **Step 2: Run the targeted follow-up regressions**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts -t "after symbol clarification|grid strategy in CONFIRM_GATE"
```

Expected: FAIL where current flow still depends on `plan.logicReady` or planner free text.

- [ ] **Step 3: Compute follow-up status from merged semantic state before consulting planner**

```ts
const mergedSemanticState = this.semanticStateMerge.merge({
  persisted: persistedSemanticState,
  derived: plannerSemanticState,
})

const mergedChecklist = this.projectLegacyChecklistFromSemanticState(
  mergedSemanticState,
  mergedChecklistSeed,
)

const normalization = this.buildNormalizationFromSemanticState(mergedSemanticState)
const clarificationState = this.buildClarificationFromSemanticState(
  mergedSemanticState,
  mergedChecklist,
  { preserveLegacyFallback: false },
)
const compileability = this.evaluateCanonicalCompileability(
  this.buildCanonicalSpecForConversation(mergedChecklist, normalization, mergedSemanticState),
)

const shouldEnterConfirmGate =
  clarificationState.status === 'CLEAR'
  && !normalization.blocked
  && compileability?.canCompile === true
```

- [ ] **Step 4: Make follow-up fallback wording semantic and specific**

```ts
if (clarificationState.status === 'NEEDS_CLARIFICATION') {
  return this.buildClarificationPrompt(clarificationState, mergedChecklist, normalization.normalizedIntent)
}

if (compileability && !compileability.canCompile) {
  return this.buildCompileabilityAssistantPrompt(compileability)
}

return this.buildChecklistGateAssistantPrompt(mergedChecklist, normalization.normalizedIntent)
```

- [ ] **Step 5: Re-run focused follow-up tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts -t "after symbol clarification|grid strategy in CONFIRM_GATE|follow-up message completes a compileability-blocked conversation"
```

Expected: PASS, and no planner failure case reintroduces the generic补条件 prompt.

- [ ] **Step 6: Commit the continue-session slice**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -m "fix: keep AI Quant follow-up decisions on semantic state"
```

## Task 4: Align planner contract and persistence tests with the new authority boundary

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/prompts/conversation-planner-system.prompt.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-question.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

- [ ] **Step 1: Write a failing prompt contract assertion**

```ts
expect(systemPrompt).toContain('server-side semantic state remains authoritative')
expect(systemPrompt).toContain('logicReady 仅作为辅助建议')
```

- [ ] **Step 2: Run the prompt and repository status tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/conversation-planner-system-prompt.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.spec.ts
```

Expected: FAIL because the prompt and persisted status fixtures still mention old behavior or old names.

- [ ] **Step 3: Update the planner prompt to document its reduced authority**

```ts
'assistantPrompt 负责总结当前已理解策略并提出一个最高优先级问题，但 server-side semantic state remains authoritative。',
'logicReady 仅作为辅助建议，不能覆盖服务端基于 semanticState 的确认、澄清与编译判断。',
```

- [ ] **Step 4: Update status fixtures and assertions from `CHECKLIST_GATE` to `CONFIRM_GATE`**

```ts
status: 'CONFIRM_GATE'
```

- [ ] **Step 5: Re-run the prompt and persistence tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/conversation-planner-system-prompt.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the contract-alignment slice**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/prompts/conversation-planner-system.prompt.ts \
  apps/quantify/src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-question.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -m "refactor: narrow planner authority in AI Quant prompt contract"
```

## Task 5: Add the mandatory four-case regression suite and run verification

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- Optional Test: `apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts`

- [ ] **Step 1: Add the four required regression cases at service-test level**

```ts
const mandatoryCases = [
  {
    name: 'strategy-1-ordi-spot',
    message: '策略一：OKX 现货 ORDI/USDT，主周期 1h，10% 固定仓位做多；已有出场规则为价格相对前收盘上涨 1% 时平多；止损为相对入场均价下跌 5% 强制平仓；止盈为相对入场均价上涨 10% 平仓。',
    expectedStatus: 'CONFIRM_GATE',
  },
  {
    name: 'strategy-2-raw-price-change',
    message: '在okx交易所 我想买btc 3分钟之内跌百分1买入 15分钟之内涨百分2卖出 单笔用百分10资金 止损5% 止盈10%',
    expectedStatus: 'CONFIRM_GATE',
  },
  {
    name: 'strategy-3-bidirectional-grid',
    message: '在 OKX 交易 BTCUSDT 永续合约，15m 周期，价格区间 60000-80000，采用双向网格，每格间距 0.5%，单笔使用 10% 资金，按入场均价亏损 5% 止损、盈利 10% 止盈',
    expectedStatus: 'CONFIRM_GATE',
  },
  {
    name: 'strategy-4-bollinger',
    message: 'OKX 合约 BTCUSDT 15m，价格触及/突破布林带(20,2)上轨时做空，触及/突破下轨时做多；多空单都回到布林带中轨(MA20)时平仓；单笔仓位 10%。',
    expectedStatus: 'CONFIRM_GATE',
  },
]
```

- [ ] **Step 2: For each mandatory case, force a planner failure mode**

```ts
mockAi.chat.mockResolvedValueOnce({ content: '' })
mockAi.chat.mockResolvedValueOnce({ content: 'not-json' })
mockAi.chat.mockRejectedValueOnce(new Error('planner transport failed'))
```

```ts
expect(result.assistantPrompt).not.toContain('请补充入场和出场条件')
expect(result.status).toBe('CONFIRM_GATE')
```

- [ ] **Step 3: Run the mandatory regression suite**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts -t "strategy-1-ordi-spot|strategy-2-raw-price-change|strategy-3-bidirectional-grid|strategy-4-bollinger"
```

Expected: PASS for all four cases.

- [ ] **Step 4: Run the broader llm-strategy-codegen service suite**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
```

Expected: PASS without regressions in existing planner, clarification, compileability, and publish flows.

- [ ] **Step 5: Run repository and prompt tests plus lint as final verification**

Run:

```bash
dx lint
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-state-machine.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation-start-session.helper.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/conversation-planner-system-prompt.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the regression suite and verification slice**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts \
  apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts
git commit -m "test: lock AI Quant semantic confirm gate regressions"
```

## Self-Review

### Spec coverage

- Deterministic semantic state becomes authoritative: Task 2 and Task 3.
- `CHECKLIST_GATE` removal in favor of `CONFIRM_GATE`: Task 1.
- Planner reduced to auxiliary wording and patch role: Task 4.
- Planner failure observability without user-visible fallback: Task 2 and Task 3.
- Mandatory four-case regression protection: Task 5.

No uncovered requirement remains from the approved spec.

### Placeholder scan

- No `TBD`, `TODO`, or “implement later” placeholders remain.
- Every task lists exact files and concrete commands.
- Test tasks include actual test cases and expected outcomes.

### Type consistency

- All renamed status references use `CONFIRM_GATE`.
- The deterministic decision path refers consistently to `semanticState`, `clarificationState`, `compileability`, and `plannerStatus`.
- Planner failure event names are consistent across the plan: `planner_empty`, `planner_invalid_json`, `planner_schema_mismatch`, `planner_transport_error`.
