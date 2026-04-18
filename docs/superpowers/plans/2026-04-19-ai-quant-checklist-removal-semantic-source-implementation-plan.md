# AI Quant Checklist Removal Semantic Source Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove checklist patch/projection from AI Quant's runtime truth path while preserving the existing semantic main flow, atomic semantics contracts, and publication fidelity guarantees.

**Architecture:** Keep the current chain shape intact: `message -> planner/extraction -> semanticState -> normalizedIntent -> canonicalSpec -> digest -> confirmGenerate -> publication -> IR -> AST -> compiled script -> consistency -> published snapshot`. Replace only the checklist-era edges: planner output becomes semantic patch instead of checklist patch, and canonical/publication consume semantic-derived data directly instead of compatibility checklist projection. Roll the change out in two phases inside one branch: first switch the running path to semantic-only, then drop checklist-era files, DTO fields, Prisma columns, and fixtures.

**Tech Stack:** TypeScript, NestJS, Next.js, Prisma, Jest, Vitest, Quantify `llm-strategy-codegen`, `dx` test/build commands.

---

## Execution Environment Prerequisites

- Run all commands from the repository root: `/Users/zengmengdan/coinfulx-new/stats`.
- Prefer the normal `dx` flow first. If a `dx test` / `dx build` command fails only because the current execution context is missing local environment config, reuse the existing environment config files from the local `stats` root workspace instead of inventing new env files.
- If the active Node runtime is too old for the repo/toolchain and blocks `dx`, switch to the higher Node version already available on the local machine, then rerun the same command.
- These environment fallbacks are execution-only helpers. They do not change the feature scope, runtime architecture, or the semantic-only migration design.

## File Structure

### Create

- `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts`
  Shared semantic patch shape returned by planner/extraction prompts and consumed by `CodegenConversationService`.
- `apps/quantify/prisma/schema/migrations/20260419123000_drop_codegen_checklist/migration.sql`
  Drops the obsolete `checklist` column from `llm_strategy_codegen_sessions` once runtime reads no longer depend on it.

### Modify

- `apps/quantify/src/modules/llm-strategy-codegen/prompts/conversation-planner-system.prompt.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/prompts/strategy-protocol-contract.prompt.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/conversation-planner-system-prompt.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/strategy-protocol-contract-prompt.spec.ts`
  Move prompt contracts from checklist patch language to semantic patch / semantic slot language.

- `apps/quantify/src/modules/llm-strategy-codegen/dto/start-codegen-session.dto.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/dto/continue-codegen-session.dto.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/dto/codegen-session.response.dto.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-question.service.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation-start-session.helper.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation-response-mapper.helper.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts`
  Remove checklist from start/continue orchestration, gate decisions, and response shaping.

- `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-session-publication-pipeline.service.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-intent-normalizer.service.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/spec-desc-builder.service.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts`
  Delete compatibility checklist projection from canonical/publication inputs and keep canonical generation semantic-driven.

- `apps/front/src/lib/api.ts`
- `apps/front/src/components/ai-quant/session-loop.ts`
- `apps/front/src/components/ai-quant/session-loop.test.ts`
- `apps/front/src/app/[lng]/ai-quant/ai-quant-page-codegen.ts`
- `apps/front/src/app/[lng]/ai-quant/ai-quant-page-codegen.confirm-preflight.test.ts`
- `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.codegen-confirmation.test.tsx`
- `apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.ts`
  Remove checklist preflight payload building and keep front-end requests/session state semantic-only.

- `apps/quantify/prisma/schema/llm_strategies.prisma`
- `apps/quantify/src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.spec.ts`
  Delete checklist persistence from Quantify sessions and make repository reads/writes semantic-only.

### Delete

- `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-checklist.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/checklist-rule-drafts.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/checklist-gate.service.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-compile-bridge.service.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/checklist-rule-drafts.spec.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/checklist-gate.service.spec.ts`
  Old checklist-era runtime helpers that must disappear in phase 2.

## Task 1: Replace Checklist Prompt Contract With Semantic Patch Contract

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/prompts/conversation-planner-system.prompt.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/prompts/strategy-protocol-contract.prompt.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/conversation-planner-system-prompt.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/strategy-protocol-contract-prompt.spec.ts`

- [ ] **Step 1: Write the failing prompt contract specs**

```ts
it('requires planner output to return semanticPatch instead of checklist patch fields', () => {
  const prompt = buildConversationPlannerSystemPrompt()

  expect(prompt).toContain('semanticPatch')
  expect(prompt).not.toContain('entryRules')
  expect(prompt).not.toContain('exitRules')
  expect(prompt).not.toContain('riskRules')
  expect(prompt).not.toContain('ChecklistPayload')
})

it('describes clarification in terms of semantic slots instead of missing checklist fields', () => {
  const prompt = buildStrategyProtocolTypeContractPrompt()

  expect(prompt).toContain('open semantic slots')
  expect(prompt).toContain('sideScope')
  expect(prompt).toContain('basis')
  expect(prompt).not.toContain('missing entryRules')
})
```

- [ ] **Step 2: Run the prompt tests to verify they fail**

Run:

```bash
dx test unit quantify conversation-planner-system-prompt.spec.ts strategy-protocol-contract-prompt.spec.ts -t "semanticPatch|semantic slots"
```

Expected: FAIL because both prompts still describe checklist patch output and checklist-era clarification language.

- [ ] **Step 3: Add the semantic patch type and update prompt copy**

```ts
// apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts
export interface CodegenSemanticPatch {
  contextSlots?: Record<string, string | number | boolean | null>
  triggers?: Array<{
    key: string
    phase: 'entry' | 'exit' | 'risk' | 'gate'
    sideScope?: 'long' | 'short' | 'both'
    params?: Record<string, unknown>
  }>
  actions?: Array<{
    key: string
    params?: Record<string, unknown>
  }>
  risk?: Array<{
    key: string
    params: Record<string, unknown>
  }>
  position?: {
    mode: string
    value: number
    positionMode: string
  } | null
  clarificationIntent?: {
    targetSlotKeys: string[]
    blockerReason: string
  } | null
}
```

```ts
// apps/quantify/src/modules/llm-strategy-codegen/prompts/conversation-planner-system.prompt.ts
return `
You are updating AI Quant semantic state.

Return JSON with:
- "semanticPatch": incremental semantic changes to merge into semanticState
- "plannerLogicPatch": optional semantic planning notes
- "related": boolean
- "logicReady": boolean

Do not emit checklist fields such as entryRules, exitRules, riskRules, symbols, or timeframes.
Clarification must point to unresolved semantic slots, not missing checklist fields.
`
```

- [ ] **Step 4: Re-run the prompt specs**

Run:

```bash
dx test unit quantify conversation-planner-system-prompt.spec.ts strategy-protocol-contract-prompt.spec.ts
```

Expected: PASS, with prompts describing semantic patch output and semantic-slot clarification only.

- [ ] **Step 5: Commit**

```bash
git add \
  apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts \
  apps/quantify/src/modules/llm-strategy-codegen/prompts/conversation-planner-system.prompt.ts \
  apps/quantify/src/modules/llm-strategy-codegen/prompts/strategy-protocol-contract.prompt.ts \
  apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/conversation-planner-system-prompt.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/prompts/__tests__/strategy-protocol-contract-prompt.spec.ts
git commit -m "refactor: move ai quant prompt contract to semantic patch"
```

## Task 2: Switch Quantify Session Orchestration And Clarification Gate To Semantic-Only Inputs

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/dto/start-codegen-session.dto.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/dto/continue-codegen-session.dto.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/dto/codegen-session.response.dto.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-question.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation-start-session.helper.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts`

- [ ] **Step 1: Add failing service specs that prove start/continue stop depending on checklist fields**

```ts
it('creates a drafting session without persisting or reading checklist payloads', async () => {
  const result = await service.startSession({
    userId: 'u1',
    initialMessage: '在 OKX 合约 BTCUSDT 15m，触及布林带上轨做空，回到中轨平空，仓位 10%',
  })

  expect(result.semanticState).toEqual(expect.objectContaining({
    triggers: expect.arrayContaining([
      expect.objectContaining({ key: 'bollinger.touch_upper', sideScope: 'short' }),
      expect.objectContaining({ key: 'bollinger.touch_middle', phase: 'exit', sideScope: 'short' }),
    ]),
  }))
  expect(mockSessionsRepo.createSession).toHaveBeenCalledWith(expect.not.objectContaining({
    checklist: expect.anything(),
  }))
})

it('keeps clarification blockers in semantic-slot language after continueSession', async () => {
  const result = await service.continueSession('s1', {
    userId: 'u1',
    message: '这里的止损按入场均价',
    clarificationAnswers: { 'semantic.risk.stopLoss.basis': 'entry_avg_price' },
  })

  expect(result.clarificationState?.items.every(item => item.key.startsWith('semantic.'))).toBe(true)
  expect(result.assistantPrompt).not.toContain('entryRules')
  expect(result.assistantPrompt).not.toContain('exitRules')
})
```

- [ ] **Step 2: Run the targeted Quantify service tests**

Run:

```bash
dx test unit quantify codegen-conversation.service.spec.ts strategy-clarification-rules.service.spec.ts -t "without persisting or reading checklist payloads|semantic-slot language"
```

Expected: FAIL because `CodegenConversationService` still calls checklist extraction/merge helpers and clarification logic still references checklist-era field completeness.

- [ ] **Step 3: Remove checklist fields from DTOs and move orchestration onto semantic patch/state**

```ts
// apps/quantify/src/modules/llm-strategy-codegen/dto/start-codegen-session.dto.ts
export class StartCodegenSessionDto {
  @IsOptional()
  @IsString()
  userId?: string

  @IsOptional()
  @IsString()
  initialMessage?: string

  @IsOptional()
  @ValidateNested()
  @Type(() => CodegenGuideConfigDto)
  guideConfig?: CodegenGuideConfigDto
}
```

```ts
// apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts
const plan = await this.planConversationByLlm(dto.initialMessage ?? '', currentSemanticState, {
  providerCode: this.resolveProviderCode(undefined),
})

const nextSemanticState = this.semanticStateReducer.mergePatch({
  currentState: currentSemanticState,
  semanticPatch: plan.semanticPatch ?? null,
  message: dto.initialMessage ?? '',
})

const clarificationState = this.buildClarificationFromSemanticState(nextSemanticState)
const normalization = this.buildNormalizationFromSemanticState(nextSemanticState)
```

- [ ] **Step 4: Re-run the service and clarification specs**

Run:

```bash
dx test unit quantify codegen-conversation.service.spec.ts strategy-clarification-rules.service.spec.ts
```

Expected: PASS, with start/continue using semantic patch/state only and clarification items expressed in semantic-slot language.

- [ ] **Step 5: Commit**

```bash
git add \
  apps/quantify/src/modules/llm-strategy-codegen/dto/start-codegen-session.dto.ts \
  apps/quantify/src/modules/llm-strategy-codegen/dto/continue-codegen-session.dto.ts \
  apps/quantify/src/modules/llm-strategy-codegen/dto/codegen-session.response.dto.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-question.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation-start-session.helper.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts
git commit -m "refactor: move ai quant session orchestration to semantic state"
```

## Task 3: Delete Compatibility Checklist Projection From Canonical And Publication Inputs

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-session-publication-pipeline.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/spec-desc-builder.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

- [ ] **Step 1: Add failing tests for semantic-only canonical and publication compilation**

```ts
it('builds canonical spec directly from normalized semantic intent without compatibility checklist projection', () => {
  const spec = service.buildFromNormalizedIntent({
    market: { exchange: 'okx', marketType: 'perp', defaultTimeframe: '15m' },
  } as any, {
    families: ['single-leg'],
    triggers: [
      {
        key: 'bollinger.touch_upper',
        phase: 'entry',
        sideScope: 'short',
        params: { period: 20, stdDev: 2, confirmationMode: 'touch' },
        closureStatus: 'closed',
        unresolvedSlots: [],
      },
    ],
    actions: [{ key: 'open_short' }],
    risk: [],
    position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'short_only' },
    unresolved: [],
    normalizationNotes: [],
  })

  expect(spec.rules).toEqual(expect.arrayContaining([
    expect.objectContaining({
      sideScope: 'short',
      condition: expect.objectContaining({ key: 'bollinger.upper_break' }),
    }),
  ]))
})

it('does not call buildLegacyChecklist during publication generation', async () => {
  const bridge = new SemanticStateCompileBridgeService()
  const legacySpy = jest.spyOn(bridge, 'buildLegacyChecklist')

  await stage.generate({
    semanticState: lockedBollingerSemanticState,
    message: '确认逻辑图',
  } as any)

  expect(legacySpy).not.toHaveBeenCalled()
})
```

- [ ] **Step 2: Run the canonical/publication tests**

Run:

```bash
dx test unit quantify canonical-spec-builder.service.spec.ts codegen-publication-generation.stage.spec.ts codegen-conversation.service.spec.ts -t "without compatibility checklist projection|does not call buildLegacyChecklist"
```

Expected: FAIL because canonical/publication still depend on checklist projection and semantic-to-checklist adapters.

- [ ] **Step 3: Switch canonical and publication inputs to semantic-only data**

```ts
// apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts
const normalization = this.buildNormalizationFromSemanticState(input.semanticState!)
const canonicalSpec = this.canonicalSpecBuilder.buildFromNormalizedIntent(
  {
    market: {
      exchange: input.semanticState?.contextSlots.exchange?.value as any,
      marketType: input.semanticState?.contextSlots.marketType?.value as any,
      defaultTimeframe: input.semanticState?.contextSlots.timeframe?.value as string,
    },
  } as any,
  normalization.normalizedIntent,
)
```

```ts
// apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts
const normalization = this.buildNormalizationFromSemanticState(reducedSemanticState)
const canonicalSpec = this.canonicalSpecBuilder.buildFromNormalizedIntent(
  this.buildSemanticCanonicalContext(reducedSemanticState),
  normalization.normalizedIntent,
)
```

- [ ] **Step 4: Re-run the canonical/publication tests**

Run:

```bash
dx test unit quantify canonical-spec-builder.service.spec.ts codegen-publication-generation.stage.spec.ts codegen-conversation.service.spec.ts
```

Expected: PASS, with `semanticState -> normalizedIntent -> canonicalSpec` now the only runtime path.

- [ ] **Step 5: Commit**

```bash
git add \
  apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/codegen-session-publication-pipeline.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/spec-desc-builder.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -m "refactor: remove ai quant checklist projection from canonical flow"
```

## Task 4: Upgrade Front-End Requests And Local State To Semantic-Only Protocol

**Files:**
- Modify: `apps/front/src/lib/api.ts`
- Modify: `apps/front/src/components/ai-quant/session-loop.ts`
- Modify: `apps/front/src/components/ai-quant/session-loop.test.ts`
- Modify: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-codegen.ts`
- Modify: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-codegen.confirm-preflight.test.ts`
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.codegen-confirmation.test.tsx`
- Modify: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.ts`

- [ ] **Step 1: Add failing front-end tests that prove confirm and continue never rebuild checklist payloads**

```ts
it('sends only message, clarificationAnswers, confirmGenerate, and confirmedCanonicalDigest during confirmGenerate', async () => {
  await submitConfirmGenerate()

  expect(mockContinueLlmCodegenSession).toHaveBeenCalledWith(
    'session-1',
    expect.objectContaining({
      confirmGenerate: true,
      confirmedCanonicalDigest: 'sha256:canonical-1',
    }),
  )

  const payload = mockContinueLlmCodegenSession.mock.calls.at(-1)?.[1] as Record<string, unknown>
  expect(payload).not.toHaveProperty('symbols')
  expect(payload).not.toHaveProperty('timeframes')
  expect(payload).not.toHaveProperty('entryRules')
  expect(payload).not.toHaveProperty('exitRules')
  expect(payload).not.toHaveProperty('riskRules')
})

it('does not export resolveChecklistPayload after semantic-only preflight migration', async () => {
  const module = await import('@/components/ai-quant/session-loop')
  expect('resolveChecklistPayload' in module).toBe(false)
})
```

- [ ] **Step 2: Run the focused front-end tests**

Run:

```bash
dx test unit front AiQuantPageClient.codegen-confirmation.test.tsx -t "sends only message, clarificationAnswers, confirmGenerate, and confirmedCanonicalDigest during confirmGenerate"
dx test unit front session-loop.test.ts -t "does not export resolveChecklistPayload after semantic-only preflight migration"
```

Expected: FAIL because front-end code still imports `resolveChecklistPayload` and still owns checklist rebuild helpers.

- [ ] **Step 3: Remove checklist preflight and keep front-end payloads semantic-only**

```ts
// apps/front/src/app/[lng]/ai-quant/ai-quant-page-codegen.ts
const continueSession = async (id: string) =>
  continueLlmCodegenSession(id, {
    message: trimmedMessage,
    clarificationAnswers,
    confirmGenerate,
    confirmedCanonicalDigest,
  })
```

```ts
// apps/front/src/components/ai-quant/session-loop.ts
export function isShortConfirmationMessage(message: string): boolean {
  // keep only chat/confirmation helpers here; checklist payload helpers are removed
}
```

- [ ] **Step 4: Re-run the front-end tests**

Run:

```bash
dx test unit front AiQuantPageClient.codegen-confirmation.test.tsx
dx test unit front ai-quant-page-codegen.confirm-preflight.test.ts
dx test unit front session-loop.test.ts
```

Expected: PASS, with front-end requests and local state no longer rebuilding checklist payloads.

- [ ] **Step 5: Commit**

```bash
git add \
  apps/front/src/lib/api.ts \
  apps/front/src/components/ai-quant/session-loop.ts \
  apps/front/src/components/ai-quant/session-loop.test.ts \
  apps/front/src/app/[lng]/ai-quant/ai-quant-page-codegen.ts \
  apps/front/src/app/[lng]/ai-quant/ai-quant-page-codegen.confirm-preflight.test.ts \
  apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.codegen-confirmation.test.tsx \
  apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.ts
git commit -m "refactor: drop ai quant front-end checklist preflight"
```

## Task 5: Remove Checklist Persistence From Quantify Prisma And Session Repository

**Files:**
- Modify: `apps/quantify/prisma/schema/llm_strategies.prisma`
- Create: `apps/quantify/prisma/schema/migrations/20260419123000_drop_codegen_checklist/migration.sql`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.spec.ts`

- [ ] **Step 1: Add the failing repository spec for semantic-only session persistence**

```ts
it('persists codegen sessions without a checklist column', async () => {
  await repo.createSession({
    userId: 'u1',
    status: 'DRAFTING' as any,
    semanticState,
    clarificationState: { status: 'CLEAR', items: [] } as any,
    constraintPack: null,
    latestDraftCode: null,
    latestSpecDesc: { canonicalDigest: 'sha256:1' } as any,
    rejectReason: null,
    strategyInstanceId: null,
  } as any)

  expect(mockPrisma.llmStrategyCodegenSession.create).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.not.objectContaining({
      checklist: expect.anything(),
    }),
  }))
})
```

- [ ] **Step 2: Run the repository spec to verify it fails**

Run:

```bash
dx test unit quantify codegen-sessions.repository.spec.ts -t "without a checklist column"
```

Expected: FAIL because repository create/update paths still read and write the `checklist` JSON column.

- [ ] **Step 3: Drop the checklist column and simplify repository reads/writes**

```prisma
// apps/quantify/prisma/schema/llm_strategies.prisma
model LlmStrategyCodegenSession {
  id                 String                  @id @default(cuid())
  userId             String                  @map("user_id")
  strategyInstanceId String?                 @map("strategy_instance_id")
  status             LlmCodegenSessionStatus @default(DRAFTING)
  semanticState      Json?                   @map("semantic_state")
  constraintPack     Json?                   @map("constraint_pack")
  clarificationState Json?                   @map("clarification_state")
  latestDraftCode    String?                 @map("latest_draft_code") @db.Text
  latestSpecDesc     Json?                   @map("latest_spec_desc")
  // checklist column removed
}
```

```sql
-- apps/quantify/prisma/schema/migrations/20260419123000_drop_codegen_checklist/migration.sql
ALTER TABLE "llm_strategy_codegen_sessions"
DROP COLUMN "checklist";
```

- [ ] **Step 4: Regenerate Prisma types and rerun repository coverage**

Run:

```bash
dx db generate
dx test unit quantify codegen-sessions.repository.spec.ts
dx build quantify --dev
```

Expected: PASS, with Prisma types and repository code no longer referencing `checklist`.

- [ ] **Step 5: Commit**

```bash
git add \
  apps/quantify/prisma/schema/llm_strategies.prisma \
  apps/quantify/prisma/schema/migrations/20260419123000_drop_codegen_checklist/migration.sql \
  apps/quantify/src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.ts \
  apps/quantify/src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.spec.ts
git commit -m "refactor: remove checklist persistence from quantify sessions"
```

## Task 6: Delete Checklist-Era Dead Code And Run Golden Semantic Regressions

**Files:**
- Delete: `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-checklist.ts`
- Delete: `apps/quantify/src/modules/llm-strategy-codegen/services/checklist-rule-drafts.ts`
- Delete: `apps/quantify/src/modules/llm-strategy-codegen/services/checklist-gate.service.ts`
- Delete: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-compile-bridge.service.ts`
- Delete: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/checklist-rule-drafts.spec.ts`
- Delete: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/checklist-gate.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts`
- Modify: `apps/front/src/components/ai-quant/session-loop.test.ts`

- [ ] **Step 1: Add failing golden regression coverage for semantic-only Bollinger and grid flows**

```ts
it('covers the bollinger golden path without checklist-era helpers anywhere in the publish chain', async () => {
  const result = await service.continueSession('s-bollinger', {
    userId: 'u1',
    message: '确认逻辑图',
    confirmGenerate: true,
    confirmedCanonicalDigest: started.canonicalDigest!,
  })

  expect(result.status).toBe('GENERATING')
  expect(mockPublishedSnapshotRepo.create).toHaveBeenCalledWith(expect.objectContaining({
    specSnapshot: expect.objectContaining({
      rules: expect.arrayContaining([
        expect.objectContaining({ sideScope: 'short', condition: expect.objectContaining({ key: 'bollinger.upper_break' }) }),
        expect.objectContaining({ sideScope: 'short', condition: expect.objectContaining({ key: 'bollinger.middle_revert' }) }),
      ]),
    }),
  }))
})
```

- [ ] **Step 2: Run the focused golden regression tests**

Run:

```bash
dx test unit quantify codegen-conversation.service.spec.ts codegen-publication-generation.stage.spec.ts -t "without checklist-era helpers anywhere in the publish chain|grid golden case"
```

Expected: FAIL or remain red until old checklist-era files/imports are removed and all callers are switched.

- [ ] **Step 3: Delete checklist-era runtime helpers and fix imports**

```ts
// apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts
providers: [
  CodegenConversationService,
  CodegenSessionPublicationPipelineService,
  StrategyClarificationRulesService,
  StrategyClarificationQuestionService,
  CanonicalSpecBuilderService,
  // ChecklistGateService and SemanticStateCompileBridgeService removed
]
```

- [ ] **Step 4: Run the full semantic-only regression set**

Run:

```bash
dx test unit quantify codegen-conversation.service.spec.ts canonical-spec-builder.service.spec.ts codegen-publication-generation.stage.spec.ts codegen-sessions.repository.spec.ts conversation-planner-system-prompt.spec.ts strategy-protocol-contract-prompt.spec.ts -- --runInBand
dx test unit front AiQuantPageClient.codegen-confirmation.test.tsx ai-quant-page-codegen.confirm-preflight.test.ts session-loop.test.ts
dx build quantify --dev
dx build front --dev
```

Expected: PASS, with Bollinger/Grid/basis-confirmation golden cases green and no checklist-era runtime/helper files left in the module graph.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: delete ai quant checklist runtime path"
```

## Self-Review Notes

- Spec coverage check:
  - `checklist patch` removal is covered by Tasks 1-2.
  - `compatibility checklist projection` removal is covered by Task 3.
  - `apps/front` semantic-only upgrade is covered by Task 4.
  - `apps/quantify` service, prompt, and publication upgrade is covered by Tasks 1-3 and 6.
  - Prisma / database cleanup is covered by Task 5.
  - Golden regression and merge readiness are covered by Task 6.
- Placeholder scan:
  - No unfinished placeholder markers remain in tasks, snippets, commands, or commit steps.
- Type consistency:
  - `semanticPatch`, `semanticState`, `normalizedIntent`, and `confirmedCanonicalDigest` are used consistently across tasks.
