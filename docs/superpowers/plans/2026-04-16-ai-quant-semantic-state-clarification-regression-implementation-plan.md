# AI Quant Semantic-State Clarification Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 `#800` 后 semanticState-first 主线导致的 clarification 回归，恢复 `#794` 已建立的 open-semantic-slot-first 行为，并用均线案例锁死回归基线。

**Architecture:** 本次实现不新增主数据流，也不改写 `#794` 的 priority 规则。修复聚焦于现有 session authoritative state 链路中的两个问题：一是 open semantic slots 在 `semanticState` 构建、合并与投影过程中的存活；二是 semantic slot 存活时，clarification 继续由 slot 驱动，而不是被 execution context 或 generic checklist fallback 抢走。

**Tech Stack:** NestJS, TypeScript, Prisma JSON session state, Jest, AI Quant `llm-strategy-codegen` services under `apps/quantify/src/modules/llm-strategy-codegen`, docs under `docs/superpowers`

---

### Task 1: Lock the MA clarification regression with failing tests

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

- [ ] **Step 1: Add the failing `startSession` regression test for MA slot-first clarification**

```ts
// apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
it('asks the MA semantic slot before execution context on startSession for the historical MA baseline', async () => {
  mockRepo.createSession.mockResolvedValue({ id: 's-ma-baseline-start' })
  mockAi.chat.mockResolvedValue({
    content: JSON.stringify({
      related: true,
      logicReady: false,
      logic: {},
      assistantPrompt: '逻辑图仍未完整，请继续补充。',
    }),
  })

  const result = await service.startSession({
    userId: 'u-1',
    initialMessage: '当价格突破一条长期均线时买入，跌破短期均线时卖出',
  })

  expect(result.status).toBe('DRAFTING')
  expect(result.assistantPrompt).toContain('长期均线是多少')
  expect(result.assistantPrompt).not.toContain('请确认交易所')
  expect(mockRepo.createSession).toHaveBeenCalledWith(expect.objectContaining({
    semanticState: expect.objectContaining({
      triggers: expect.arrayContaining([
        expect.objectContaining({
          key: 'indicator.above',
          openSlots: expect.arrayContaining([
            expect.objectContaining({
              slotKey: 'reference.period.entry',
              status: 'open',
              questionHint: '长期均线是多少？',
            }),
          ]),
        }),
      ]),
    }),
    clarificationState: expect.objectContaining({
      status: 'NEEDS_CLARIFICATION',
      items: expect.arrayContaining([
        expect.objectContaining({
          key: 'semantic.reference.period.entry',
          question: '长期均线是多少？',
          status: 'pending',
        }),
      ]),
    }),
  }))
})
```

- [ ] **Step 2: Add the failing lifecycle regression test that keeps semantic slots ahead of context after one answer**

```ts
// apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
it('keeps the next semantic slot active after locking MA50 instead of falling through to execution context', async () => {
  mockRepo.findById.mockResolvedValue({
    id: 's-ma-baseline-continue',
    userId: 'u1',
    status: 'DRAFTING',
    checklist: {
      entryRules: ['价格突破一条长期均线时买入'],
      exitRules: ['跌破短期均线时卖出'],
    },
    semanticState: {
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'entry-ma',
          key: 'indicator.above',
          phase: 'entry',
          params: { indicator: 'ma', referenceRole: 'long_term' },
          status: 'open',
          source: 'user_explicit',
          openSlots: [
            {
              slotKey: 'reference.period.entry',
              fieldPath: 'triggers[0].params.reference.period',
              status: 'open',
              priority: 'core',
              questionHint: '长期均线是多少？',
              affectsExecution: true,
            },
            {
              slotKey: 'confirmationMode.entry',
              fieldPath: 'triggers[0].params.confirmationMode',
              status: 'open',
              priority: 'core',
              questionHint: '突破按收盘确认还是盘中触发？',
              affectsExecution: true,
            },
          ],
        },
        {
          id: 'exit-ma',
          key: 'indicator.below',
          phase: 'exit',
          params: { indicator: 'ma', referenceRole: 'short_term' },
          status: 'open',
          source: 'user_explicit',
          openSlots: [
            {
              slotKey: 'reference.period.exit',
              fieldPath: 'triggers[1].params.reference.period',
              status: 'open',
              priority: 'core',
              questionHint: '短期均线是多少？',
              affectsExecution: true,
            },
          ],
        },
      ],
      actions: [],
      risk: [],
      position: null,
      contextSlots: {
        exchange: {
          slotKey: 'exchange',
          fieldPath: 'contextSlots.exchange',
          status: 'open',
          priority: 'context',
          questionHint: '请确认交易所（binance / okx / hyperliquid）。',
          affectsExecution: true,
        },
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-16T10:00:00.000Z',
    },
    clarificationState: {
      status: 'NEEDS_CLARIFICATION',
      items: [
        {
          key: 'semantic.reference.period.entry',
          reason: 'missing_entry_rules',
          field: 'entryRules',
          blocking: true,
          question: '长期均线是多少？',
          status: 'pending',
          slotKey: 'reference.period.entry',
          fieldPath: 'triggers[0].params.reference.period',
        },
      ],
    },
    constraintPack: {},
  })
  mockAi.chat.mockResolvedValue({
    content: JSON.stringify({
      related: false,
      logicReady: false,
      assistantPrompt: '这条消息和策略无关，请继续描述交易逻辑。',
    }),
  })

  const result = await service.continueSession('s-ma-baseline-continue', {
    userId: 'u1',
    message: 'MA50',
    clarificationAnswers: {
      'semantic.reference.period.entry': 'MA50',
    },
  } as ContinueCodegenSessionDto)

  expect(result.assistantPrompt).toContain('突破按收盘确认还是盘中触发')
  expect(result.assistantPrompt).not.toContain('请确认交易所')
  expect(result.assistantPrompt).not.toContain('长期均线是多少')
})
```

- [ ] **Step 3: Run the targeted conversation regression tests and confirm they fail**

Run:

```bash
dx test unit quantify codegen-conversation.service.spec.ts -- --runInBand -t "asks the MA semantic slot before execution context on startSession for the historical MA baseline|keeps the next semantic slot active after locking MA50 instead of falling through to execution context"
```

Expected: FAIL because the current semantic-state-first flow either does not keep the MA slots alive on `startSession`, or lets execution-context clarification overtake the remaining semantic slot after the first answer.

- [ ] **Step 4: Commit the failing regression tests**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -m "test: lock MA clarification regression baseline"
```

### Task 2: Repair semantic-state slot survival across build, merge, and normalization

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

- [ ] **Step 1: Add a focused failing service test for semantic-state projection keeping MA semantics stronger than generic checklist fallback**

```ts
// apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
it('keeps semantic MA rules when projectLegacyChecklistFromSemanticState projects over generic checklist placeholders', () => {
  const projected = (service as any).projectLegacyChecklistFromSemanticState({
    version: 1,
    families: ['single-leg'],
    triggers: [
      {
        id: 'entry-ma',
        key: 'indicator.above',
        phase: 'entry',
        params: {
          indicator: 'ma',
          referenceRole: 'long_term',
          'reference.period': 50,
        },
        status: 'open',
        source: 'user_explicit',
        openSlots: [
          {
            slotKey: 'confirmationMode.entry',
            fieldPath: 'triggers[0].params.confirmationMode',
            status: 'open',
            priority: 'core',
            questionHint: '突破按收盘确认还是盘中触发？',
            affectsExecution: true,
          },
        ],
      },
    ],
    actions: [],
    risk: [],
    position: null,
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-04-16T10:00:00.000Z',
  }, {
    entryRules: ['满足入场条件后开仓'],
    exitRules: ['满足出场条件后平仓'],
  })

  expect(projected.entryRules).toEqual(expect.arrayContaining([
    expect.stringContaining('长期均线'),
  ]))
  expect(projected.entryRules).not.toEqual(expect.arrayContaining([
    '满足入场条件后开仓',
  ]))
})
```

- [ ] **Step 2: Run the focused projection test and confirm it fails**

Run:

```bash
dx test unit quantify codegen-conversation.service.spec.ts -- --runInBand -t "keeps semantic MA rules when projectLegacyChecklistFromSemanticState projects over generic checklist placeholders"
```

Expected: FAIL because the current projection/merge path still allows weaker fallback checklist text to suppress or replace stronger MA semantics.

- [ ] **Step 3: Make the minimal implementation changes to keep semantic slots and stronger semantic projections alive**

```ts
// apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts
private mergeChecklistIntoSemanticState(
  currentState: SemanticState,
  checklist: ChecklistPayload,
): SemanticState {
  const derivedState = this.buildFallbackSemanticState(checklist)
  const nextTriggers = derivedState.triggers.map(trigger => this.reconcileDerivedTriggerState(
    trigger,
    derivedState.triggers,
    currentState,
  ))

  return {
    ...derivedState,
    triggers: nextTriggers,
    updatedAt: new Date().toISOString(),
  }
}

private reconcileDerivedTriggerState(
  trigger: SemanticTriggerState,
  derivedTriggers: SemanticTriggerState[],
  currentState: SemanticState,
): SemanticTriggerState {
  let nextTrigger: SemanticTriggerState = {
    ...trigger,
    params: { ...trigger.params },
    openSlots: trigger.openSlots.map(slot => ({ ...slot })),
  }

  const matchingCurrentTrigger = currentState.triggers.find(currentTrigger =>
    currentTrigger.phase === nextTrigger.phase
    && currentTrigger.key === nextTrigger.key
    && currentTrigger.status === 'open'
    && currentTrigger.openSlots.some(slot => slot.status === 'open'),
  )

  if (matchingCurrentTrigger) {
    nextTrigger = {
      ...nextTrigger,
      id: matchingCurrentTrigger.id,
      source: matchingCurrentTrigger.source ?? nextTrigger.source,
      ...(matchingCurrentTrigger.evidence ? { evidence: matchingCurrentTrigger.evidence } : {}),
      params: {
        ...nextTrigger.params,
        ...matchingCurrentTrigger.params,
      },
      openSlots: matchingCurrentTrigger.openSlots.map(slot => ({ ...slot })),
      status: matchingCurrentTrigger.status,
    }
  }

  return nextTrigger
}
```

```ts
// apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts
private projectLegacyChecklistFromSemanticState(
  state: SemanticState,
  fallbackChecklist: ChecklistPayload,
): ChecklistPayload {
  const semanticChecklist = this.semanticStateCompileBridge.buildLegacyChecklist(state, {
    ...fallbackChecklist,
    riskRules: fallbackChecklist.riskRules ? { ...fallbackChecklist.riskRules } : undefined,
    stateGates: fallbackChecklist.stateGates ? { ...fallbackChecklist.stateGates } : undefined,
  })

  return this.normalizeChecklist({
    ...fallbackChecklist,
    ...semanticChecklist,
    entryRules: this.mergeProjectedRuleArrays(
      fallbackChecklist.entryRules,
      semanticChecklist.entryRules,
      'entry',
    ),
    exitRules: this.mergeProjectedRuleArrays(
      fallbackChecklist.exitRules,
      semanticChecklist.exitRules,
      'exit',
    ),
    riskRules: semanticChecklist.riskRules ?? fallbackChecklist.riskRules,
    stateGates: semanticChecklist.stateGates ?? fallbackChecklist.stateGates,
    entryRuleDrafts: semanticChecklist.entryRuleDrafts ?? fallbackChecklist.entryRuleDrafts,
    exitRuleDrafts: semanticChecklist.exitRuleDrafts ?? fallbackChecklist.exitRuleDrafts,
  })
}

private mergeProjectedRuleArrays(
  fallbackRules: string[] | undefined,
  projectedRules: string[] | undefined,
  phase: 'entry' | 'exit',
): string[] | undefined {
  if (!projectedRules || projectedRules.length === 0) {
    return fallbackRules
  }
  if (!fallbackRules || fallbackRules.length === 0) {
    return projectedRules
  }

  const hasProjectedSpecificRule = projectedRules.some(rule => !this.isGenericChecklistPlaceholderRule(rule, phase))
  const preservedFallbackRules = fallbackRules.filter(rule => (
    !this.isSemanticProjectableRule(rule)
    && !(hasProjectedSpecificRule && this.isGenericChecklistPlaceholderRule(rule, phase))
  ))
  const merged = [...preservedFallbackRules]
  for (const projectedRule of projectedRules) {
    if (!merged.includes(projectedRule)) {
      merged.push(projectedRule)
    }
  }

  return merged
}
```

- [ ] **Step 4: Re-run the focused projection test and the MA baseline tests**

Run:

```bash
dx test unit quantify codegen-conversation.service.spec.ts -- --runInBand -t "keeps semantic MA rules when projectLegacyChecklistFromSemanticState projects over generic checklist placeholders"
```

Expected: PASS

- [ ] **Step 5: Re-run the full targeted three-test command as a boundary check**

Run:

```bash
dx test unit quantify codegen-conversation.service.spec.ts -- --runInBand -t "asks the MA semantic slot before execution context on startSession for the historical MA baseline|keeps the next semantic slot active after locking MA50 instead of falling through to execution context|keeps semantic MA rules when projectLegacyChecklistFromSemanticState projects over generic checklist placeholders"
```

Expected:
- the projection test PASSes
- the two lifecycle/ownership tests may still fail until Task 3 lands
- no new Task 3 behavior is added in order to make Task 2 appear green

- [ ] **Step 6: Commit the semantic-state survival fix**

```bash
git add \
  apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -m "fix: preserve MA semantic slots through semantic state projection"
```

### Task 3: Restore semantic-slot-first clarification ownership

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts`

- [ ] **Step 1: Add failing tests that prove semantic slots keep owning the current question while context remains open**

```ts
// apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts
it('prefers an open trigger slot over an open context slot', () => {
  const result = service.buildClarificationView({
    version: 1,
    families: ['single-leg'],
    triggers: [
      {
        id: 'entry-ma',
        key: 'indicator.above',
        phase: 'entry',
        params: {
          indicator: 'ma',
          referenceRole: 'long_term',
          'reference.period': 50,
        },
        status: 'open',
        source: 'user_explicit',
        openSlots: [
          {
            slotKey: 'confirmationMode.entry',
            fieldPath: 'triggers[0].params.confirmationMode',
            status: 'open',
            priority: 'core',
            questionHint: '突破按收盘确认还是盘中触发？',
            affectsExecution: true,
          },
        ],
      },
    ],
    actions: [],
    risk: [],
    position: null,
    contextSlots: {
      exchange: {
        slotKey: 'exchange',
        fieldPath: 'contextSlots.exchange',
        status: 'open',
        priority: 'context',
        questionHint: '请确认交易所（binance / okx / hyperliquid）。',
        affectsExecution: true,
      },
      symbol: null,
      marketType: null,
      timeframe: null,
    },
    normalizationNotes: [],
    updatedAt: '2026-04-16T10:00:00.000Z',
  })

  expect(result.nextQuestion).toBe('突破按收盘确认还是盘中触发？')
})
```

```ts
// apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
it('does not let a context clarification item overtake the active semantic slot in mergeSemanticClarificationState', () => {
  const result = (service as any).mergeSemanticClarificationState({
    version: 1,
    families: ['single-leg'],
    triggers: [
      {
        id: 'entry-ma',
        key: 'indicator.above',
        phase: 'entry',
        params: {
          indicator: 'ma',
          referenceRole: 'long_term',
          'reference.period': 50,
        },
        status: 'open',
        source: 'user_explicit',
        openSlots: [
          {
            slotKey: 'confirmationMode.entry',
            fieldPath: 'triggers[0].params.confirmationMode',
            status: 'open',
            priority: 'core',
            questionHint: '突破按收盘确认还是盘中触发？',
            affectsExecution: true,
          },
        ],
      },
    ],
    actions: [],
    risk: [],
    position: null,
    contextSlots: {
      exchange: {
        slotKey: 'exchange',
        fieldPath: 'contextSlots.exchange',
        status: 'open',
        priority: 'context',
        questionHint: '请确认交易所（binance / okx / hyperliquid）。',
        affectsExecution: true,
      },
      symbol: null,
      marketType: null,
      timeframe: null,
    },
    normalizationNotes: [],
    updatedAt: '2026-04-16T10:00:00.000Z',
  }, {
    status: 'NEEDS_CLARIFICATION',
    items: [
      {
        key: 'executionContext.exchange',
        reason: 'missing_exchange',
        field: 'exchange',
        blocking: true,
        question: '请确认交易所（binance / okx / hyperliquid）。',
        status: 'pending',
      },
    ],
    summary: '已识别部分条件，但仍未完整。',
  })

  expect(result.items[0]).toEqual(expect.objectContaining({
    key: 'semantic.confirmationMode.entry',
    question: '突破按收盘确认还是盘中触发？',
  }))
})
```

- [ ] **Step 2: Run the targeted clarification ownership tests and confirm they fail**

Run:

```bash
dx test unit quantify codegen-conversation.service.spec.ts semantic-state-projection.service.spec.ts -- --runInBand -t "prefers an open trigger slot over an open context slot|does not let a context clarification item overtake the active semantic slot in mergeSemanticClarificationState"
```

Expected: FAIL if the current composition path still lets context items or fallback ordering overtake the remaining semantic slot.

- [ ] **Step 3: Implement the minimal clarification ownership fix**

```ts
// apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts
private findNextOpenSlot(state: SemanticState): SemanticSlotState | null {
  const triggerSlots = state.triggers.flatMap(trigger => trigger.openSlots)
  const behaviorTriggerSlot = triggerSlots.find(slot =>
    slot.status === 'open' && (slot.priority === 'behavior' || slot.slotKey === 'regimeDefinition'),
  )
  if (behaviorTriggerSlot) {
    return behaviorTriggerSlot
  }

  const firstBlockingTriggerSlot = triggerSlots.find(slot => slot.status === 'open')
  if (firstBlockingTriggerSlot) {
    return firstBlockingTriggerSlot
  }

  const riskSlot = state.risk
    .flatMap(risk => risk.openSlots)
    .find(slot => slot.status === 'open')
  if (riskSlot) {
    return riskSlot
  }

  return Object.values(state.contextSlots).find(slot => slot?.status === 'open') ?? null
}
```

```ts
// apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts
private mergeSemanticClarificationState(
  semanticState: SemanticState,
  fallbackState: StrategyClarificationStateWithSummary,
): StrategyClarificationStateWithSummary {
  const clarificationView = this.semanticStateProjection.buildClarificationView(semanticState)
  const nextOpenSlot = this.findNextOpenSemanticSlot(semanticState)
  if (!clarificationView.nextQuestion || !nextOpenSlot) {
    const pendingFallbackItems = fallbackState.status === 'NEEDS_CLARIFICATION'
      ? fallbackState.items.filter(item => item.blocking && item.status === 'pending')
      : []
    const preservedFallbackItems = pendingFallbackItems.filter(item =>
      !this.isSemanticClarificationItem(item)
      && !this.isResolvedBySemanticState(item, semanticState),
    )
    return preservedFallbackItems.length > 0
      ? {
          status: 'NEEDS_CLARIFICATION',
          items: preservedFallbackItems,
          summary: fallbackState.summary || clarificationView.summary || null,
        }
      : {
          status: 'CLEAR',
          items: [],
          summary: clarificationView.summary || fallbackState.summary || null,
        }
  }

  const items = fallbackState.status === 'NEEDS_CLARIFICATION'
    ? [...fallbackState.items]
    : []
  const targetIndex = items.findIndex(item =>
    item.blocking
    && item.status === 'pending'
    && this.isSameClarificationQuestion(item.question, clarificationView.nextQuestion as string),
  )

  if (targetIndex > 0) {
    const [targetItem] = items.splice(targetIndex, 1)
    if (targetItem) {
      items.unshift(targetItem)
    }
  } else if (targetIndex < 0) {
    items.unshift(this.buildSemanticClarificationItem(nextOpenSlot))
  }

  return {
    status: 'NEEDS_CLARIFICATION',
    items,
    summary: clarificationView.summary,
  }
}
```

- [ ] **Step 4: Run the full targeted regression suite**

Run:

```bash
dx test unit quantify codegen-conversation.service.spec.ts semantic-state-projection.service.spec.ts -- --runInBand -t "asks the MA semantic slot before execution context on startSession for the historical MA baseline|keeps the next semantic slot active after locking MA50 instead of falling through to execution context|keeps semantic MA rules when projectLegacyChecklistFromSemanticState projects over generic checklist placeholders|prefers an open trigger slot over an open context slot|does not let a context clarification item overtake the active semantic slot in mergeSemanticClarificationState"
```

Expected: PASS

- [ ] **Step 5: Run the broader safety net**

Run:

```bash
dx test unit quantify codegen-conversation.service.spec.ts semantic-state-projection.service.spec.ts -- --runInBand
```

Expected: PASS

- [ ] **Step 6: Commit the clarification ownership repair**

```bash
git add \
  apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts
git commit -m "fix: restore slot-first clarification ownership"
```

### Task 4: Verify regression boundaries and document evidence

**Files:**
- Modify: `docs/superpowers/specs/2026-04-16-ai-quant-semantic-state-clarification-regression-design.md`
- Modify: `docs/superpowers/plans/2026-04-16-ai-quant-semantic-state-clarification-regression-implementation-plan.md`

- [ ] **Step 1: Re-run the exact regression baseline only and capture the result**

Run:

```bash
dx test unit quantify codegen-conversation.service.spec.ts -- --runInBand -t "asks the MA semantic slot before execution context on startSession for the historical MA baseline|keeps the next semantic slot active after locking MA50 instead of falling through to execution context"
```

Expected: PASS with both regression-baseline tests green.

验证结果：PASS，2 passed / 0 failed。

- [ ] **Step 2: Update the spec note with implementation evidence**

```md
<!-- docs/superpowers/specs/2026-04-16-ai-quant-semantic-state-clarification-regression-design.md -->
## 13. Implementation Notes

- Regression baseline locked by backend tests in
  `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- Clarification ownership ordering locked by
  `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts`
```

- [ ] **Step 3: Commit the verification evidence**

```bash
git add \
  docs/superpowers/specs/2026-04-16-ai-quant-semantic-state-clarification-regression-design.md \
  docs/superpowers/plans/2026-04-16-ai-quant-semantic-state-clarification-regression-implementation-plan.md
git commit -m "docs: record clarification regression verification coverage"
```
