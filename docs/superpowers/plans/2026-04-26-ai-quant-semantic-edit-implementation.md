# AI Quant Semantic Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add semantic-level conversational edits so users can modify, replace, or restart AI quant strategies from natural language before or after script generation.

**Architecture:** Add a focused semantic edit layer inside `llm-strategy-codegen` before the existing conversation planner. The new layer classifies user messages into semantic edit, pending edit clarification, strategy replacement, processing rejection, or no edit, then hands complete states back to the existing `SemanticState -> CanonicalSpec -> compile/publish` flow.

**Tech Stack:** NestJS, TypeScript, Jest, existing Quantify codegen services, Prisma JSON session fields, `dx test unit quantify`.

---

## File Structure

- Create `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-edit.ts`
  Holds `SemanticEditDecision`, `SemanticEditPatch`, `SemanticEditOperation`, `PendingSemanticEdit`, and helpers for reading/writing pending edit metadata.

- Create `apps/quantify/src/modules/llm-strategy-codegen/services/conversation-semantic-edit.service.ts`
  Classifies user messages, builds semantic edit decisions, stores pending edit state in semantic-state metadata, and applies complete edits to active semantic graph.

- Create `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/conversation-semantic-edit.service.spec.ts`
  Unit tests for classification, pending edit, cancellation, context replacement, and strategy replacement without touching the large conversation service fixture.

- Modify `apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts`
  Register `ConversationSemanticEditService`.

- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
  Inject `ConversationSemanticEditService` and call it near the top of `continueSession()` before planner fallback. Add small private handlers to persist edit outcomes and reuse existing semantic artifact builders.

- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
  Integration-style regression tests for `continueSession()` behavior: symbol edit, pending edit clarification, strategy replacement, published-session edit, and processing rejection.

- Modify `apps/quantify/src/modules/strategy-plaza/services/strategy-plaza-edit-session.service.spec.ts`
  Add a regression assertion that plaza edit sessions are normal codegen sessions and therefore use the shared semantic edit path.

- Optional modify `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.codegen-confirmation.test.tsx`
  Add one lightweight UI regression only if backend response handling needs adjustment. Frontend must not classify semantic edits.

## Task 1: Add Semantic Edit Types

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-edit.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/conversation-semantic-edit.service.spec.ts`

- [ ] **Step 1: Create the semantic edit type file**

Add:

```ts
import type {
  SemanticActionState,
  SemanticPositionState,
  SemanticRiskState,
  SemanticState,
  SemanticTriggerState,
} from './semantic-state'

export type SemanticEditNodeKind = 'trigger' | 'action' | 'risk' | 'position' | 'context'

export type SemanticEditContextField = 'symbol' | 'timeframe' | 'exchange' | 'marketType'

export type SemanticEditOperation =
  | { op: 'replace_context', field: SemanticEditContextField, value: string }
  | { op: 'replace_position', targetRef?: string, text: string }
  | { op: 'replace_trigger', targetRef?: string, text: string }
  | { op: 'add_trigger', text: string }
  | { op: 'remove_trigger', targetRef?: string }
  | { op: 'replace_action', targetRef?: string, text: string }
  | { op: 'add_action', text: string }
  | { op: 'remove_action', targetRef?: string }
  | { op: 'replace_risk', targetRef?: string, text: string }
  | { op: 'add_risk', text: string }
  | { op: 'remove_risk', targetRef?: string }

export interface SemanticEditPatch {
  operations: SemanticEditOperation[]
}

export type PendingSemanticEditCandidate =
  | SemanticTriggerState
  | SemanticActionState
  | SemanticRiskState
  | SemanticPositionState

export interface PendingSemanticEdit {
  id: string
  op: Extract<SemanticEditOperation['op'], 'replace_trigger' | 'replace_action' | 'replace_risk' | 'replace_position'>
  targetRef?: string
  candidate: PendingSemanticEditCandidate
  status: 'needs_clarification' | 'ready_to_apply'
  createdFromMessage: string
}

export type SemanticEditDecision =
  | { kind: 'NO_EDIT' }
  | { kind: 'APPLY_TO_SEMANTIC_STATE', patch: SemanticEditPatch }
  | { kind: 'ASK_EDIT_CLARIFICATION', question: string, pendingEdit: PendingSemanticEdit }
  | { kind: 'REGENERATE_SCRIPT_VERSION', patch: SemanticEditPatch }
  | { kind: 'REPLACE_STRATEGY_DRAFT', seedText: string }
  | { kind: 'REJECT_WHILE_PROCESSING', message: string }

export interface SemanticStateWithPendingEdit extends SemanticState {
  pendingEdit?: PendingSemanticEdit | null
  previousVersions?: Array<{
    reason: 'strategy_replacement'
    replacedAt: string
    semanticState: SemanticState
  }>
}

export function readPendingSemanticEdit(state: SemanticState | null | undefined): PendingSemanticEdit | null {
  const value = (state as SemanticStateWithPendingEdit | null | undefined)?.pendingEdit
  return value && typeof value === 'object' ? value : null
}

export function withPendingSemanticEdit(
  state: SemanticState,
  pendingEdit: PendingSemanticEdit | null,
): SemanticStateWithPendingEdit {
  return {
    ...(state as SemanticStateWithPendingEdit),
    pendingEdit,
    updatedAt: new Date().toISOString(),
  }
}
```

- [ ] **Step 2: Run type-focused test command before service exists**

Run:

```bash
dx test unit quantify
```

Expected: existing tests pass; no new semantic edit tests exist yet.

- [ ] **Step 3: Commit type definitions**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/semantic-edit.ts
git commit -F - <<'MSG'
feat: add semantic edit decision types

Refs: #904
MSG
```

## Task 2: Build ConversationSemanticEditService

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/conversation-semantic-edit.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/conversation-semantic-edit.service.spec.ts`

- [ ] **Step 1: Write failing tests for classification**

Create `conversation-semantic-edit.service.spec.ts` with:

```ts
import { ConversationSemanticEditService } from '../conversation-semantic-edit.service'

describe('ConversationSemanticEditService', () => {
  const service = new ConversationSemanticEditService()

  it('classifies explicit context replacement', () => {
    const decision = service.decide({
      status: 'DRAFTING',
      message: '我要把交易标的改为 BTCUSDT',
      semanticState: service.createEmptySemanticStateForTest(),
    })

    expect(decision).toEqual({
      kind: 'APPLY_TO_SEMANTIC_STATE',
      patch: {
        operations: [{ op: 'replace_context', field: 'symbol', value: 'BTCUSDT' }],
      },
    })
  })

  it('classifies strategy replacement with seed text', () => {
    const decision = service.decide({
      status: 'PUBLISHED',
      message: '之前策略不对，重新做一个 RSI 策略',
      semanticState: service.createEmptySemanticStateForTest(),
    })

    expect(decision).toEqual({
      kind: 'REPLACE_STRATEGY_DRAFT',
      seedText: '重新做一个 RSI 策略',
    })
  })

  it('asks for replacement seed when user only says restart', () => {
    const decision = service.decide({
      status: 'CONFIRM_GATE',
      message: '之前不对，重新来',
      semanticState: service.createEmptySemanticStateForTest(),
    })

    expect(decision.kind).toBe('ASK_EDIT_CLARIFICATION')
    if (decision.kind !== 'ASK_EDIT_CLARIFICATION') return
    expect(decision.question).toContain('请描述新的触发、行动、风控、仓位和运行 context')
  })

  it('rejects edits while generation is processing', () => {
    const decision = service.decide({
      status: 'GENERATING',
      message: '把止损改成 3%',
      semanticState: service.createEmptySemanticStateForTest(),
    })

    expect(decision).toEqual({
      kind: 'REJECT_WHILE_PROCESSING',
      message: '当前策略正在生成或校验，请等待完成后再修改。',
    })
  })
})
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
dx test unit quantify
```

Expected: FAIL because `conversation-semantic-edit.service.ts` and `createEmptySemanticStateForTest()` do not exist.

- [ ] **Step 3: Implement minimal service classification**

Create `conversation-semantic-edit.service.ts`:

```ts
import type { LlmCodegenSessionStatus } from '../types/codegen-session-status'
import type { SemanticState } from '../types/semantic-state'
import type { SemanticEditDecision } from '../types/semantic-edit'
import { Injectable } from '@nestjs/common'
import { canonicalizeStrategySymbolInput } from './market-scope-equivalence'

interface DecideInput {
  status: LlmCodegenSessionStatus
  message: string
  semanticState: SemanticState
}

const PROCESSING_STATUSES = new Set<LlmCodegenSessionStatus>([
  'GENERATING',
  'VALIDATING_STATIC',
  'VALIDATING_RUNTIME',
  'VALIDATING_OUTPUT',
  'VALIDATING_CONSISTENCY',
])

@Injectable()
export class ConversationSemanticEditService {
  decide(input: DecideInput): SemanticEditDecision {
    const text = input.message.trim()
    if (!text) return { kind: 'NO_EDIT' }

    if (PROCESSING_STATUSES.has(input.status)) {
      return {
        kind: 'REJECT_WHILE_PROCESSING',
        message: '当前策略正在生成或校验，请等待完成后再修改。',
      }
    }

    const replacement = this.detectStrategyReplacement(text)
    if (replacement.detected) {
      if (!replacement.seedText) {
        return {
          kind: 'ASK_EDIT_CLARIFICATION',
          question: '你想重新做一个新策略。请描述新的触发、行动、风控、仓位和运行 context。',
          pendingEdit: {
            id: `strategy-replacement-${Date.now()}`,
            op: 'replace_trigger',
            candidate: this.createPlaceholderTrigger(text),
            status: 'needs_clarification',
            createdFromMessage: text,
          },
        }
      }
      return {
        kind: 'REPLACE_STRATEGY_DRAFT',
        seedText: replacement.seedText,
      }
    }

    const symbol = this.extractSymbolReplacement(text)
    if (symbol) {
      return {
        kind: 'APPLY_TO_SEMANTIC_STATE',
        patch: {
          operations: [{ op: 'replace_context', field: 'symbol', value: symbol }],
        },
      }
    }

    return { kind: 'NO_EDIT' }
  }

  createEmptySemanticStateForTest(): SemanticState {
    return {
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
      normalizationNotes: [],
      updatedAt: new Date().toISOString(),
    }
  }

  private detectStrategyReplacement(text: string): { detected: boolean, seedText: string | null } {
    if (!/(之前|刚才|这套|当前).*(不对|错|废掉|不要|重新)|重新发布|重新做/u.test(text)) {
      return { detected: false, seedText: null }
    }

    const seedText = text
      .replace(/^(之前|刚才|这套|当前)?[^，。,；;]*(不对|错|废掉|不要)[，。,；;\s]*/u, '')
      .replace(/^重新来$/u, '')
      .trim()

    return {
      detected: true,
      seedText: seedText || null,
    }
  }

  private extractSymbolReplacement(text: string): string | null {
    if (!/(交易标的|标的|交易对|symbol).*(改为|改成|换成|替换为)|把.*改成/u.test(text)) {
      return null
    }
    const match = text.match(/\b([A-Z0-9]{2,20}(?:[-/]?(?:USDT|USDC|USD))(?:-SWAP|:PERP|:SPOT)?)\b/iu)
    return canonicalizeStrategySymbolInput(match?.[1])
  }

  private createPlaceholderTrigger(text: string) {
    return {
      id: `pending-replacement-${Date.now()}`,
      key: 'pending.strategy_replacement_seed',
      phase: 'gate' as const,
      params: {},
      status: 'open' as const,
      source: 'user_explicit' as const,
      evidence: {
        text,
        source: 'user_explicit' as const,
      },
      openSlots: [],
    }
  }
}
```

- [ ] **Step 4: Run tests and confirm classification passes**

Run:

```bash
dx test unit quantify
```

Expected: PASS for the new service tests and existing tests.

- [ ] **Step 5: Commit service classification**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/conversation-semantic-edit.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/conversation-semantic-edit.service.spec.ts
git commit -F - <<'MSG'
feat: classify semantic edit intents

Refs: #904
MSG
```

## Task 3: Apply Context Edits to Semantic State

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/conversation-semantic-edit.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/conversation-semantic-edit.service.spec.ts`

- [ ] **Step 1: Add failing tests for context application**

Append:

```ts
it('applies context replacement without changing triggers', () => {
  const base = service.createEmptySemanticStateForTest()
  const state = {
    ...base,
    triggers: [{
      id: 'trigger-1',
      key: 'indicator.above',
      phase: 'entry' as const,
      params: { indicator: 'ma' },
      status: 'locked' as const,
      source: 'user_explicit' as const,
      openSlots: [],
    }],
  }

  const next = service.applyPatch(state, {
    operations: [{ op: 'replace_context', field: 'symbol', value: 'BTCUSDT' }],
  })

  expect(next.contextSlots.symbol).toEqual(expect.objectContaining({
    slotKey: 'symbol',
    fieldPath: 'contextSlots.symbol',
    value: 'BTCUSDT',
    status: 'locked',
  }))
  expect(next.triggers).toEqual(state.triggers)
})
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
dx test unit quantify
```

Expected: FAIL because `applyPatch()` does not exist.

- [ ] **Step 3: Implement context patch application**

Add methods to `ConversationSemanticEditService`:

```ts
  applyPatch(state: SemanticState, patch: SemanticEditPatch): SemanticState {
    return patch.operations.reduce((next, operation) => {
      if (operation.op === 'replace_context') {
        return this.applyContextReplacement(next, operation.field, operation.value)
      }
      return next
    }, state)
  }

  private applyContextReplacement(
    state: SemanticState,
    field: 'symbol' | 'timeframe' | 'exchange' | 'marketType',
    value: string,
  ): SemanticState {
    const questionHints = {
      exchange: '请确认交易所（binance / okx / hyperliquid）。',
      symbol: '请确认策略交易标的（例如 BTCUSDT）。',
      marketType: '请确认市场类型（现货或合约/perp）。',
      timeframe: '请确认策略主周期（例如 15m 或 1h）。',
    } as const

    return {
      ...state,
      contextSlots: {
        ...state.contextSlots,
        [field]: {
          slotKey: field,
          fieldPath: `contextSlots.${field}`,
          value,
          status: 'locked',
          priority: 'context',
          questionHint: questionHints[field],
          affectsExecution: true,
          evidence: {
            text: value,
            source: 'user_explicit',
          },
        },
      },
      updatedAt: new Date().toISOString(),
    }
  }
```

Update the import:

```ts
import type { SemanticEditDecision, SemanticEditPatch } from '../types/semantic-edit'
```

- [ ] **Step 4: Run tests and confirm pass**

Run:

```bash
dx test unit quantify
```

Expected: PASS.

- [ ] **Step 5: Commit context application**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/conversation-semantic-edit.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/conversation-semantic-edit.service.spec.ts
git commit -F - <<'MSG'
feat: apply semantic context edits

Refs: #904
MSG
```

## Task 4: Add Pending Semantic Edit Support

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/conversation-semantic-edit.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-edit.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/conversation-semantic-edit.service.spec.ts`

- [ ] **Step 1: Add failing pending edit tests**

Append:

```ts
it('creates pending edit when trigger replacement text is incomplete', () => {
  const decision = service.decide({
    status: 'CONFIRM_GATE',
    message: '把触发改成 RSI',
    semanticState: service.createEmptySemanticStateForTest(),
  })

  expect(decision.kind).toBe('ASK_EDIT_CLARIFICATION')
  if (decision.kind !== 'ASK_EDIT_CLARIFICATION') return
  expect(decision.pendingEdit.op).toBe('replace_trigger')
  expect(decision.pendingEdit.status).toBe('needs_clarification')
  expect(decision.question).toContain('RSI')
})

it('cancels pending edit without changing active state', () => {
  const base = service.createEmptySemanticStateForTest()
  const withPending = service.withPendingEditForTest(base, '把触发改成 RSI')

  const decision = service.decide({
    status: 'DRAFTING',
    message: '算了，保持原来的',
    semanticState: withPending,
  })

  expect(decision).toEqual({
    kind: 'APPLY_TO_SEMANTIC_STATE',
    patch: { operations: [] },
  })
  expect(service.readPendingEditForTest(service.applyPatch(withPending, decision.patch))).toBeNull()
})
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
dx test unit quantify
```

Expected: FAIL because pending helper methods and trigger replacement classification do not exist.

- [ ] **Step 3: Implement pending edit helpers**

Add to `ConversationSemanticEditService`:

```ts
  withPendingEditForTest(state: SemanticState, createdFromMessage: string): SemanticState {
    return withPendingSemanticEdit(state, this.createPendingTriggerReplacement(createdFromMessage))
  }

  readPendingEditForTest(state: SemanticState): PendingSemanticEdit | null {
    return readPendingSemanticEdit(state)
  }

  private createPendingTriggerReplacement(text: string): PendingSemanticEdit {
    return {
      id: `pending-trigger-${Date.now()}`,
      op: 'replace_trigger',
      candidate: {
        id: `candidate-trigger-${Date.now()}`,
        key: 'indicator.rsi_threshold',
        phase: 'gate',
        params: { indicator: 'rsi' },
        status: 'open',
        source: 'user_explicit',
        evidence: {
          text,
          source: 'user_explicit',
        },
        openSlots: [{
          slotKey: 'trigger.rsi.threshold',
          fieldPath: 'triggers[].params.threshold',
          status: 'open',
          priority: 'behavior',
          questionHint: '请确认 RSI 阈值，例如低于 30 或高于 70。',
          affectsExecution: true,
        }],
      },
      status: 'needs_clarification',
      createdFromMessage: text,
    }
  }
```

Update imports:

```ts
import type { PendingSemanticEdit, SemanticEditDecision, SemanticEditPatch } from '../types/semantic-edit'
import { readPendingSemanticEdit, withPendingSemanticEdit } from '../types/semantic-edit'
```

In `decide()`, before `NO_EDIT`, add:

```ts
    if (readPendingSemanticEdit(input.semanticState) && /算了|保持原来|不改了|取消/u.test(text)) {
      return {
        kind: 'APPLY_TO_SEMANTIC_STATE',
        patch: { operations: [] },
      }
    }

    if (/触发.*改成\s*RSI|把触发改成\s*RSI/u.test(text)) {
      const pendingEdit = this.createPendingTriggerReplacement(text)
      return {
        kind: 'ASK_EDIT_CLARIFICATION',
        question: '你正在把触发语义改成 RSI。请确认 RSI 阈值，例如低于 30 或高于 70。',
        pendingEdit,
      }
    }
```

In `applyPatch()`, clear pending edit when operations are empty and pending exists:

```ts
    if (patch.operations.length === 0 && readPendingSemanticEdit(state)) {
      return withPendingSemanticEdit(state, null)
    }
```

- [ ] **Step 4: Run tests and confirm pass**

Run:

```bash
dx test unit quantify
```

Expected: PASS.

- [ ] **Step 5: Commit pending edit support**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/semantic-edit.ts apps/quantify/src/modules/llm-strategy-codegen/services/conversation-semantic-edit.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/conversation-semantic-edit.service.spec.ts
git commit -F - <<'MSG'
feat: support pending semantic edits

Refs: #904
MSG
```

## Task 5: Register and Integrate Semantic Edit Service

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

- [ ] **Step 1: Add failing conversation regression for symbol edit**

Append to `codegen-conversation.service.spec.ts`:

```ts
it('updates context symbol from freeform semantic edit instead of repeating compileability blockers', async () => {
  const sessionFixture = buildLegacyChecklistBridgeSessionFixture({
    id: 's-edit-symbol',
    userId: 'u1',
    status: 'DRAFTING',
    semanticState: buildLockedMaSemanticState({
      contextSlots: {
        exchange: {
          slotKey: 'exchange',
          fieldPath: 'contextSlots.exchange',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认交易所（binance / okx / hyperliquid）。',
          affectsExecution: true,
          value: 'okx',
        },
        symbol: {
          slotKey: 'symbol',
          fieldPath: 'contextSlots.symbol',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认策略交易标的（例如 BTCUSDT）。',
          affectsExecution: true,
          value: 'ETHUSDT',
        },
        marketType: {
          slotKey: 'marketType',
          fieldPath: 'contextSlots.marketType',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认市场类型（现货或合约/perp）。',
          affectsExecution: true,
          value: 'perp',
        },
        timeframe: {
          slotKey: 'timeframe',
          fieldPath: 'contextSlots.timeframe',
          status: 'locked',
          priority: 'context',
          questionHint: '请确认策略主周期（例如 15m 或 1h）。',
          affectsExecution: true,
          value: '15m',
        },
      },
    }),
    clarificationState: { status: 'CLEAR', items: [] },
    constraintPack: {},
  })
  mockRepo.findById.mockResolvedValue(sessionFixture)
  mockAi.chat.mockResolvedValue({
    content: JSON.stringify({
      related: false,
      logicReady: false,
      assistantPrompt: '这条消息看起来和策略无关。请描述交易逻辑或修改条件。',
    }),
  })

  const result = await service.continueSession('s-edit-symbol', {
    userId: 'u1',
    message: '我要把交易标的改为BTCUSDT',
  })

  expect(result.assistantPrompt).toContain('BTCUSDT')
  expect(result.assistantPrompt).not.toContain('未识别可编译入场规则')
  const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
  expect(updatePayload.semanticState.contextSlots.symbol.value).toBe('BTCUSDT')
})
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
dx test unit quantify
```

Expected: FAIL because `CodegenConversationService` does not call `ConversationSemanticEditService`.

- [ ] **Step 3: Register provider**

In `llm-strategy-codegen.module.ts`, import:

```ts
import { ConversationSemanticEditService } from './services/conversation-semantic-edit.service'
```

Add `ConversationSemanticEditService` before `CodegenConversationService` in providers.

- [ ] **Step 4: Inject and call the service in continueSession**

In `codegen-conversation.service.ts`, import:

```ts
import { ConversationSemanticEditService } from './conversation-semantic-edit.service'
```

Add constructor dependency near semantic services:

```ts
    private readonly conversationSemanticEdit: ConversationSemanticEditService = new ConversationSemanticEditService(),
```

After `currentSemanticState` is read in `continueSession()` and before `inferFreeformSemanticClarificationAnswers()`, add:

```ts
    const semanticEditDecision = this.conversationSemanticEdit.decide({
      status: session.status,
      message: dto.message,
      semanticState: currentSemanticState,
    })
    if (semanticEditDecision.kind !== 'NO_EDIT') {
      return this.continueWithSemanticEditDecision({
        session,
        dto,
        sessionUserId,
        currentSemanticState,
        decision: semanticEditDecision,
      })
    }
```

Add private handler:

```ts
  private async continueWithSemanticEditDecision(input: {
    session: PersistedConversationSessionForContinue
    dto: ContinueCodegenSessionDto
    sessionUserId: string
    currentSemanticState: SemanticState
    decision: SemanticEditDecision
  }): Promise<CodegenSessionResponseDto> {
    const { session, dto, sessionUserId, currentSemanticState, decision } = input

    if (decision.kind === 'REJECT_WHILE_PROCESSING') {
      const response = this.finalizeSessionResponse({
        id: session.id,
        status: session.status,
        missingFields: [],
        assistantPrompt: decision.message,
        clarificationState: this.readClarificationState(session.clarificationState),
      })
      return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
    }

    if (decision.kind === 'ASK_EDIT_CLARIFICATION') {
      const nextState = withPendingSemanticEdit(currentSemanticState, decision.pendingEdit)
      const clarificationState = this.resolveSemanticClarificationArtifacts(nextState).clarificationState
      await this.sessionsRepo.updateSession(session.id, this.stateMachine.buildConversationUpdate({
        status: 'DRAFTING',
        semanticState: nextState,
        clarificationState,
        constraintPack: this.readConstraintPack(session.constraintPack),
      }))
      const response = this.finalizeSessionResponse({
        id: session.id,
        status: 'DRAFTING',
        missingFields: [],
        assistantPrompt: decision.question,
        clarificationState,
      })
      return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
    }

    if (decision.kind === 'APPLY_TO_SEMANTIC_STATE') {
      const nextState = this.conversationSemanticEdit.applyPatch(currentSemanticState, decision.patch)
      const semanticArtifacts = this.resolveSemanticClarificationArtifacts(nextState)
      const normalization = semanticArtifacts.normalization
      const canonicalSpec = this.buildCanonicalSpecForConversation(nextState, normalization)
      const specDesc = this.specDescBuilder.buildFromCanonicalSpec(canonicalSpec, '', {
        normalizedIntent: normalization.normalizedIntent,
        executionContext: semanticArtifacts.executionContext.context,
      })
      await this.sessionsRepo.updateSession(session.id, this.stateMachine.buildConversationUpdate({
        status: 'CONFIRM_GATE',
        semanticState: nextState,
        clarificationState: semanticArtifacts.clarificationState,
        constraintPack: this.readConstraintPack(session.constraintPack),
        latestSpecDesc: specDesc,
      }))
      const assistantPrompt = this.buildSemanticLogicGateAssistantPrompt(nextState)
      const response = this.finalizeSessionResponse({
        id: session.id,
        status: 'CONFIRM_GATE',
        missingFields: [],
        assistantPrompt,
        clarificationState: semanticArtifacts.clarificationState,
        specDesc,
        canonicalDigest: this.readCanonicalDigest(specDesc),
      })
      return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
    }

    return this.returnPersistedSnapshotResponse(session, sessionUserId)
  }
```

Also import:

```ts
import type { SemanticEditDecision } from '../types/semantic-edit'
import { withPendingSemanticEdit } from '../types/semantic-edit'
```

- [ ] **Step 5: Run tests and fix compile errors**

Run:

```bash
dx test unit quantify
```

Expected: PASS after aligning any private method type signatures.

- [ ] **Step 6: Commit integration**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -F - <<'MSG'
feat: apply semantic edits in codegen conversations

Refs: #904
MSG
```

## Task 6: Implement Strategy Replacement Draft Flow

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-edit.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

- [ ] **Step 1: Add failing strategy replacement tests**

Append:

```ts
it('starts a fresh semantic draft when user replaces the whole strategy', async () => {
  mockRepo.findById.mockResolvedValue(buildLegacyChecklistBridgeSessionFixture({
    id: 's-replace-strategy',
    userId: 'u1',
    status: 'PUBLISHED',
    semanticState: buildLockedMaSemanticState(),
    clarificationState: { status: 'CLEAR', items: [] },
    constraintPack: {},
    latestDraftCode: 'return oldSignal',
    latestSpecDesc: { old: true },
  }))
  mockAi.chat.mockResolvedValue({
    content: JSON.stringify({
      related: true,
      logicReady: false,
      assistantPrompt: '我理解你要重新做 RSI 策略，请补充运行 context。',
      semanticPatch: {
        triggers: [{ key: 'indicator.below', phase: 'gate', params: { indicator: 'rsi' } }],
      },
    }),
  })

  const result = await service.continueSession('s-replace-strategy', {
    userId: 'u1',
    message: '之前策略不对，重新做一个 RSI 策略',
  })

  expect(result.status).toBe('DRAFTING')
  const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
  expect(updatePayload.semanticState.previousVersions).toHaveLength(1)
  expect(updatePayload.semanticState.triggers[0].params.indicator).toBe('rsi')
})
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
dx test unit quantify
```

Expected: FAIL because `REPLACE_STRATEGY_DRAFT` is not handled.

- [ ] **Step 3: Add replacement helper**

In `semantic-edit.ts`, add:

```ts
export function buildReplacementSemanticState(input: {
  previous: SemanticState
  next: SemanticState
}): SemanticStateWithPendingEdit {
  return {
    ...(input.next as SemanticStateWithPendingEdit),
    pendingEdit: null,
    previousVersions: [
      ...((input.previous as SemanticStateWithPendingEdit).previousVersions ?? []),
      {
        reason: 'strategy_replacement',
        replacedAt: new Date().toISOString(),
        semanticState: input.previous,
      },
    ],
    updatedAt: new Date().toISOString(),
  }
}
```

- [ ] **Step 4: Handle replacement in conversation service**

In `continueWithSemanticEditDecision()`, before `APPLY_TO_SEMANTIC_STATE`, add:

```ts
    if (decision.kind === 'REPLACE_STRATEGY_DRAFT') {
      const seedState = this.createEmptySemanticState()
      const plan = await this.planConversationByLlm(decision.seedText, seedState, {
        providerCode: this.resolveProviderCode(dto.providerCode),
        model: dto.model,
      }, [])
      const plannedState = this.applyConversationPlanToSemanticState({
        currentState: seedState,
        plan,
      })
      const nextState = buildReplacementSemanticState({
        previous: currentSemanticState,
        next: plannedState,
      })
      const semanticArtifacts = this.resolveSemanticClarificationArtifacts(nextState)
      await this.sessionsRepo.updateSession(session.id, this.stateMachine.buildConversationUpdate({
        status: semanticArtifacts.clarificationState.status === 'CLEAR' ? 'CONFIRM_GATE' : 'DRAFTING',
        semanticState: nextState,
        clarificationState: semanticArtifacts.clarificationState,
        constraintPack: this.readConstraintPack(session.constraintPack),
      }))
      const response = this.finalizeSessionResponse({
        id: session.id,
        status: semanticArtifacts.clarificationState.status === 'CLEAR' ? 'CONFIRM_GATE' : 'DRAFTING',
        missingFields: [],
        assistantPrompt: plan.assistantPrompt || '我已按你的新描述重新创建策略草稿，请继续补充缺失语义。',
        clarificationState: semanticArtifacts.clarificationState,
      })
      return this.returnPersistedSessionResponse(session.id, sessionUserId, response)
    }
```

Import:

```ts
import { buildReplacementSemanticState, withPendingSemanticEdit } from '../types/semantic-edit'
```

- [ ] **Step 5: Run tests and confirm pass**

Run:

```bash
dx test unit quantify
```

Expected: PASS.

- [ ] **Step 6: Commit replacement flow**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/semantic-edit.ts apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -F - <<'MSG'
feat: support full strategy replacement drafts

Refs: #904
MSG
```

## Task 7: Cover Strategy Plaza and Published Edit Regression

**Files:**
- Modify: `apps/quantify/src/modules/strategy-plaza/services/strategy-plaza-edit-session.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

- [ ] **Step 1: Add plaza shared-path assertion**

Extend `strategy-plaza-edit-session.service.spec.ts` with:

```ts
  it('does not create a strategy-plaza-specific edit path', async () => {
    const template = {
      id: 'rsi',
      editSeed: {
        initialMessage: 'Build an RSI strategy',
        guideConfig: { symbolExample: 'BTCUSDT', timeframeExample: '1h' },
      },
    }
    const templates = { getRequired: jest.fn().mockReturnValue(template) }
    const codegenConversationService = { startSession: jest.fn().mockResolvedValue({ id: 'session-rsi' }) }
    const service = new StrategyPlazaEditSessionService(
      templates as never,
      codegenConversationService as never,
    )

    await service.startEditSession({ userId: 'u1', templateId: 'rsi' })

    expect(codegenConversationService.startSession).toHaveBeenCalledWith({
      initialMessage: 'Build an RSI strategy',
      guideConfig: { symbolExample: 'BTCUSDT', timeframeExample: '1h' },
    }, 'u1')
  })
```

- [ ] **Step 2: Add published edit regression**

Append to `codegen-conversation.service.spec.ts`:

```ts
it('keeps published snapshot untouched when user edits published strategy', async () => {
  mockRepo.findLatestBySessionId.mockResolvedValue({
    id: 'snapshot-old',
    specSnapshot: { old: true },
    consistencyReport: { status: 'PASSED' },
    paramsSnapshot: { symbol: 'ETHUSDT' },
    lockedParams: { symbol: 'ETHUSDT' },
  })
  mockRepo.findById.mockResolvedValue(buildLegacyChecklistBridgeSessionFixture({
    id: 's-published-edit-symbol',
    userId: 'u1',
    status: 'PUBLISHED',
    semanticState: buildLockedMaSemanticState(),
    clarificationState: { status: 'CLEAR', items: [] },
    constraintPack: {},
    latestDraftCode: 'return oldSignal',
    latestSpecDesc: { old: true },
  }))

  const result = await service.continueSession('s-published-edit-symbol', {
    userId: 'u1',
    message: '把交易标的改成 BTCUSDT',
  })

  expect(result.status).toBe('CONFIRM_GATE')
  expect(mockRepo.findLatestBySessionId).not.toHaveBeenCalledWith('delete-or-overwrite')
  const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
  expect(updatePayload.semanticState.contextSlots.symbol.value).toBe('BTCUSDT')
})
```

- [ ] **Step 3: Run tests and confirm pass**

Run:

```bash
dx test unit quantify
```

Expected: PASS.

- [ ] **Step 4: Commit regressions**

```bash
git add apps/quantify/src/modules/strategy-plaza/services/strategy-plaza-edit-session.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -F - <<'MSG'
test: cover semantic edit plaza and published flows

Refs: #904
MSG
```

## Task 8: Final Verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run focused unit suite**

Run:

```bash
dx test unit quantify
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
dx lint
```

Expected: PASS.

- [ ] **Step 3: Run quantify build**

Run:

```bash
dx build quantify --dev
```

Expected: PASS.

- [ ] **Step 4: Inspect git diff**

Run:

```bash
git diff --stat HEAD~7..HEAD
```

Expected: shows only semantic edit code, tests, and module registration for Issue #904.

- [ ] **Step 5: Final commit if verification fixes were needed**

If Step 1, Step 2, or Step 3 required fixes, commit them:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen apps/quantify/src/modules/strategy-plaza
git commit -F - <<'MSG'
fix: stabilize semantic edit verification

Refs: #904
MSG
```

If no fixes were needed, do not create an empty commit.

## Self-Review

- Spec coverage: Tasks 1-4 cover semantic edit and pending edit; Task 5 covers codegen integration; Task 6 covers strategy replacement; Task 7 covers strategy plaza and published edit; Task 8 covers verification.
- Placeholder scan: every task has concrete files, commands, expected outcomes, and code snippets.
- Type consistency: `SemanticEditDecision`, `SemanticEditPatch`, `PendingSemanticEdit`, `SemanticStateWithPendingEdit`, and helper names are introduced before use.
