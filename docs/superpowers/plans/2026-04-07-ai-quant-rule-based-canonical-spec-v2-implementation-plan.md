# AI Quant Rule-Based Canonical Spec V2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade AI quant strategy generation to a rule-based canonical spec v2 that prevents multi-branch strategies from collapsing into incorrect scripts and blocks publishing for any non-v2 or semantically unprovable output.

**Architecture:** Introduce explicit rule-first canonical modeling, persistent clarification state, a validator that enforces rule invariants, prompt/protocol changes that carry side-aware rule semantics into generated code, and a rule-level consistency audit that gates publication. Keep the rollout scoped to first-wave strategy families but design reusable condition/action nodes so later families extend the same pipeline.

**Tech Stack:** NestJS, TypeScript, Prisma, Jest, Quantify E2E, GitHub issue workflow, shared `@ai/shared` strategy protocol.

---

## File Structure

### New files

- `apps/quantify/src/modules/llm-strategy-codegen/types/strategy-clarification.ts`
  Persisted clarification item types and session clarification state shape.
- `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec-v2.ts`
  Rule-based canonical spec v2 types, condition tree, rule actions, and invariants-friendly helpers.
- `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts`
  Detect missing rule action uniqueness, side scope ambiguity, and risk effect ambiguity.
- `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-question.service.ts`
  Turn the highest-priority clarification item into a one-sentence explanation plus one question.
- `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-validator.service.ts`
  Reject invalid rule combinations before code generation.
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-question.service.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-validator.service.spec.ts`
- `apps/quantify/prisma/schema/migrations/20260407160000_add_codegen_clarification_state/migration.sql`
  Add session clarification persistence.

### Modified files

- `apps/quantify/prisma/schema/llm_strategies.prisma`
  Add `clarificationState` to `LlmStrategyCodegenSession`.
- `apps/quantify/src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.ts`
  Read/write clarification state.
- `apps/quantify/src/modules/llm-strategy-codegen/dto/codegen-session.response.dto.ts`
  Return clarification state and/or next clarification prompt.
- `apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts`
  Register new services.
- `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec.ts`
  Slim down legacy types and re-export v2 entry points or mark v1 as historical-only.
- `apps/quantify/src/modules/llm-strategy-codegen/types/strategy-semantic-profile.ts`
  Add rule-level semantic profile shape for v2.
- `apps/quantify/src/modules/llm-strategy-codegen/types/strategy-consistency-report.ts`
  Extend audit report for rule-level mismatches.
- `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
  Build canonical spec v2 rules from checklist + clarified strategy meaning.
- `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
  Insert clarification gate before logic graph confirmation and block non-v2 publishing.
- `apps/quantify/src/modules/llm-strategy-codegen/services/spec-desc-builder.service.ts`
  Render rule-based logic graph/summary for confirmation.
- `apps/quantify/src/modules/llm-strategy-codegen/services/script-profile-extractor.service.ts`
  Extract rule-level mappings, side scope, phase, and action/effect from generated script.
- `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-consistency.service.ts`
  Compare canonical spec v2 to script profile at rule level.
- `apps/quantify/src/modules/llm-strategy-codegen/prompts/strategy-protocol-contract.prompt.ts`
  Emit the updated strategy protocol contract for side-aware actions.
- `apps/quantify/src/modules/llm-strategy-codegen/prompts/strategy-codegen-system.prompt.ts`
  Instruct generation from explicit rules rather than flattened text.
- `packages/shared/src/strategy-protocol.ts`
  Expand protocol actions and decision metadata needed by v2-aligned generation.
- `packages/shared/src/index.ts`
  Re-export any new shared strategy protocol types.
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/script-profile-extractor.service.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-consistency.service.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.spec.ts`
- `apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts`

## Task 1: Introduce Clarification State Persistence

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/types/strategy-clarification.ts`
- Create: `apps/quantify/prisma/schema/migrations/20260407160000_add_codegen_clarification_state/migration.sql`
- Modify: `apps/quantify/prisma/schema/llm_strategies.prisma`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/dto/codegen-session.response.dto.ts`

- [ ] **Step 1: Write the failing repository test for clarification state round-trip**

```ts
it('persists clarification state on codegen sessions', async () => {
  const row = await repository.createSession({
    userId: 'u-1',
    status: 'DRAFTING',
    checklist: {},
    clarificationState: {
      status: 'NEEDS_CLARIFICATION',
      items: [
        {
          key: 'rule.entry.upper_band.side_scope',
          reason: 'direction_ambiguous',
          question: '突破上轨时是只做空还是也允许做多？',
          status: 'pending',
        },
      ],
    },
  } as never)

  expect(row.clarificationState).toEqual({
    status: 'NEEDS_CLARIFICATION',
    items: [
      expect.objectContaining({
        key: 'rule.entry.upper_band.side_scope',
        status: 'pending',
      }),
    ],
  })
})
```

- [ ] **Step 2: Run the repository spec and verify it fails because the schema/repository do not expose `clarificationState` yet**

Run: `pnpm --filter @net/quantify exec jest --config ./jest-unit.json --runInBand --runTestsByPath src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.spec.ts`

Expected: FAIL with Prisma/repository type errors for missing `clarificationState`.

- [ ] **Step 3: Add the persistent shape**

```prisma
model LlmStrategyCodegenSession {
  id                 String                  @id @default(cuid())
  userId             String                  @map("user_id")
  strategyInstanceId String?                 @map("strategy_instance_id")
  status             LlmCodegenSessionStatus @default(DRAFTING)
  checklist          Json?
  clarificationState Json?                   @map("clarification_state")
  constraintPack     Json?                   @map("constraint_pack")
  latestDraftCode    String?                 @map("latest_draft_code") @db.Text
  latestSpecDesc     Json?                   @map("latest_spec_desc")
  rejectReason       String?                 @map("reject_reason")
  createdAt          DateTime                @default(now()) @map("created_at")
  updatedAt          DateTime                @default(now()) @updatedAt @map("updated_at")
}
```

```ts
export interface StrategyClarificationItem {
  key: string
  reason: 'missing_action_uniqueness' | 'missing_side_scope' | 'ambiguous_risk_effect' | 'ambiguous_condition_basis'
  ruleId?: string
  question: string
  status: 'pending' | 'answered'
  answer?: string
}

export interface StrategyClarificationState {
  status: 'CLEAR' | 'NEEDS_CLARIFICATION'
  items: StrategyClarificationItem[]
}
```

- [ ] **Step 4: Re-run the repository spec**

Run: `pnpm --filter @net/quantify exec jest --config ./jest-unit.json --runInBand --runTestsByPath src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.spec.ts`

Expected: PASS for clarification-state persistence assertions.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/prisma/schema/llm_strategies.prisma \
  apps/quantify/prisma/schema/migrations/20260407160000_add_codegen_clarification_state/migration.sql \
  apps/quantify/src/modules/llm-strategy-codegen/types/strategy-clarification.ts \
  apps/quantify/src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.ts \
  apps/quantify/src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/dto/codegen-session.response.dto.ts
git commit -m "feat: persist ai strategy clarification state" -m "Refs: #692"
```

### Task 2: Add Canonical Spec V2 Types And Validator

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec-v2.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-validator.service.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-validator.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts`

- [ ] **Step 1: Write validator tests for the two critical invariants**

```ts
it('rejects an entry rule that contains both OPEN_LONG and OPEN_SHORT', () => {
  const report = validator.validate({
    version: 2,
    rules: [
      {
        id: 'entry-1',
        phase: 'entry',
        sideScope: 'flat',
        priority: 200,
        condition: { kind: 'atom', key: 'bollinger.upper_break' },
        actions: [
          { type: 'OPEN_LONG', sizing: { mode: 'RATIO', value: 0.1 } },
          { type: 'OPEN_SHORT', sizing: { mode: 'RATIO', value: 0.1 } },
        ],
      },
    ],
  } as never)

  expect(report.status).toBe('INVALID')
  expect(report.errors).toContain('entry_rule_mutually_exclusive_open_actions')
})

it('rejects a side-sensitive risk rule without sideScope', () => {
  const report = validator.validate({
    version: 2,
    rules: [
      {
        id: 'risk-1',
        phase: 'risk',
        priority: 50,
        condition: { kind: 'atom', key: 'position_loss_pct', op: 'GTE', value: 0.05 },
        actions: [{ type: 'FORCE_EXIT' }],
      },
    ],
  } as never)

  expect(report.status).toBe('INVALID')
  expect(report.errors).toContain('rule_requires_side_scope')
})
```

- [ ] **Step 2: Run the validator spec and verify it fails before the service exists**

Run: `pnpm --filter @net/quantify exec jest --config ./jest-unit.json --runInBand --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-validator.service.spec.ts`

Expected: FAIL because `CanonicalSpecV2ValidatorService` and v2 types do not exist.

- [ ] **Step 3: Add v2 types and validator**

```ts
export type CanonicalRulePhase = 'entry' | 'exit' | 'risk' | 'rebalance'
export type CanonicalRuleSideScope = 'long' | 'short' | 'both' | 'flat'

export interface CanonicalConditionAtom {
  kind: 'atom'
  key: string
  op?: 'EQ' | 'LTE' | 'GTE' | 'CROSS_OVER' | 'CROSS_UNDER'
  value?: number | string | boolean
  params?: Record<string, number | string | boolean>
}

export interface CanonicalConditionGroup {
  kind: 'AND' | 'OR' | 'NOT'
  children: CanonicalConditionNode[]
}

export type CanonicalConditionNode = CanonicalConditionAtom | CanonicalConditionGroup
```

```ts
if (rule.phase === 'entry' && openActions.includes('OPEN_LONG') && openActions.includes('OPEN_SHORT')) {
  errors.push('entry_rule_mutually_exclusive_open_actions')
}
if (this.requiresSideScope(rule) && !rule.sideScope) {
  errors.push('rule_requires_side_scope')
}
```

- [ ] **Step 4: Re-run the validator spec**

Run: `pnpm --filter @net/quantify exec jest --config ./jest-unit.json --runInBand --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-validator.service.spec.ts`

Expected: PASS with explicit invalid-state assertions.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec-v2.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-validator.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-validator.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts
git commit -m "feat: add canonical strategy spec v2 validator" -m "Refs: #692"
```

### Task 3: Add Clarification Rule Detection Before Logic Confirmation

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-question.service.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-question.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts`

- [ ] **Step 1: Write failing conversation tests for one-question clarification**

```ts
it('stays in DRAFTING when an entry rule can resolve to both OPEN_LONG and OPEN_SHORT', async () => {
  const result = await service.startSession({
    userId: 'u-1',
    initialMessage: '在BTCUSDT 15分钟图上，突破布林带上轨交易，仓位10%',
  })

  expect(result.status).toBe('DRAFTING')
  expect(result.assistantPrompt).toContain('当前这条规则还缺少方向约束')
  expect(result.assistantPrompt).toContain('是只做空，还是也允许做多')
})
```

```ts
it('asks only the highest-priority unresolved clarification question', () => {
  const prompt = questionService.build({
    status: 'NEEDS_CLARIFICATION',
    items: [
      { key: 'risk.effect', reason: 'ambiguous_risk_effect', question: '轨外3根时是全平还是减仓？', status: 'pending' },
      { key: 'entry.side', reason: 'missing_side_scope', question: '突破上轨时是只做空还是也允许做多？', status: 'pending' },
    ],
  })

  expect(prompt).toContain('缺少方向约束')
  expect(prompt).toContain('突破上轨时是只做空还是也允许做多')
  expect(prompt).not.toContain('轨外3根时是全平还是减仓')
})
```

- [ ] **Step 2: Run the clarification and conversation specs**

Run: `pnpm --filter @net/quantify exec jest --config ./jest-unit.json --runInBand --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-question.service.spec.ts src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

Expected: FAIL because clarification services and integration do not exist.

- [ ] **Step 3: Implement rule detection and one-question prompt generation**

```ts
if (this.couldProduceMutuallyExclusiveOpenActions(ruleDraft)) {
  items.push({
    key: 'rule.entry.side_scope',
    reason: 'missing_side_scope',
    question: '突破布林带上轨时，你是只做空，还是也允许做多？',
    status: 'pending',
  })
}
```

```ts
return [
  '当前这条规则还缺少方向约束，否则会产生两种不同脚本。',
  highestPriorityItem.question,
].join('')
```

- [ ] **Step 4: Integrate clarification state into session flow**

```ts
if (clarificationState.status === 'NEEDS_CLARIFICATION') {
  await this.sessionsRepo.updateSession(session.id, {
    status: 'DRAFTING',
    clarificationState: clarificationState as never,
  })

  return {
    id: session.id,
    status: 'DRAFTING',
    assistantPrompt: this.strategyClarificationQuestion.build(clarificationState),
    clarificationState,
  }
}
```

- [ ] **Step 5: Re-run the same specs**

Run: `pnpm --filter @net/quantify exec jest --config ./jest-unit.json --runInBand --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-question.service.spec.ts src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

Expected: PASS for DRAFTING-state clarification gating and single-question behavior.

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-question.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-question.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts
git commit -m "feat: gate ai strategies on rule clarification" -m "Refs: #692"
```

### Task 4: Build Canonical Spec V2 Rules And Rule-Based Spec Description

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/spec-desc-builder.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/spec-desc-builder.service.spec.ts`

- [ ] **Step 1: Write failing builder tests for rule splitting**

```ts
it('builds independent Bollinger rules for upper-short, lower-long, middle-close, and outside-band full close', () => {
  const spec = builder.build({
    symbols: ['BTCUSDT'],
    timeframes: ['15m'],
    entryRules: ['突破布林带上轨做空', '突破布林带下轨做多'],
    exitRules: ['价格回到布林带中轨平仓'],
    riskRules: {
      stopLossPct: 5,
      earlyStop: '价格连续3根K线在轨外时提前全平',
      positionPct: 10,
    },
  })

  expect(spec.version).toBe(2)
  expect(spec.rules).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ phase: 'entry', sideScope: 'short' }),
      expect.objectContaining({ phase: 'entry', sideScope: 'long' }),
      expect.objectContaining({ phase: 'risk', actions: [expect.objectContaining({ type: 'FORCE_EXIT' })] }),
    ]),
  )
})
```

- [ ] **Step 2: Run builder/spec-desc specs**

Run: `pnpm --filter @net/quantify exec jest --config ./jest-unit.json --runInBand --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts src/modules/llm-strategy-codegen/services/__tests__/spec-desc-builder.service.spec.ts`

Expected: FAIL because the builder still emits flattened v1 semantics.

- [ ] **Step 3: Update the builder to emit explicit rules**

```ts
rules.push({
  id: 'entry-boll-upper-short',
  phase: 'entry',
  sideScope: 'short',
  priority: 200,
  condition: { kind: 'atom', key: 'bollinger.upper_break' },
  actions: [{ type: 'OPEN_SHORT', sizing: { mode: 'RATIO', value: 0.1 } }],
})
```

```ts
rules.push({
  id: 'risk-boll-outside-force-exit',
  phase: 'risk',
  sideScope: 'both',
  priority: 50,
  condition: { kind: 'atom', key: 'bollinger.bars_outside', op: 'GTE', value: 3 },
  actions: [{ type: 'FORCE_EXIT' }],
})
```

- [ ] **Step 4: Render rule-based confirmation text**

```ts
return {
  version: 2,
  rules: spec.rules.map(rule => ({
    id: rule.id,
    phase: rule.phase,
    sideScope: rule.sideScope,
    summary: this.describeRule(rule),
  })),
}
```

- [ ] **Step 5: Re-run the builder/spec-desc specs**

Run: `pnpm --filter @net/quantify exec jest --config ./jest-unit.json --runInBand --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts src/modules/llm-strategy-codegen/services/__tests__/spec-desc-builder.service.spec.ts`

Expected: PASS with explicit rule-based summaries.

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/spec-desc-builder.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/spec-desc-builder.service.spec.ts
git commit -m "feat: build rule-based canonical strategy specs" -m "Refs: #692"
```

### Task 5: Upgrade Shared Strategy Protocol And Codegen Prompt Contract

**Files:**
- Modify: `packages/shared/src/strategy-protocol.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/prompts/strategy-protocol-contract.prompt.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/prompts/strategy-codegen-system.prompt.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/strategy-protocol-contract-prompt.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/strategy-codegen-system-prompt.spec.ts`

- [ ] **Step 1: Write failing prompt contract tests for side-aware actions**

```ts
it('includes force-exit and reduce actions in the generated protocol contract', () => {
  const prompt = buildStrategyProtocolTypeContractPrompt()
  expect(prompt).toContain("type StrategyAction = 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT' | 'REDUCE_LONG' | 'REDUCE_SHORT' | 'FORCE_EXIT' | 'BLOCK_NEW_ENTRY' | 'NOOP'")
})
```

- [ ] **Step 2: Run the prompt tests**

Run: `pnpm --filter @net/quantify exec jest --config ./jest-unit.json --runInBand --runTestsByPath src/modules/llm-strategy-codegen/prompts/__tests__/strategy-protocol-contract-prompt.spec.ts src/modules/llm-strategy-codegen/prompts/__tests__/strategy-codegen-system-prompt.spec.ts`

Expected: FAIL because the shared protocol and prompt fallback still expose the old action list.

- [ ] **Step 3: Expand the shared protocol and prompt fallback**

```ts
export type StrategyAction =
  | 'OPEN_LONG'
  | 'OPEN_SHORT'
  | 'CLOSE_LONG'
  | 'CLOSE_SHORT'
  | 'REDUCE_LONG'
  | 'REDUCE_SHORT'
  | 'FORCE_EXIT'
  | 'BLOCK_NEW_ENTRY'
  | 'NOOP'
```

```ts
'3) side-sensitive action must match the canonical rule sideScope; do not emit both directions from one rule.',
'4) risk rules that require full exit must use FORCE_EXIT instead of reduce semantics.',
```

- [ ] **Step 4: Re-run the prompt tests**

Run: `pnpm --filter @net/quantify exec jest --config ./jest-unit.json --runInBand --runTestsByPath src/modules/llm-strategy-codegen/prompts/__tests__/strategy-protocol-contract-prompt.spec.ts src/modules/llm-strategy-codegen/prompts/__tests__/strategy-codegen-system-prompt.spec.ts`

Expected: PASS with updated action contract assertions.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/strategy-protocol.ts \
  packages/shared/src/index.ts \
  apps/quantify/src/modules/llm-strategy-codegen/prompts/strategy-protocol-contract.prompt.ts \
  apps/quantify/src/modules/llm-strategy-codegen/prompts/strategy-codegen-system.prompt.ts \
  apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/strategy-protocol-contract-prompt.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/strategy-codegen-system-prompt.spec.ts
git commit -m "feat: align strategy prompt contract with canonical v2 rules" -m "Refs: #692"
```

### Task 6: Implement Rule-Level Script Profiling And Consistency Audit

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/strategy-semantic-profile.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/strategy-consistency-report.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/script-profile-extractor.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-consistency.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/script-profile-extractor.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-consistency.service.spec.ts`

- [ ] **Step 1: Write failing audit tests for full-close vs reduce mismatch**

```ts
it('fails when canonical FORCE_EXIT is implemented as REDUCE_SHORT', () => {
  const report = consistency.evaluate({
    canonicalSpec: {
      version: 2,
      rules: [
        {
          id: 'risk-outside',
          phase: 'risk',
          sideScope: 'short',
          priority: 50,
          condition: { kind: 'atom', key: 'bollinger.bars_outside', op: 'GTE', value: 3 },
          actions: [{ type: 'FORCE_EXIT' }],
        },
      ],
    } as never,
    scriptCode: `
      const strategy = {
        protocolVersion: 'v1',
        onBar() {
          return { action: 'REDUCE_SHORT', size: { mode: 'RATIO', value: 0.5 } }
        },
      }
      strategy
    `,
  })

  expect(report.status).toBe('FAILED')
  expect(report.checks.some(check => String(check.message).includes('FORCE_EXIT'))).toBe(true)
})
```

- [ ] **Step 2: Run script profile and consistency specs**

Run: `pnpm --filter @net/quantify exec jest --config ./jest-unit.json --runInBand --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/script-profile-extractor.service.spec.ts src/modules/llm-strategy-codegen/services/__tests__/strategy-consistency.service.spec.ts`

Expected: FAIL because the extractor and audit only understand flattened indicator/action mappings.

- [ ] **Step 3: Add v2 profile extraction**

```ts
export interface StrategySemanticRuleProfile {
  key: string
  phase: 'entry' | 'exit' | 'risk' | 'rebalance'
  sideScope: 'long' | 'short' | 'both' | 'flat'
  action: string
}
```

```ts
if (/FORCE_EXIT/.test(scriptCode) && /bars_outside/i.test(window)) {
  rules.push({
    key: 'bollinger.bars_outside',
    phase: 'risk',
    sideScope: this.inferSideScope(window),
    action: 'FORCE_EXIT',
  })
}
```

- [ ] **Step 4: Compare v2 canonical rules to script rules**

```ts
const actualRule = scriptProfile.rules.find(item => item.key === expectedRule.key && item.phase === expectedRule.phase)
if (!actualRule) missing.push(expectedRule.key)
else if (actualRule.action !== expectedRule.action) mismatched.push(`${expectedRule.key}:${actualRule.action}`)
```

- [ ] **Step 5: Re-run the same specs**

Run: `pnpm --filter @net/quantify exec jest --config ./jest-unit.json --runInBand --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/script-profile-extractor.service.spec.ts src/modules/llm-strategy-codegen/services/__tests__/strategy-consistency.service.spec.ts`

Expected: PASS with explicit failures for reduced-vs-force-exit mismatches and side-scope drift.

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/strategy-semantic-profile.ts \
  apps/quantify/src/modules/llm-strategy-codegen/types/strategy-consistency-report.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/script-profile-extractor.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/strategy-consistency.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/script-profile-extractor.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-consistency.service.spec.ts
git commit -m "feat: audit ai strategies at rule level" -m "Refs: #692"
```

### Task 7: Block Non-V2 Publishing And Add First-Wave Regression Coverage

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- Modify: `apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts`

- [ ] **Step 1: Write failing publication tests for non-v2 and unprovable outputs**

```ts
it('marks the session consistency failed when canonical spec version is not 2', async () => {
  mockCanonicalSpecBuilder.build.mockReturnValue({ version: 1 } as never)

  const result = await service.continueSession('s-1', {
    userId: 'u-1',
    confirmGenerate: true,
    message: '确认生成',
  })

  await waitForTerminalStatus('s-1')
  expect(result.status).not.toBe('PUBLISHED')
})
```

```ts
it('keeps a Bollinger strategy in DRAFTING until side scope and risk effect are clarified', async () => {
  const first = await request(app.getHttpServer())
    .post('/live-llm-strategy-codegen/sessions')
    .send({ userId: 'u-1', initialMessage: '在BTCUSDT 15分钟图上，突破布林带上轨交易，价格连续3根K线在轨外时提前处理' })

  expect(first.body.status).toBe('DRAFTING')
  expect(first.body.assistantPrompt).toContain('只做空')
})
```

- [ ] **Step 2: Run conversation unit tests and E2E**

Run: `pnpm --filter @net/quantify exec jest --config ./jest-unit.json --runInBand --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

Run: `dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts`

Expected: unit test FAILS before the publication gate is tightened; E2E either FAILS on behavior or remains blocked by local DB permissions and must be rerun in the first environment with database-create access.

- [ ] **Step 3: Block non-v2 and failed audit results**

```ts
if (canonicalSpec.version !== 2) {
  await this.sessionsRepo.updateSession(session.id, {
    status: 'CONSISTENCY_FAILED',
    rejectReason: 'canonical_spec_v2_required_for_publication',
  })
  return
}

if (consistencyReport.status !== 'PASSED') {
  await this.sessionsRepo.updateSession(session.id, {
    status: 'CONSISTENCY_FAILED',
    rejectReason: this.buildConsistencyRejectReason(consistencyReport),
  })
  return
}
```

- [ ] **Step 4: Add first-wave regression cases**

```ts
const scenarios = [
  'bollinger upper-short lower-long with outside-band full close',
  'grid touch-buy upper-grid sell fixed-price spacing',
  'ma golden-cross long dead-cross short',
  'rsi oversold long overbought short',
  'range breakout long breakdown short',
]
```

- [ ] **Step 5: Re-run conversation unit test, targeted type-check, and E2E where environment allows**

Run: `pnpm --filter @net/quantify exec jest --config ./jest-unit.json --runInBand --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

Run: `pnpm --filter @net/quantify exec tsc --project tsconfig.json --noEmit`

Run: `dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts`

Expected: unit tests PASS, `tsc` PASS, E2E PASS in an environment that has the required PostgreSQL permissions and correct Node/Prisma compatibility.

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts \
  apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts
git commit -m "feat: block ai strategy publication without canonical v2 fidelity" -m "Refs: #692"
```

## Final Verification

- [ ] **Step 1: Run the focused unit suite**

Run:

```bash
pnpm --filter @net/quantify exec jest --config ./jest-unit.json --runInBand --runTestsByPath \
  src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.spec.ts \
  src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts \
  src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-question.service.spec.ts \
  src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-validator.service.spec.ts \
  src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts \
  src/modules/llm-strategy-codegen/services/__tests__/spec-desc-builder.service.spec.ts \
  src/modules/llm-strategy-codegen/services/__tests__/script-profile-extractor.service.spec.ts \
  src/modules/llm-strategy-codegen/services/__tests__/strategy-consistency.service.spec.ts \
  src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts \
  src/modules/llm-strategy-codegen/prompts/__tests__/strategy-protocol-contract-prompt.spec.ts \
  src/modules/llm-strategy-codegen/prompts/__tests__/strategy-codegen-system-prompt.spec.ts
```

Expected: PASS across clarification, canonical v2, prompt contract, audit, and publication gating.

- [ ] **Step 2: Run project type-check**

Run: `pnpm --filter @net/quantify exec tsc --project tsconfig.json --noEmit`

Expected: PASS.

- [ ] **Step 3: Run the Quantify E2E file in a DB-capable environment**

Run: `dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts`

Expected: PASS for clarification-round trips and first-wave strategy-family regressions.

- [ ] **Step 4: Create the integration commit**

```bash
git add packages/shared/src/strategy-protocol.ts \
  packages/shared/src/index.ts \
  apps/quantify/prisma/schema/llm_strategies.prisma \
  apps/quantify/prisma/schema/migrations/20260407160000_add_codegen_clarification_state/migration.sql \
  apps/quantify/src/modules/llm-strategy-codegen \
  apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts
git commit -m "feat: add rule-based ai quant canonical spec v2" -m "Refs: #692"
```

## Spec Coverage Check

- Clarification gate before logic confirmation: covered by Task 3 and Task 7.
- Canonical spec v2 rule model and invariants: covered by Task 2 and Task 4.
- Prompt/compiler contract alignment: covered by Task 5.
- Rule-level consistency audit and publication gate: covered by Task 6 and Task 7.
- First-wave strategy-family regression coverage: covered by Task 7 and Final Verification.

## Self-Review Notes

- Placeholder scan completed: no unresolved filler markers remain.
- Type consistency checked: `CanonicalStrategySpecV2`, `StrategyClarificationState`, `CanonicalSpecV2ValidatorService`, and `FORCE_EXIT` naming is consistent across all tasks.
- Scope check passed: the plan stays within one subsystem family, `llm-strategy-codegen` plus its required shared protocol and Prisma persistence edges.
