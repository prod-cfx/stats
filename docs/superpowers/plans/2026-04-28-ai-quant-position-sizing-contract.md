# AI Quant Position Sizing Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI Quant position sizing a first-class semantic contract supporting ratio, quote amount, and base quantity through `SemanticState -> CanonicalSpec -> IR`.

**Architecture:** Introduce `SemanticPositionSizingContract` on `SemanticPositionState` while keeping legacy `mode/value` readable for old sessions. Centralize parsing and validation in position semantic contract helpers, then update seed extraction, clarification reduction, conversation completeness, projection, and canonical build to consume the contract instead of hard-coded `fixed_ratio` checks.

**Tech Stack:** TypeScript, NestJS services, Jest unit tests, Nx/dx command wrapper.

---

## File Map

- Modify `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`
  - Add `SemanticPositionSizingContract`.
  - Add `sizing` to `SemanticPositionState`.
  - Keep `mode/value` as optional compatibility fields during migration.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts`
  - Add `sizing` support to planner/seed position patches.
  - Keep legacy `mode/value` patch support.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-semantic-contracts.ts`
  - Validate `position.sizing` as the canonical completeness predicate.
  - Add conversion helpers from legacy `mode/value` to `sizing`.
- Create `apps/quantify/src/modules/llm-strategy-codegen/services/position-sizing-contract.service.ts`
  - Parse natural language answers/messages into the semantic sizing contract.
  - Normalize quote aliases: `u`, `U`, `刀`, `美元` -> `USDT` or `USD` as specified below.
  - Normalize base assets to uppercase.
- Add `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/position-sizing-contract.service.spec.ts`
  - Unit tests for ratio, quote, base parsing, and risk-text exclusions.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
  - Use the contract parser and output `position.sizing`.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-reducer.service.ts`
  - Use the contract parser for `position.sizing` clarification answers.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
  - Build planner position state with `sizing`.
  - Use `validateSemanticPositionContract` for completeness.
  - Open a neutral `position.sizing` slot, not a percentage-specific slot.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`
  - Format `ratio`, `quote`, and `base` sizing summaries from the contract.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
  - Prefer `position.sizing` when resolving canonical sizing.
  - Fall back to legacy `mode/value` only for compatibility.
- Test updates:
  - `semantic-seed-extractor.service.spec.ts`
  - `semantic-state-reducer.service.spec.ts`
  - `semantic-state-projection.service.spec.ts`
  - `codegen-conversation.service.spec.ts`
  - `canonical-spec-builder.service.spec.ts`
  - `canonical-spec-v2-ir-compiler.service.spec.ts`

## Contract Decisions

- `10u`, `10U`, `10 USDT` normalize to `{ kind: 'quote', value: 10, asset: 'USDT' }`.
- `10刀`, `10美元`, `10 USD` normalize to `{ kind: 'quote', value: 10, asset: 'USD' }`.
- `10 USDC` normalizes to `{ kind: 'quote', value: 10, asset: 'USDC' }`.
- Base assets are uppercase strings, for example `{ kind: 'base', value: 0.001, asset: 'BTC' }`.
- Ratio contracts are stored normalized as `{ kind: 'ratio', value: 0.1, unit: 'ratio' }`.
- Legacy `mode/value` remains accepted:
  - `fixed_ratio` -> `ratio`
  - `fixed_quote` -> `quote`, default asset `USDT`
  - `fixed_qty` -> `base`, default asset inferred from context symbol base when available, otherwise `BASE`

---

### Task 1: Add Position Sizing Contract Types And Validation

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-semantic-contracts.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-semantic-contracts.spec.ts`

- [ ] **Step 1: Add failing contract tests**

Add these tests to `strategy-semantic-contracts.spec.ts`:

```ts
it('accepts ratio, quote, and base position sizing contracts', () => {
  expect(validateSemanticPositionContract({
    sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' },
    positionMode: 'long_only',
  }).ok).toBe(true)

  expect(validateSemanticPositionContract({
    sizing: { kind: 'quote', value: 10, asset: 'USDT' },
    positionMode: 'long_only',
  }).ok).toBe(true)

  expect(validateSemanticPositionContract({
    sizing: { kind: 'base', value: 0.001, asset: 'BTC' },
    positionMode: 'long_only',
  }).ok).toBe(true)
})

it('rejects invalid position sizing contracts', () => {
  expect(validateSemanticPositionContract({
    sizing: { kind: 'quote', value: 0, asset: 'USDT' },
    positionMode: 'long_only',
  }).ok).toBe(false)

  expect(validateSemanticPositionContract({
    sizing: { kind: 'base', value: 0.001, asset: '' },
    positionMode: 'long_only',
  }).ok).toBe(false)
})
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-semantic-contracts.spec.ts -t "position sizing contracts"
```

Expected: FAIL because `sizing` is not yet part of the semantic position contract.

- [ ] **Step 3: Add types**

In `semantic-state.ts`, add:

```ts
export type SemanticPositionSizingContract =
  | { kind: 'ratio'; value: number; unit: 'ratio' | 'percent' }
  | { kind: 'quote'; value: number; asset: 'USDT' | 'USDC' | 'USD' }
  | { kind: 'base'; value: number; asset: string }
```

Then update `SemanticPositionState`:

```ts
export interface SemanticPositionState {
  sizing?: SemanticPositionSizingContract | null
  mode?: string
  value?: number
  positionMode: string
  status: SemanticNodeStatus
  source: SemanticSource
  evidence?: SemanticEvidence
  openSlots?: SemanticSlotState[]
}
```

In `codegen-semantic-patch.ts`, import `SemanticPositionSizingContract` and update `position`:

```ts
position?: {
  sizing?: SemanticPositionSizingContract | null
  mode?: string
  value?: number
  positionMode: string
} | null
```

- [ ] **Step 4: Update validation and legacy conversion**

In `strategy-semantic-contracts.ts`, import `SemanticPositionSizingContract` and add:

```ts
const SUPPORTED_QUOTE_ASSETS = new Set<string>(['USDT', 'USDC', 'USD'])

export function normalizeLegacyPositionSizing(position: unknown): SemanticPositionSizingContract | null {
  if (!isRecord(position)) return null
  if (isRecord(position.sizing)) return position.sizing as SemanticPositionSizingContract
  if (typeof position.mode !== 'string' || typeof position.value !== 'number' || !Number.isFinite(position.value)) return null

  if (position.mode === 'fixed_ratio') {
    return { kind: 'ratio', value: position.value, unit: 'ratio' }
  }
  if (position.mode === 'fixed_quote') {
    return { kind: 'quote', value: position.value, asset: 'USDT' }
  }
  if (position.mode === 'fixed_qty') {
    return { kind: 'base', value: position.value, asset: 'BASE' }
  }
  return null
}

function validatePositionSizingContract(sizing: unknown): SemanticContractValidationResult {
  if (!isRecord(sizing) || typeof sizing.kind !== 'string') return invalid('invalid_position_sizing_contract')
  if (typeof sizing.value !== 'number' || !Number.isFinite(sizing.value) || sizing.value <= 0) return invalid('invalid_position_value')

  if (sizing.kind === 'ratio') {
    return sizing.unit === 'ratio' || sizing.unit === 'percent' ? valid() : invalid('invalid_position_ratio_unit')
  }
  if (sizing.kind === 'quote') {
    return typeof sizing.asset === 'string' && SUPPORTED_QUOTE_ASSETS.has(sizing.asset)
      ? valid()
      : invalid('invalid_position_quote_asset')
  }
  if (sizing.kind === 'base') {
    return typeof sizing.asset === 'string' && /^[A-Z][A-Z0-9]{1,15}$/u.test(sizing.asset)
      ? valid()
      : invalid('invalid_position_base_asset')
  }
  return invalid('unsupported_position_sizing_kind')
}
```

Then update `validateSemanticPositionContract` so it validates `normalizeLegacyPositionSizing(position)` and `positionMode`.

- [ ] **Step 5: Run contract tests**

Run:

```bash
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-semantic-contracts.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts \
  apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/strategy-semantic-contracts.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-semantic-contracts.spec.ts
git commit -m "feat: add position sizing semantic contract"
```

---

### Task 2: Add Shared Position Sizing Parser

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/position-sizing-contract.service.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/position-sizing-contract.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts`

- [ ] **Step 1: Write parser tests**

Create `position-sizing-contract.service.spec.ts`:

```ts
import { PositionSizingContractService } from '../position-sizing-contract.service'

describe('PositionSizingContractService', () => {
  const service = new PositionSizingContractService()

  it.each([
    ['用 10% 仓位', { kind: 'ratio', value: 0.1, unit: 'ratio' }],
    ['单笔百分之10资金', { kind: 'ratio', value: 0.1, unit: 'ratio' }],
    ['每次使用 0.1 资金比例', { kind: 'ratio', value: 0.1, unit: 'ratio' }],
  ])('parses ratio sizing: %s', (text, expected) => {
    expect(service.parse(text)?.sizing).toEqual(expected)
  })

  it.each([
    ['固定使用 10 USDT', { kind: 'quote', value: 10, asset: 'USDT' }],
    ['每次 10u', { kind: 'quote', value: 10, asset: 'USDT' }],
    ['单笔 10 刀', { kind: 'quote', value: 10, asset: 'USD' }],
    ['投入 10 美元', { kind: 'quote', value: 10, asset: 'USD' }],
    ['每次 10 USDC', { kind: 'quote', value: 10, asset: 'USDC' }],
  ])('parses quote sizing: %s', (text, expected) => {
    expect(service.parse(text)?.sizing).toEqual(expected)
  })

  it.each([
    ['每次买 0.001 BTC', { kind: 'base', value: 0.001, asset: 'BTC' }],
    ['固定 0.01 ETH', { kind: 'base', value: 0.01, asset: 'ETH' }],
    ['单笔 2 SOL', { kind: 'base', value: 2, asset: 'SOL' }],
  ])('parses base sizing: %s', (text, expected) => {
    expect(service.parse(text)?.sizing).toEqual(expected)
  })

  it.each([
    '止损 10 USDT',
    '单笔风险 10 USDT',
    '亏损 10% 止损',
  ])('does not parse risk text as position sizing: %s', (text) => {
    expect(service.parse(text)).toBeNull()
  })
})
```

- [ ] **Step 2: Run failing parser tests**

Run:

```bash
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/position-sizing-contract.service.spec.ts
```

Expected: FAIL because the parser service does not exist.

- [ ] **Step 3: Implement parser service**

Create `position-sizing-contract.service.ts`:

```ts
import { Injectable } from '@nestjs/common'
import type { SemanticEvidence, SemanticPositionSizingContract } from '../types/semantic-state'

export interface ParsedPositionSizingContract {
  sizing: SemanticPositionSizingContract
  evidence: SemanticEvidence
}

@Injectable()
export class PositionSizingContractService {
  parse(text?: string, messageIndex?: number): ParsedPositionSizingContract | null {
    const normalized = text?.trim().replace(/\s+/gu, ' ') ?? ''
    if (!normalized || this.looksLikeRiskSizing(normalized)) return null

    return this.parseQuote(normalized, messageIndex)
      ?? this.parseBase(normalized, messageIndex)
      ?? this.parseRatio(normalized, messageIndex)
  }

  private parseQuote(text: string, messageIndex?: number): ParsedPositionSizingContract | null {
    const match = text.match(/(?:固定(?:使用|用|投入)?|单笔(?:使用|用|投入)?|每(?:次|笔|单)(?:开仓|下单|买入|开多|开空)?(?:使用|用|投入)?|投入|用|仓位)?[^\d]{0,8}(\d+(?:\.\d+)?)\s*(USDT|USDC|USD|u|U|刀|美元)\b?/u)
    if (!match?.[1] || !match[2]) return null
    const value = Number(match[1])
    if (!Number.isFinite(value) || value <= 0) return null

    const asset = this.normalizeQuoteAsset(match[2])
    return {
      sizing: { kind: 'quote', value, asset },
      evidence: { text, messageIndex, source: 'user_explicit' },
    }
  }

  private parseBase(text: string, messageIndex?: number): ParsedPositionSizingContract | null {
    const match = text.match(/(?:固定(?:使用|用|买|投入)?|单笔(?:使用|用|买|投入)?|每(?:次|笔|单)(?:开仓|下单|买入|开多|开空)?(?:使用|用|买|投入)?|买入|买|用)?[^\d]{0,8}(\d+(?:\.\d+)?)\s*([A-Za-z][A-Za-z0-9]{1,15})\b/u)
    if (!match?.[1] || !match[2]) return null
    const asset = match[2].toUpperCase()
    if (asset === 'USDT' || asset === 'USDC' || asset === 'USD') return null
    const value = Number(match[1])
    if (!Number.isFinite(value) || value <= 0) return null
    return {
      sizing: { kind: 'base', value, asset },
      evidence: { text, messageIndex, source: 'user_explicit' },
    }
  }

  private parseRatio(text: string, messageIndex?: number): ParsedPositionSizingContract | null {
    const percentMatch = text.replace(/％/gu, '%').match(/(?:百分之?\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*%)/u)
    if (percentMatch) {
      const percent = Number(percentMatch[1] ?? percentMatch[2])
      if (Number.isFinite(percent) && percent > 0 && percent <= 100) {
        return {
          sizing: { kind: 'ratio', value: percent / 100, unit: 'ratio' },
          evidence: { text, messageIndex, source: 'user_explicit' },
        }
      }
    }

    const ratioMatch = text.match(/(?:资金比例|仓位比例|比例)[^\d]{0,8}(0?\.\d+|1(?:\.0+)?)/u)
    if (!ratioMatch?.[1]) return null
    const value = Number(ratioMatch[1])
    if (!Number.isFinite(value) || value <= 0 || value > 1) return null
    return {
      sizing: { kind: 'ratio', value, unit: 'ratio' },
      evidence: { text, messageIndex, source: 'user_explicit' },
    }
  }

  private normalizeQuoteAsset(input: string): 'USDT' | 'USDC' | 'USD' {
    const upper = input.toUpperCase()
    if (upper === 'USDT' || upper === 'U') return 'USDT'
    if (upper === 'USDC') return 'USDC'
    return 'USD'
  }

  private looksLikeRiskSizing(text: string): boolean {
    return /(?:止盈|止损|盈利|亏损|收益|损失|风险|风险额|最大风险|单笔风险|max\s*risk|stop\s*loss|take\s*profit)/iu.test(text)
  }
}
```

- [ ] **Step 4: Register provider**

In `llm-strategy-codegen.module.ts`, import and add `PositionSizingContractService` to providers:

```ts
import { PositionSizingContractService } from './services/position-sizing-contract.service'
```

```ts
PositionSizingContractService,
```

- [ ] **Step 5: Run parser tests**

Run:

```bash
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/position-sizing-contract.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/position-sizing-contract.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/position-sizing-contract.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts
git commit -m "feat: parse position sizing contracts"
```

---

### Task 3: Use Position Contract In Seed Extraction And Clarification Reduction

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-reducer.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-reducer.service.spec.ts`

- [ ] **Step 1: Add failing seed extractor tests**

Add tests:

```ts
it('extracts quote position sizing contract from fixed quote wording', () => {
  const patch = service.extract('BTCUSDT 1m，收盘价高于开盘价开多，固定使用 10 USDT')

  expect(patch.position).toEqual(expect.objectContaining({
    sizing: { kind: 'quote', value: 10, asset: 'USDT' },
    positionMode: 'long_only',
  }))
})

it('extracts base position sizing contract from base quantity wording', () => {
  const patch = service.extract('BTCUSDT 1m，收盘价高于开盘价开多，每次买 0.001 BTC')

  expect(patch.position).toEqual(expect.objectContaining({
    sizing: { kind: 'base', value: 0.001, asset: 'BTC' },
    positionMode: 'long_only',
  }))
})
```

- [ ] **Step 2: Add failing reducer tests**

Add or update tests:

```ts
it.each([
  ['10u', { kind: 'quote', value: 10, asset: 'USDT' }],
  ['10刀', { kind: 'quote', value: 10, asset: 'USD' }],
  ['0.001 BTC', { kind: 'base', value: 0.001, asset: 'BTC' }],
])('locks position sizing contract from clarification answer: %s', (answer, sizing) => {
  const next = service.applyClarificationAnswer({
    currentState: buildOpenPositionSizingState(),
    targetSlotKey: 'position.sizing',
    targetSlotId: buildSemanticSlotId({ slotKey: 'position.sizing', fieldPath: 'position.sizing' }),
    answer,
    messageIndex: 6,
  })

  expect(next.position).toEqual(expect.objectContaining({
    sizing,
    status: 'locked',
    source: 'user_explicit',
  }))
})
```

Define `buildOpenPositionSizingState()` in the test file with:

```ts
const buildOpenPositionSizingState = (): SemanticState => ({
  version: 1,
  families: ['single-leg'],
  triggers: [],
  actions: [],
  risk: [],
  position: {
    sizing: null,
    positionMode: 'long_only',
    status: 'open',
    source: 'derived',
    openSlots: [{
      slotKey: 'position.sizing',
      fieldPath: 'position.sizing',
      status: 'open',
      priority: 'risk',
      questionHint: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
      affectsExecution: true,
    }],
  },
  contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
  normalizationNotes: [],
  updatedAt: '2026-04-28T00:00:00.000Z',
})
```

- [ ] **Step 3: Run failing tests**

Run:

```bash
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts -t "position sizing contract"
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-reducer.service.spec.ts -t "position sizing contract"
```

Expected: FAIL because seed/reducer are not yet writing `position.sizing`.

- [ ] **Step 4: Update seed extractor**

Inject or instantiate `PositionSizingContractService` in `SemanticSeedExtractorService`:

```ts
constructor(
  private readonly positionSizingContracts: PositionSizingContractService = new PositionSizingContractService(),
) {}
```

Change `extractPosition()` to:

```ts
private extractPosition(
  text: string,
  triggers: SeedTrigger[],
): NonNullable<CodegenSemanticPatch['position']> | null {
  const parsed = this.positionSizingContracts.parse(text)
  if (!parsed) return null

  return {
    sizing: parsed.sizing,
    mode: this.toLegacyPositionMode(parsed.sizing.kind),
    value: parsed.sizing.value,
    positionMode: this.resolvePositionMode(text, triggers),
  }
}

private toLegacyPositionMode(kind: 'ratio' | 'quote' | 'base'): 'fixed_ratio' | 'fixed_quote' | 'fixed_qty' {
  if (kind === 'ratio') return 'fixed_ratio'
  if (kind === 'quote') return 'fixed_quote'
  return 'fixed_qty'
}
```

Remove direct `extractFixedQuoteSizing()`/percent sizing use from the new path. Keep helper methods only if other tests still cover them through the parser.

- [ ] **Step 5: Update reducer**

Inject or instantiate the parser:

```ts
constructor(
  private readonly positionSizingContracts: PositionSizingContractService = new PositionSizingContractService(),
) {}
```

In the `position.sizing` branch:

```ts
const parsed = this.positionSizingContracts.parse(answerText, input.messageIndex)
if (parsed) {
  nextState.position.sizing = parsed.sizing
  nextState.position.mode = this.toLegacyPositionMode(parsed.sizing.kind)
  nextState.position.value = parsed.sizing.value
  nextState.position.status = 'locked'
  nextState.position.source = 'user_explicit'
  nextState.position.evidence = parsed.evidence
  positionSlot.value = this.formatSlotSizingValue(parsed.sizing)
  positionSlot.status = 'locked'
  positionSlot.evidence = parsed.evidence
}
```

Add helper:

```ts
private formatSlotSizingValue(sizing: SemanticPositionSizingContract): string | number {
  if (sizing.kind === 'ratio') return sizing.value
  return `${sizing.value} ${sizing.asset}`
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-reducer.service.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-reducer.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-reducer.service.spec.ts
git commit -m "feat: use position sizing contract in semantic extraction"
```

---

### Task 4: Use Position Contract In Conversation Completeness And Projection

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts`

- [ ] **Step 1: Add failing projection tests**

Add:

```ts
it.each([
  [{ kind: 'ratio', value: 0.1, unit: 'ratio' }, '仓位：10%'],
  [{ kind: 'quote', value: 10, asset: 'USDT' }, '仓位：10 USDT'],
  [{ kind: 'base', value: 0.001, asset: 'BTC' }, '仓位：0.001 BTC'],
])('formats position sizing contract %o', (sizing, expected) => {
  const view = service.buildConversationView({
    version: 1,
    families: ['single-leg'],
    triggers: [],
    actions: [],
    risk: [],
    position: {
      sizing,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    },
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-04-28T00:00:00.000Z',
  } as SemanticState)

  expect(view.positionSummary).toBe(expected)
  expect(view.hasDeterministicSemantics).toBe(true)
})
```

- [ ] **Step 2: Add failing conversation regression tests**

Add:

```ts
it('regression: fixed quote position contract is not replaced by a percentage clarification slot', async () => {
  mockAi.chat.mockResolvedValueOnce({
    content: JSON.stringify({
      related: true,
      logicReady: false,
      assistantPrompt: '请确认交易所。',
      semanticPatch: {
        triggers: [
          {
            key: 'condition.expression',
            phase: 'entry',
            sideScope: 'long',
            params: {
              expression: {
                kind: 'predicate',
                op: 'GT',
                left: { kind: 'series', source: 'bar', field: 'close' },
                right: { kind: 'series', source: 'bar', field: 'open' },
              },
            },
          },
        ],
        actions: [{ key: 'open_long' }],
        contextSlots: { symbol: 'BTCUSDT', timeframe: '1m' },
      },
    }),
  })
  mockRepo.createSession.mockResolvedValue({ id: 's-fixed-quote-contract' })

  await service.startSession({
    userId: 'u1',
    initialMessage: '用 BTCUSDT 1m K 线。收盘价高于开盘价开多，固定使用 10 USDT。',
  })

  const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
  expect(createPayload.semanticState.position.sizing).toEqual({ kind: 'quote', value: 10, asset: 'USDT' })
  expect(createPayload.clarificationState.items).toEqual(expect.not.arrayContaining([
    expect.objectContaining({ slotKey: 'position.sizing' }),
  ]))
})

it('regression: base quantity position contract is complete in startSession', async () => {
  mockAi.chat.mockResolvedValueOnce({
    content: JSON.stringify({
      related: true,
      logicReady: false,
      assistantPrompt: '请确认交易所。',
      semanticPatch: {
        triggers: [
          {
            key: 'condition.expression',
            phase: 'entry',
            sideScope: 'long',
            params: {
              expression: {
                kind: 'predicate',
                op: 'GT',
                left: { kind: 'series', source: 'bar', field: 'close' },
                right: { kind: 'series', source: 'bar', field: 'open' },
              },
            },
          },
        ],
        actions: [{ key: 'open_long' }],
        contextSlots: { symbol: 'BTCUSDT', timeframe: '1m' },
      },
    }),
  })
  mockRepo.createSession.mockResolvedValue({ id: 's-base-contract' })

  await service.startSession({
    userId: 'u1',
    initialMessage: '用 BTCUSDT 1m K 线。收盘价高于开盘价开多，每次买 0.001 BTC。',
  })

  const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
  expect(createPayload.semanticState.position.sizing).toEqual({ kind: 'base', value: 0.001, asset: 'BTC' })
  expect(createPayload.clarificationState.items).toEqual(expect.not.arrayContaining([
    expect.objectContaining({ slotKey: 'position.sizing' }),
  ]))
})
```

- [ ] **Step 3: Run failing tests**

Run:

```bash
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts -t "position sizing contract"
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts -t "position contract"
```

Expected: FAIL until completeness/projection reads the contract.

- [ ] **Step 4: Update conversation completeness**

In `codegen-conversation.service.ts`, import `validateSemanticPositionContract` if not already imported. Replace `hasValidLockedPositionSizing()` with:

```ts
private hasValidLockedPositionSizing(
  position: SemanticState['position'],
): boolean {
  return position?.status === 'locked'
    && validateSemanticPositionContract(position).ok
}
```

Update the open slot in `ensurePositionSizingSlot()`:

```ts
position: {
  sizing: null,
  positionMode: this.inferPositionModeFromActions(state.actions, checklist),
  status: 'open',
  source: 'derived',
  openSlots: [{
    slotKey: 'position.sizing',
    fieldPath: 'position.sizing',
    status: 'open',
    priority: 'risk',
    questionHint: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
    affectsExecution: true,
  }],
}
```

Update `toPlannerPositionState()` so new planner patches with `sizing` survive:

```ts
const sizing = normalizeLegacyPositionSizing(record)
if (!sizing || typeof record.positionMode !== 'string') return null
return {
  sizing,
  mode: this.toLegacyPositionMode(sizing.kind),
  value: sizing.value,
  positionMode: record.positionMode,
  status: 'locked',
  source: 'user_explicit',
  openSlots: [],
}
```

- [ ] **Step 5: Update projection formatting**

In `semantic-state-projection.service.ts`, read `normalizeLegacyPositionSizing(position)` and format by `kind`:

```ts
private buildPositionSummary(position: SemanticState['position']): string {
  if (!this.hasValidLockedPosition(position)) return ''
  const sizing = normalizeLegacyPositionSizing(position)
  if (!sizing) return ''
  if (sizing.kind === 'quote') return `仓位：${this.formatNumber(sizing.value)} ${sizing.asset}`
  if (sizing.kind === 'base') return `仓位：${this.formatNumber(sizing.value)} ${sizing.asset}`
  return `仓位：${this.formatRatio(sizing.value)}%`
}
```

Update `hasValidLockedPosition()` to use `validateSemanticPositionContract(position).ok`.

- [ ] **Step 6: Update legacy clarification question wording**

In `strategy-clarification-rules.service.ts`, keep the legacy item key for compatibility but update question:

```ts
question: '请确认单笔仓位大小（例如 10% / 10 USDT / 0.001 BTC）。',
```

- [ ] **Step 7: Run tests**

Run:

```bash
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-rules.service.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-rules.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts
git commit -m "feat: use position contract for semantic completeness"
```

---

### Task 5: Map Position Contract Through CanonicalSpec And IR

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-ir-compiler.service.spec.ts`

- [ ] **Step 1: Add failing canonical builder tests**

Add:

```ts
it.each([
  [{ kind: 'ratio', value: 0.1, unit: 'ratio' }, { mode: 'RATIO', value: 0.1 }],
  [{ kind: 'quote', value: 10, asset: 'USDT' }, { mode: 'QUOTE', value: 10 }],
  [{ kind: 'base', value: 0.001, asset: 'BTC' }, { mode: 'QTY', value: 0.001 }],
])('builds canonical sizing from semantic position contract %o', (sizing, expected) => {
  const spec = service.buildFromSemanticState({
    version: 1,
    families: ['single-leg'],
    triggers: [],
    actions: [],
    risk: [],
    position: {
      sizing,
      positionMode: 'long_only',
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    },
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: '2026-04-28T00:00:00.000Z',
  } as SemanticState)

  expect(spec.sizing).toEqual(expected)
})
```

- [ ] **Step 2: Add failing IR tests**

Add to `canonical-spec-v2-ir-compiler.service.spec.ts`:

```ts
it.each([
  [{ mode: 'QUOTE', value: 10 }, { mode: 'fixed_quote', value: 10 }],
  [{ mode: 'QTY', value: 0.001 }, { mode: 'fixed_base', value: 0.001 }],
])('preserves canonical sizing %o in IR portfolio sizing', (sizing, expected) => {
  const result = new CanonicalSpecV2IrCompilerService().compile({
    canonicalSpec: buildMinimalCanonicalSpec({ sizing }),
    fallbackPositionPct: 10,
  })

  expect(result.ir.portfolio.sizing).toEqual(expected)
})
```

If no `buildMinimalCanonicalSpec` helper exists, add a local helper in the spec file that creates a version 2 canonical spec with one simple entry rule and the supplied sizing.

- [ ] **Step 3: Run failing tests**

Run:

```bash
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts -t "semantic position contract"
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-ir-compiler.service.spec.ts -t "canonical sizing"
```

Expected: canonical builder test fails until it reads `position.sizing`. IR test may already pass; keep it as regression coverage.

- [ ] **Step 4: Update canonical builder**

In `canonical-spec-builder.service.ts`, import `normalizeLegacyPositionSizing` and update `resolveSizingFromSemanticState()`:

```ts
private resolveSizingFromSemanticState(
  position: SemanticPositionState | null,
): CanonicalStrategySpecV2['sizing'] {
  if (!position || position.status !== 'locked' || !validateSemanticPositionContract(position).ok) {
    return null
  }

  const sizing = normalizeLegacyPositionSizing(position)
  if (!sizing) return null

  if (sizing.kind === 'quote') return { mode: 'QUOTE', value: sizing.value }
  if (sizing.kind === 'base') return { mode: 'QTY', value: sizing.value }
  return { mode: 'RATIO', value: sizing.value }
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-ir-compiler.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-ir-compiler.service.spec.ts
git commit -m "feat: map position sizing contract to canonical sizing"
```

---

### Task 6: Full Regression Verification

**Files:**
- No code changes unless verification exposes a bug.

- [ ] **Step 1: Run focused semantic contract tests**

Run:

```bash
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/position-sizing-contract.service.spec.ts
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-semantic-contracts.spec.ts
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-reducer.service.spec.ts
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts
AI_SKIP_ENV_CHECK=true dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-ir-compiler.service.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run lint**

Run:

```bash
AI_SKIP_ENV_CHECK=true dx lint
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
AI_SKIP_ENV_CHECK=true dx build quantify --prod
```

Expected: PASS.

- [ ] **Step 4: Inspect forbidden trigger key additions**

Run:

```bash
git diff origin/main...HEAD -- apps/quantify/src/modules/llm-strategy-codegen | rg "NORMALIZED_TRIGGER_ATOM_KEYS" || true
```

Expected: no additions to `NORMALIZED_TRIGGER_ATOM_KEYS`.

- [ ] **Step 5: Commit final verification notes only if files changed**

If no files changed:

```bash
git status --short
```

Expected: clean worktree.

If verification required fixes, commit them with:

```bash
git add <changed-files>
git commit -m "fix: complete position sizing contract integration"
```

---

## Self-Review

- Spec coverage:
  - Ratio, quote, and base contracts are implemented in Tasks 1-3.
  - Conversation completeness and neutral slot wording are implemented in Task 4.
  - Projection formatting is implemented in Task 4.
  - Canonical and IR mapping are implemented in Task 5.
  - No `NORMALIZED_TRIGGER_ATOM_KEYS` addition is checked in Task 6.
- Placeholder scan:
  - No `TBD`, `TODO`, or “implement later” placeholders.
  - Every task includes exact files, commands, expected results, and code snippets.
- Type consistency:
  - `SemanticPositionSizingContract`, `position.sizing`, and `validateSemanticPositionContract` are used consistently across tasks.
