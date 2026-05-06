# AI Quant Context Symbol Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade `contextSlots.symbol` so every strategy conversation entry point recognizes natural-language trading symbols through one market instrument resolver while preserving the existing context structure.

**Architecture:** Keep `contextSlots = { exchange, symbol, marketType, timeframe }` as the main context shape. Add a focused `MarketInstrumentSymbolResolver` plus a reusable symbol slot factory; route all authority writes into `contextSlots.symbol` through it, then let existing execution context, canonical spec, IR, publication, and backtest consumers continue reading normalized `contextSlots.symbol.value`.

**Tech Stack:** TypeScript, NestJS services, Jest unit tests, existing `dx test unit quantify` and `dx build quantify --dev` commands.

---

## File Structure

- Create `apps/quantify/src/modules/llm-strategy-codegen/types/market-instrument-symbol.ts`
  - Owns `MarketInstrumentSymbolResolution`, context symbol patch value types, and helper shape types used by resolver, extractor, builder, and answer resolver.
- Create `apps/quantify/src/modules/llm-strategy-codegen/services/market-instrument-symbol-resolver.service.ts`
  - Pure symbol recognition and canonicalization. No database, no remote market lookup, no strategy family logic.
- Create `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/market-instrument-symbol-resolver.service.spec.ts`
  - Resolver coverage for explicit pairs, spaced pairs, base-only, Chinese aliases, venue suffixes, explicit quote priority, and false positives.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`
  - Add optional `contracts?: SemanticAtomContract[]` to `SemanticSlotState`.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts`
  - Allow `contextSlots.symbol` to carry resolver output, not only a primitive string.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
  - Replace local symbol regex authority with resolver.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts`
  - Normalize string and structured symbol patch values through resolver; preserve symbol slot evidence and contracts.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-open-slot-answer-resolver.service.ts`
  - Fulfill open `contextSlots.symbol` answers through resolver and preserve contracts when merging fragment context slots.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/conversation-semantic-edit.service.ts`
  - Resolve replacement symbol edits like `把交易标的改成 ETH` and `换成 BTC 永续`.
- Modify tests:
  - `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`
  - `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts`
  - `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-open-slot-answer-resolver.service.spec.ts`
  - `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/conversation-semantic-edit.service.spec.ts`
  - `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
  - `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts`

## Task 1: Add Resolver Types And Unit Tests

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/types/market-instrument-symbol.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/market-instrument-symbol-resolver.service.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/market-instrument-symbol-resolver.service.spec.ts`

- [ ] **Step 1: Write failing resolver tests**

Create `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/market-instrument-symbol-resolver.service.spec.ts`:

```ts
import { MarketInstrumentSymbolResolverService } from '../market-instrument-symbol-resolver.service'

describe('MarketInstrumentSymbolResolverService', () => {
  const resolver = new MarketInstrumentSymbolResolverService()

  it.each([
    ['ETHUSDT', 'ETHUSDT', 'user_explicit', 'explicit'],
    ['ETH/USDT', 'ETHUSDT', 'user_explicit', 'explicit'],
    ['ETH-USDT', 'ETHUSDT', 'user_explicit', 'explicit'],
    ['ETH usdt', 'ETHUSDT', 'user_explicit', 'explicit'],
    ['ETH USDC', 'ETHUSDC', 'user_explicit', 'explicit'],
    ['BTC USD', 'BTCUSD', 'user_explicit', 'explicit'],
  ] as const)('resolves explicit symbol text %s', (input, value, source, quoteSource) => {
    expect(resolver.resolve(input)).toEqual(expect.objectContaining({
      value,
      source,
      quoteSource,
    }))
  })

  it.each([
    ['ETH', 'ETHUSDT', 'ETH'],
    ['BTC', 'BTCUSDT', 'BTC'],
    ['ETH 永续合约', 'ETHUSDT', 'ETH'],
    ['BTC 永续合约', 'BTCUSDT', 'BTC'],
    ['以太坊', 'ETHUSDT', 'ETH'],
    ['比特币合约', 'BTCUSDT', 'BTC'],
  ] as const)('resolves inferred USDT symbol text %s', (input, value, base) => {
    expect(resolver.resolve(input)).toEqual(expect.objectContaining({
      value,
      base,
      quote: 'USDT',
      source: 'inferred',
      quoteSource: 'default_usdt',
    }))
  })

  it.each([
    ['ETHUSDT-SWAP', 'ETHUSDT', 'ETHUSDT-SWAP'],
    ['ETHUSDT:PERP', 'ETHUSDT', 'ETHUSDT:PERP'],
  ] as const)('preserves venue symbol hints from %s', (input, value, venueSymbolHint) => {
    expect(resolver.resolve(input)).toEqual(expect.objectContaining({
      value,
      venueSymbolHint,
      marketTypeHint: 'perp',
    }))
  })

  it('does not infer ordinary English as a symbol', () => {
    expect(resolver.resolve('please continue the strategy')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/market-instrument-symbol-resolver.service.spec.ts
```

Expected: FAIL because `market-instrument-symbol-resolver.service.ts` does not exist.

- [ ] **Step 3: Add resolver types**

Create `apps/quantify/src/modules/llm-strategy-codegen/types/market-instrument-symbol.ts`:

```ts
import type { SemanticAtomContract, SemanticEvidence, SemanticSlotState } from './semantic-state'

export type MarketInstrumentQuote = 'USDT' | 'USDC' | 'USD'
export type MarketInstrumentSymbolSource = 'user_explicit' | 'inferred'
export type MarketInstrumentQuoteSource = 'explicit' | 'default_usdt'

export interface MarketInstrumentSymbolResolution {
  value: string
  source: MarketInstrumentSymbolSource
  evidenceText: string
  base: string
  quote: MarketInstrumentQuote
  quoteSource: MarketInstrumentQuoteSource
  venueSymbolHint?: string
  marketTypeHint?: 'perp' | 'spot'
}

export interface MarketInstrumentSymbolSlotPatch {
  slotKey?: 'symbol'
  fieldPath?: 'contextSlots.symbol'
  value: string
  status?: 'locked'
  source?: MarketInstrumentSymbolSource
  evidence?: SemanticEvidence
  contracts?: SemanticAtomContract[]
}

export type CodegenContextSlotPatchValue =
  | string
  | number
  | boolean
  | null
  | SemanticSlotState
  | MarketInstrumentSymbolResolution
  | MarketInstrumentSymbolSlotPatch
```

- [ ] **Step 4: Add minimal resolver implementation**

Create `apps/quantify/src/modules/llm-strategy-codegen/services/market-instrument-symbol-resolver.service.ts`:

```ts
import { Injectable } from '@nestjs/common'

import type {
  MarketInstrumentQuote,
  MarketInstrumentQuoteSource,
  MarketInstrumentSymbolResolution,
} from '../types/market-instrument-symbol'
import type { SemanticAtomContract } from '../types/semantic-state'
import { canonicalizeStrategySymbolInput } from './market-scope-equivalence'

const QUOTES = ['USDT', 'USDC', 'USD'] as const satisfies readonly MarketInstrumentQuote[]
const BASE_ALIASES: Record<string, string> = {
  BTC: 'BTC',
  XBT: 'BTC',
  比特币: 'BTC',
  大饼: 'BTC',
  ETH: 'ETH',
  以太坊: 'ETH',
  SOL: 'SOL',
  BNB: 'BNB',
  DOGE: 'DOGE',
  狗狗币: 'DOGE',
  XRP: 'XRP',
  ADA: 'ADA',
  PEPE: 'PEPE',
}

@Injectable()
export class MarketInstrumentSymbolResolverService {
  resolve(text: string | null | undefined): MarketInstrumentSymbolResolution | null {
    const sourceText = typeof text === 'string' ? text.trim() : ''
    if (!sourceText) return null

    return this.resolveExplicitPair(sourceText)
      ?? this.resolveVenueSymbol(sourceText)
      ?? this.resolveBaseOnly(sourceText)
  }

  buildContextContract(resolution: MarketInstrumentSymbolResolution): SemanticAtomContract {
    return {
      id: `contract-context-symbol-${resolution.value.toLowerCase()}`,
      kind: 'context',
      capabilities: [{
        domain: 'market',
        verb: 'identify',
        object: 'instrument',
        shape: {
          base: resolution.base,
          quote: resolution.quote,
          symbol: resolution.value,
          quoteSource: resolution.quoteSource,
          ...(resolution.venueSymbolHint ? { venueSymbolHint: resolution.venueSymbolHint } : {}),
          ...(resolution.marketTypeHint ? { marketTypeHint: resolution.marketTypeHint } : {}),
        },
      }],
      requires: [],
      params: {},
    }
  }

  private resolveExplicitPair(text: string): MarketInstrumentSymbolResolution | null {
    const quotePattern = QUOTES.join('|')
    const match = new RegExp(`\\\\b([A-Z0-9]{2,20})\\\\s*(?:[-/]|\\\\s)+(${quotePattern})\\\\b`, 'iu').exec(text)
      ?? new RegExp(`\\\\b([A-Z0-9]{2,20})(${quotePattern})\\\\b`, 'iu').exec(text)
    if (!match?.[1] || !match[2]) return null

    return this.buildResolution({
      base: match[1],
      quote: match[2].toUpperCase() as MarketInstrumentQuote,
      evidenceText: match[0],
      source: 'user_explicit',
      quoteSource: 'explicit',
    })
  }

  private resolveVenueSymbol(text: string): MarketInstrumentSymbolResolution | null {
    const match = /\b([A-Z0-9]{2,20}(?:USDT|USDC|USD)(?:-SWAP|:PERP|:SPOT))\b/iu.exec(text)
    if (!match?.[1]) return null

    const canonical = canonicalizeStrategySymbolInput(match[1])
    if (!canonical) return null

    const pair = this.splitCanonicalPair(canonical)
    if (!pair) return null

    return this.buildResolution({
      base: pair.base,
      quote: pair.quote,
      evidenceText: match[1],
      source: 'user_explicit',
      quoteSource: 'explicit',
      venueSymbolHint: match[1].toUpperCase(),
      marketTypeHint: /(?:-SWAP|:PERP)$/iu.test(match[1]) ? 'perp' : undefined,
    })
  }

  private resolveBaseOnly(text: string): MarketInstrumentSymbolResolution | null {
    const normalizedText = text.trim()
    const candidates = Object.keys(BASE_ALIASES).sort((left, right) => right.length - left.length)
    const alias = candidates.find(candidate => new RegExp(`(?:^|[^A-Za-z0-9])${this.escapeRegExp(candidate)}(?:$|[^A-Za-z0-9])`, 'iu').test(normalizedText))
    if (!alias) return null

    return this.buildResolution({
      base: BASE_ALIASES[alias],
      quote: 'USDT',
      evidenceText: alias,
      source: 'inferred',
      quoteSource: 'default_usdt',
      marketTypeHint: /合约|永续|perp|swap|\bcontract\b/iu.test(normalizedText) ? 'perp' : undefined,
    })
  }

  private buildResolution(input: {
    base: string
    quote: MarketInstrumentQuote
    evidenceText: string
    source: MarketInstrumentSymbolResolution['source']
    quoteSource: MarketInstrumentQuoteSource
    venueSymbolHint?: string
    marketTypeHint?: 'perp' | 'spot'
  }): MarketInstrumentSymbolResolution {
    const base = input.base.toUpperCase()
    const quote = input.quote.toUpperCase() as MarketInstrumentQuote
    return {
      value: `${base}${quote}`,
      source: input.source,
      evidenceText: input.evidenceText,
      base,
      quote,
      quoteSource: input.quoteSource,
      ...(input.venueSymbolHint ? { venueSymbolHint: input.venueSymbolHint } : {}),
      ...(input.marketTypeHint ? { marketTypeHint: input.marketTypeHint } : {}),
    }
  }

  private splitCanonicalPair(symbol: string): { base: string, quote: MarketInstrumentQuote } | null {
    const quote = QUOTES.find(item => symbol.endsWith(item))
    if (!quote) return null
    const base = symbol.slice(0, -quote.length)
    return base ? { base, quote } : null
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  }
}
```

- [ ] **Step 5: Run resolver test to verify it passes**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/market-instrument-symbol-resolver.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit resolver**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/market-instrument-symbol.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/market-instrument-symbol-resolver.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/market-instrument-symbol-resolver.service.spec.ts
git commit -F - <<'MSG'
feat: add market instrument symbol resolver

Refs: #968
MSG
```

## Task 2: Extend Symbol Slot Contract Support In Semantic State Builder

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts`

- [ ] **Step 1: Write failing builder tests**

Append these tests to `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts`:

```ts
  it('normalizes string context symbol values through the market instrument resolver', () => {
    const state = service.build({
      contextSlots: {
        symbol: 'ETH usdt',
      },
      triggers: [{
        key: 'execution.on_start',
        phase: 'entry',
        sideScope: 'long',
        params: {},
      }],
      actions: [{ key: 'open_long' }],
    })

    expect(state?.contextSlots.symbol).toEqual(expect.objectContaining({
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      value: 'ETHUSDT',
      status: 'locked',
      evidence: expect.objectContaining({
        text: 'ETH usdt',
        source: 'user_explicit',
      }),
      contracts: expect.arrayContaining([
        expect.objectContaining({
          kind: 'context',
          capabilities: expect.arrayContaining([
            expect.objectContaining({
              domain: 'market',
              verb: 'identify',
              object: 'instrument',
              shape: expect.objectContaining({
                base: 'ETH',
                quote: 'USDT',
                symbol: 'ETHUSDT',
                quoteSource: 'explicit',
              }),
            }),
          ]),
        }),
      ]),
    }))
  })

  it('normalizes structured inferred symbol patch values and preserves inferred evidence', () => {
    const state = service.build({
      contextSlots: {
        symbol: {
          value: 'ETH',
          source: 'inferred',
          evidenceText: 'ETH',
          base: 'ETH',
          quote: 'USDT',
          quoteSource: 'default_usdt',
        },
      },
      triggers: [{
        key: 'execution.on_start',
        phase: 'entry',
        sideScope: 'long',
        params: {},
      }],
      actions: [{ key: 'open_long' }],
    })

    expect(state?.contextSlots.symbol?.value).toBe('ETHUSDT')
    expect(state?.contextSlots.symbol?.evidence).toEqual(expect.objectContaining({
      text: 'ETH',
      source: 'inferred',
    }))
  })
```

- [ ] **Step 2: Run builder tests to verify they fail**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts -t "normalizes .*symbol"
```

Expected: FAIL because `SemanticSlotState` has no `contracts` and builder does not normalize symbol strings.

- [ ] **Step 3: Extend semantic slot and patch types**

In `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`, update `SemanticSlotState`:

```ts
export interface SemanticSlotState {
  slotKey: string
  fieldPath: string
  value?: string | number | boolean | null
  status: SemanticNodeStatus
  priority: SemanticPriority
  questionHint: string
  affectsExecution: boolean
  evidence?: SemanticEvidence
  supersedes?: string[]
  contracts?: SemanticAtomContract[]
}
```

In `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts`, add the type import and replace `contextSlots`:

```ts
import type { CodegenContextSlotPatchValue } from './market-instrument-symbol'
```

```ts
export interface CodegenSemanticPatch {
  contextSlots?: Partial<Record<'exchange' | 'symbol' | 'marketType' | 'timeframe', CodegenContextSlotPatchValue>>
}
```

- [ ] **Step 4: Normalize symbol in builder**

In `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts`, add imports:

```ts
import type { MarketInstrumentSymbolResolution } from '../types/market-instrument-symbol'
import { MarketInstrumentSymbolResolverService } from './market-instrument-symbol-resolver.service'
```

Update the class constructor:

```ts
@Injectable()
export class SemanticSeedStateBuilderService {
  constructor(
    private readonly symbolResolver: MarketInstrumentSymbolResolverService = new MarketInstrumentSymbolResolverService(),
  ) {}
```

Update `toContextSlot()` so the first branch is symbol-specific:

```ts
  private toContextSlot(
    field: ContextField,
    value: unknown,
  ): SemanticState['contextSlots'][typeof field] {
    if (field === 'symbol') {
      return this.toSymbolContextSlot(value)
    }

    if (this.isRecord(value)) {
      const slot = this.toSlotState(value, {
        slotKey: field,
        fieldPath: `contextSlots.${field}`,
        priority: 'context',
        questionHint: CONTEXT_QUESTION_HINTS[field],
      })
      return slot
    }

    const trimmedValue = this.readTrimmedString(value)
    if (!trimmedValue) {
      return null
    }

    return {
      slotKey: field,
      fieldPath: `contextSlots.${field}`,
      value: trimmedValue,
      status: 'locked',
      priority: 'context',
      questionHint: CONTEXT_QUESTION_HINTS[field],
      affectsExecution: true,
    }
  }
```

Add these helper methods near `toContextSlot()`:

```ts
  private toSymbolContextSlot(value: unknown): SemanticState['contextSlots']['symbol'] {
    if (this.isRecord(value) && typeof value.value === 'string') {
      const resolution = this.resolveSymbolValue(value)
      if (resolution) {
        return this.buildSymbolContextSlot(resolution, value.supersedes)
      }

      const slot = this.toSlotState(value, {
        slotKey: 'symbol',
        fieldPath: 'contextSlots.symbol',
        priority: 'context',
        questionHint: CONTEXT_QUESTION_HINTS.symbol,
      })
      return slot
    }

    const trimmedValue = this.readTrimmedString(value)
    if (!trimmedValue) {
      return null
    }

    const resolution = this.symbolResolver.resolve(trimmedValue)
    if (!resolution) {
      return {
        slotKey: 'symbol',
        fieldPath: 'contextSlots.symbol',
        value: trimmedValue,
        status: 'locked',
        priority: 'context',
        questionHint: CONTEXT_QUESTION_HINTS.symbol,
        affectsExecution: true,
      }
    }

    return this.buildSymbolContextSlot(resolution)
  }

  private resolveSymbolValue(value: Record<string, unknown>): MarketInstrumentSymbolResolution | null {
    if (
      typeof value.value === 'string'
      && typeof value.base === 'string'
      && (value.quote === 'USDT' || value.quote === 'USDC' || value.quote === 'USD')
      && (value.source === 'user_explicit' || value.source === 'inferred')
      && (value.quoteSource === 'explicit' || value.quoteSource === 'default_usdt')
    ) {
      return {
        value: value.value,
        source: value.source,
        evidenceText: typeof value.evidenceText === 'string' ? value.evidenceText : value.value,
        base: value.base,
        quote: value.quote,
        quoteSource: value.quoteSource,
        ...(value.venueSymbolHint && typeof value.venueSymbolHint === 'string' ? { venueSymbolHint: value.venueSymbolHint } : {}),
        ...(value.marketTypeHint === 'perp' || value.marketTypeHint === 'spot' ? { marketTypeHint: value.marketTypeHint } : {}),
      }
    }

    return this.symbolResolver.resolve(value.value)
  }

  private buildSymbolContextSlot(
    resolution: MarketInstrumentSymbolResolution,
    supersedesValue?: unknown,
  ): SemanticSlotState {
    const supersedes = this.readStringArray(supersedesValue)
    return {
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      value: resolution.value,
      status: 'locked',
      priority: 'context',
      questionHint: CONTEXT_QUESTION_HINTS.symbol,
      affectsExecution: true,
      evidence: {
        text: resolution.evidenceText,
        source: resolution.source,
      },
      ...(supersedes ? { supersedes } : {}),
      contracts: [this.symbolResolver.buildContextContract(resolution)],
    }
  }
```

In `toSlotState()`, preserve slot contracts:

```ts
    const contracts = this.readContracts(value.contracts)
```

and add this to the returned object:

```ts
      ...(contracts ? { contracts } : {}),
```

- [ ] **Step 5: Run builder tests to verify they pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts -t "normalizes .*symbol"
```

Expected: PASS.

- [ ] **Step 6: Commit builder support**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts \
  apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts
git commit -F - <<'MSG'
feat: carry context symbol contracts in semantic state

Refs: #968
MSG
```

## Task 3: Route Seed Extraction Through Resolver

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`

- [ ] **Step 1: Write failing seed extractor tests**

Append to `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`:

```ts
  it('extracts spaced quote symbols from initial strategy text', () => {
    const patch = service.extract('ETH usdt，在 2500 到 3200 之间做多空网格，2倍杠杆，突破区间就停止。')

    expect(patch.contextSlots?.symbol).toEqual(expect.objectContaining({
      value: 'ETHUSDT',
      source: 'user_explicit',
      quoteSource: 'explicit',
      base: 'ETH',
      quote: 'USDT',
    }))
  })

  it('extracts inferred base-only symbols from contract strategy text', () => {
    const patch = service.extract('ETH永续合约，突破 3200 做多，跌破 2500 停止。')

    expect(patch.contextSlots?.symbol).toEqual(expect.objectContaining({
      value: 'ETHUSDT',
      source: 'inferred',
      quoteSource: 'default_usdt',
      base: 'ETH',
      quote: 'USDT',
      marketTypeHint: 'perp',
    }))
    expect(patch.contextSlots?.marketType).toBe('perp')
  })
```

- [ ] **Step 2: Run seed extractor tests to verify they fail**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts -t "symbols from .*strategy text"
```

Expected: FAIL because `extractSymbol()` returns only primitive compact symbols.

- [ ] **Step 3: Inject resolver and replace symbol extraction**

In `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`, add import:

```ts
import { MarketInstrumentSymbolResolverService } from './market-instrument-symbol-resolver.service'
```

Add constructor:

```ts
@Injectable()
export class SemanticSeedExtractorService {
  constructor(
    private readonly symbolResolver: MarketInstrumentSymbolResolverService = new MarketInstrumentSymbolResolverService(),
  ) {}
```

Replace `extractContextSlots()` symbol handling:

```ts
    const symbol = this.extractSymbol(text)
    if (symbol) {
      contextSlots.symbol = symbol
      if (symbol.marketTypeHint && !contextSlots.marketType) {
        contextSlots.marketType = symbol.marketTypeHint
      }
    }
```

Replace `extractSymbol()`:

```ts
  private extractSymbol(text: string) {
    return this.symbolResolver.resolve(text)
  }
```

- [ ] **Step 4: Run seed extractor tests to verify they pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts -t "symbols from .*strategy text"
```

Expected: PASS.

- [ ] **Step 5: Run existing seed extractor context tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts -t "contextSlots|contract market wording|symbol"
```

Expected: PASS after updating any assertions that expected `patch.contextSlots.symbol` to be a string to assert `value`.

- [ ] **Step 6: Commit seed extraction**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
git commit -F - <<'MSG'
feat: resolve context symbols during seed extraction

Refs: #968
MSG
```

## Task 4: Fulfill Symbol Open Slot Answers Through Resolver

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-open-slot-answer-resolver.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-open-slot-answer-resolver.service.spec.ts`

- [ ] **Step 1: Write failing symbol answer tests**

Append to `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-open-slot-answer-resolver.service.spec.ts`:

```ts
  it('closes an open symbol context slot from a base-only answer', () => {
    const currentState = buildStateWithOpenSymbolSlot()
    const result = service.resolve({
      currentState,
      message: 'ETH',
    })

    expect(result.consumed).toBe(true)
    expect(result.nextState.contextSlots.symbol).toEqual(expect.objectContaining({
      value: 'ETHUSDT',
      status: 'locked',
      evidence: expect.objectContaining({
        text: 'ETH',
        source: 'inferred',
      }),
      contracts: expect.arrayContaining([
        expect.objectContaining({ kind: 'context' }),
      ]),
    }))
  })

  it('closes an open symbol context slot from an explicit quote answer', () => {
    const currentState = buildStateWithOpenSymbolSlot()
    const result = service.resolve({
      currentState,
      message: 'ETH usdc',
    })

    expect(result.consumed).toBe(true)
    expect(result.nextState.contextSlots.symbol?.value).toBe('ETHUSDC')
  })
```

Add this helper in the same spec file if no equivalent helper exists:

```ts
function buildStateWithOpenSymbolSlot(): SemanticState {
  return {
    version: 1,
    families: [],
    triggers: [],
    actions: [],
    risk: [],
    position: null,
    contextSlots: {
      exchange: null,
      symbol: {
        slotKey: 'symbol',
        fieldPath: 'contextSlots.symbol',
        value: null,
        status: 'open',
        priority: 'context',
        questionHint: '请确认策略交易标的（例如 BTCUSDT）。',
        affectsExecution: true,
      },
      marketType: null,
      timeframe: null,
    },
    normalizationNotes: [],
    updatedAt: new Date('2026-05-06T00:00:00.000Z').toISOString(),
  }
}
```

- [ ] **Step 2: Run answer tests to verify they fail**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-open-slot-answer-resolver.service.spec.ts -t "symbol context slot"
```

Expected: FAIL because resolver currently only closes level-set and semantic fragment slots.

- [ ] **Step 3: Add symbol answer resolution**

In `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-open-slot-answer-resolver.service.ts`, import resolver:

```ts
import { MarketInstrumentSymbolResolverService } from './market-instrument-symbol-resolver.service'
```

Update constructor:

```ts
  constructor(
    private readonly shapeNormalizer: SemanticContractShapeNormalizerService = new SemanticContractShapeNormalizerService(),
    private readonly seedExtractor: SemanticSeedExtractorService = new SemanticSeedExtractorService(),
    private readonly symbolResolver: MarketInstrumentSymbolResolverService = new MarketInstrumentSymbolResolverService(),
  ) {}
```

At the start of `resolve()`, after density answer handling and before fragment fulfillment, add:

```ts
    const symbolAnswer = this.resolveSymbolAnswer(input.currentState, input.message)
    if (symbolAnswer) {
      return symbolAnswer
    }
```

Add method inside class:

```ts
  private resolveSymbolAnswer(
    state: SemanticState,
    message: string,
  ): SemanticOpenSlotAnswerResolverResult | null {
    const current = state.contextSlots.symbol
    if (current?.status !== 'open') {
      return null
    }

    const resolution = this.symbolResolver.resolve(message)
    if (!resolution) {
      return null
    }

    const nextSlot: SemanticSlotState = {
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      value: resolution.value,
      status: 'locked',
      priority: 'context',
      questionHint: current.questionHint,
      affectsExecution: true,
      evidence: {
        text: resolution.evidenceText,
        source: resolution.source,
      },
      contracts: [this.symbolResolver.buildContextContract(resolution)],
    }

    return {
      consumed: true,
      nextState: {
        ...state,
        contextSlots: {
          ...state.contextSlots,
          symbol: nextSlot,
        },
      },
      answer: {},
      closedSlotKeys: ['symbol'],
      closedSlots: [{ slotKey: 'symbol', fieldPath: 'contextSlots.symbol' }],
    }
  }
```

- [ ] **Step 4: Preserve contracts when merging fragment context slots**

Change `mergeFragmentContextSlot()` value parameter type to `CodegenSemanticPatch['contextSlots'][keyof SemanticContextSlotState] | undefined`, then make symbol-specific creation:

```ts
function mergeFragmentContextSlot(
  field: keyof SemanticContextSlotState,
  current: SemanticSlotState | null,
  value: CodegenSemanticPatch['contextSlots'][keyof SemanticContextSlotState] | undefined,
): SemanticSlotState | null {
  if (current?.status === 'locked' || value === undefined || value === null) {
    return current
  }

  return createLockedContextSlot(field, value)
}
```

Update `createLockedContextSlot()` to accept structured values and preserve contracts:

```ts
function createLockedContextSlot(
  field: keyof SemanticContextSlotState,
  value: CodegenSemanticPatch['contextSlots'][keyof SemanticContextSlotState],
): SemanticSlotState {
  if (field === 'symbol' && typeof value === 'object' && value && 'value' in value && typeof value.value === 'string') {
    return {
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      value: value.value,
      status: 'locked',
      priority: 'context',
      questionHint: contextQuestionHint(field),
      affectsExecution: true,
      ...('evidence' in value && value.evidence ? { evidence: value.evidence } : {}),
      ...('contracts' in value && Array.isArray(value.contracts) ? { contracts: value.contracts } : {}),
    }
  }

  return {
    slotKey: field,
    fieldPath: `contextSlots.${field}`,
    value: value as string | number | boolean,
    status: 'locked',
    priority: 'context',
    questionHint: contextQuestionHint(field),
    affectsExecution: true,
    evidence: {
      text: String(value),
      source: 'user_explicit',
    },
  }
}
```

- [ ] **Step 5: Run answer tests to verify they pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-open-slot-answer-resolver.service.spec.ts -t "symbol context slot"
```

Expected: PASS.

- [ ] **Step 6: Commit answer resolver**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-open-slot-answer-resolver.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-open-slot-answer-resolver.service.spec.ts
git commit -F - <<'MSG'
feat: fulfill symbol context slot answers

Refs: #968
MSG
```

## Task 5: Route Semantic Symbol Edits Through Resolver

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/conversation-semantic-edit.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/conversation-semantic-edit.service.spec.ts`

- [ ] **Step 1: Write failing semantic edit tests**

Append to `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/conversation-semantic-edit.service.spec.ts`:

```ts
  it('updates the symbol context slot from a base-only semantic edit', () => {
    const state = buildEditableSemanticState()
    const next = service.apply({
      currentState: state,
      message: '把交易标的改成 ETH',
    })

    expect(next.contextSlots.symbol).toEqual(expect.objectContaining({
      value: 'ETHUSDT',
      evidence: expect.objectContaining({
        text: 'ETH',
        source: 'inferred',
      }),
      contracts: expect.arrayContaining([
        expect.objectContaining({ kind: 'context' }),
      ]),
    }))
  })

  it('updates the symbol context slot from a spaced quote semantic edit', () => {
    const state = buildEditableSemanticState()
    const next = service.apply({
      currentState: state,
      message: '交易标的改成 ETH usdc',
    })

    expect(next.contextSlots.symbol?.value).toBe('ETHUSDC')
  })
```

Create this helper in the same spec file:

```ts
function buildEditableSemanticState(): SemanticState {
  return {
    version: 1,
    families: [],
    triggers: [],
    actions: [],
    risk: [],
    position: null,
    contextSlots: {
      exchange: null,
      symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'BTCUSDT', status: 'locked', priority: 'context', questionHint: '请选择标的。', affectsExecution: true },
      marketType: null,
      timeframe: null,
    },
    normalizationNotes: [],
    updatedAt: new Date('2026-05-06T00:00:00.000Z').toISOString(),
  }
}
```

- [ ] **Step 2: Run semantic edit tests to verify they fail**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/conversation-semantic-edit.service.spec.ts -t "symbol context slot from .*semantic edit"
```

Expected: FAIL because `extractReplacementSymbol()` only accepts compact symbol characters and returns a string.

- [ ] **Step 3: Add resolver to semantic edit service**

In `apps/quantify/src/modules/llm-strategy-codegen/services/conversation-semantic-edit.service.ts`, import resolver:

```ts
import { MarketInstrumentSymbolResolverService } from './market-instrument-symbol-resolver.service'
```

Add constructor parameter if the service already has a constructor; otherwise add:

```ts
  constructor(
    private readonly symbolResolver: MarketInstrumentSymbolResolverService = new MarketInstrumentSymbolResolverService(),
  ) {}
```

Change `extractReplacementSymbol()` return type to a slot value:

```ts
  private extractReplacementSymbol(message: string): SemanticSlotState | null {
    const explicitMatch = /交易标的\s*(?:改为|改成|换成)\s*(.+)$/u.exec(message)
    const explicitResolution = this.symbolResolver.resolve(explicitMatch?.[1])
    if (explicitResolution) return this.buildSymbolSlot(explicitResolution)

    const valueReplacementMatch = /(?:把\s*)?(.+?)\s*(?:改为|改成|换成|替换为|修改为|更改为)\s*(.+)$/iu.exec(message)
    const toResolution = this.symbolResolver.resolve(valueReplacementMatch?.[2])
    if (toResolution) {
      return this.buildSymbolSlot(toResolution)
    }
    return null
  }
```

Add helper:

```ts
  private buildSymbolSlot(resolution: MarketInstrumentSymbolResolution): SemanticSlotState {
    return {
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      value: resolution.value,
      status: 'locked',
      priority: 'context',
      questionHint: '请确认策略交易标的（例如 BTCUSDT）。',
      affectsExecution: true,
      evidence: {
        text: resolution.evidenceText,
        source: resolution.source,
      },
      contracts: [this.symbolResolver.buildContextContract(resolution)],
    }
  }
```

Update `extractReplacementContextOperation()` to return `SemanticSlotState` for symbol and string for other fields:

```ts
  private extractReplacementContextOperation(
    message: string,
  ): { field: 'symbol', slot: SemanticSlotState } | { field: Exclude<SemanticEditContextField, 'symbol'>, value: string } | null {
    const symbol = this.extractReplacementSymbol(message)
    if (symbol) return { field: 'symbol', slot: symbol }

    const timeframe = /(?:主周期|周期)\s*(?:改为|改成|换成)\s*([0-9]+[mhdw])/iu.exec(message)?.[1]
    if (timeframe) return { field: 'timeframe', value: timeframe.toLowerCase() }

    const exchange = /(?:交易所|平台)\s*(?:改为|改成|换成)\s*([A-Za-z0-9_-]+)/u.exec(message)?.[1]
    if (exchange) return { field: 'exchange', value: exchange.toLowerCase() }

    const marketType = /(?:市场类型|市场)\s*(?:改为|改成|换成)\s*(现货|合约|永续|spot|perp|swap)/iu.exec(message)?.[1]
    if (!marketType) return null

    return {
      field: 'marketType',
      value: this.normalizeMarketType(marketType),
    }
  }
```

In the code that applies context operations, set `contextSlots.symbol = operation.slot` when `operation.field === 'symbol'`.

- [ ] **Step 4: Run semantic edit tests to verify they pass**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/conversation-semantic-edit.service.spec.ts -t "symbol context slot from .*semantic edit"
```

Expected: PASS.

- [ ] **Step 5: Commit semantic edit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/conversation-semantic-edit.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/conversation-semantic-edit.service.spec.ts
git commit -F - <<'MSG'
feat: normalize symbol semantic edits

Refs: #968
MSG
```

## Task 6: Add Mainflow Conversation And Publication Regression

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts`

- [ ] **Step 1: Write conversation regression test**

Add this test near existing grid or context slot conversation regressions in `codegen-conversation.service.spec.ts`:

```ts
  it('does not ask for symbol again after initial spaced ETH USDT grid text and later okx answer', async () => {
    const start = await service.startSession({
      userId: 'u1',
      message: 'ETH usdt，在 2500 到 3200 之间做多空网格，2倍杠杆，突破区间就停止。',
    })

    expect(start.semanticState?.contextSlots.symbol).toEqual(expect.objectContaining({
      value: 'ETHUSDT',
      status: 'locked',
    }))

    const afterGridCount = await service.continueSession(start.id, {
      userId: 'u1',
      message: '15格',
    })
    const afterBudget = await service.continueSession(start.id, {
      userId: 'u1',
      message: '100usdt',
    })
    const afterExchange = await service.continueSession(start.id, {
      userId: 'u1',
      message: 'okx',
    })

    expect(afterGridCount.assistantPrompt).not.toContain('请确认策略交易标的')
    expect(afterBudget.assistantPrompt).not.toContain('请确认策略交易标的')
    expect(afterExchange.assistantPrompt).not.toContain('请确认策略交易标的')

    const updatePayload = mockRepo.updateSession.mock.calls.at(-1)?.[1] as Record<string, any>
    expect(updatePayload.semanticState.contextSlots.symbol.value).toBe('ETHUSDT')
    expect(updatePayload.semanticState.contextSlots.exchange.value).toBe('okx')
  })
```

If the current `codegen-conversation.service.spec.ts` does not expose `startSession()` in this shape, build the session with the file's existing `buildLegacyChecklistBridgeSessionFixture()` helper and run the same `continueSession()` messages. The assertions must remain exactly on `contextSlots.symbol.value` and absence of `请确认策略交易标的`.

- [ ] **Step 2: Write publication consistency test**

Add to `codegen-publication-generation.stage.spec.ts` near existing semantic context publication tests:

```ts
  it('uses normalized semantic context symbol in generated publication artifacts', async () => {
    const semanticState = buildPublishableSemanticState()
    semanticState.contextSlots.symbol = {
      slotKey: 'symbol',
      fieldPath: 'contextSlots.symbol',
      value: 'ETHUSDT',
      status: 'locked',
      priority: 'context',
      questionHint: '请选择标的。',
      affectsExecution: true,
      evidence: { text: 'ETH usdt', source: 'user_explicit' },
    }

    const result = await stage.generate({
      ...buildGenerationInput(),
      semanticState,
    })

    expect(result.strategyConfig.symbol).toBe('ETHUSDT')
    expect(result.paramsSnapshot.symbol).toBe('ETHUSDT')
    expect(result.lockedParams.symbol).toBe('ETHUSDT')
    expect(result.strategyConfig.symbol).not.toBe('BTCUSDT')
    expect(result.strategyConfig.symbol).not.toBe('UNKNOWN')
  })
```

If the current `codegen-publication-generation.stage.spec.ts` uses different local helper names, create local helpers named `buildPublishableSemanticStateForSymbolContract()` and `buildGenerationInputForSymbolContract()` by copying the smallest valid publishable fixture already present in that file. The expected artifact fields in the assertions must remain exact.

- [ ] **Step 3: Run conversation regression to verify it fails before all integrations are complete**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts -t "does not ask for symbol again"
```

Expected before Tasks 3-5 are complete: FAIL. Expected after Tasks 3-5 are complete: PASS.

- [ ] **Step 4: Run publication regression**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts -t "normalized semantic context symbol"
```

Expected: PASS. If it fails because publication falls back to canonical spec symbol, update only the stage's semantic context read helper to prefer locked `semanticState.contextSlots.symbol.value`.

- [ ] **Step 5: Commit mainflow regressions**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts
git commit -F - <<'MSG'
test: cover context symbol mainflow regressions

Refs: #968
MSG
```

## Task 7: Symbol Authority Audit And Final Verification

**Files:**
- Modify: `docs/superpowers/specs/2026-05-06-ai-quant-context-symbol-contract-design.md`

- [ ] **Step 1: Run symbol write audit**

Run:

```bash
rg -n "contextSlots\\.symbol|contextSlots\\?\\.symbol|market\\.symbol|symbols\\[0\\]|canonicalizeStrategySymbolInput|extractSymbol\\(" apps/quantify/src/modules/llm-strategy-codegen/services apps/quantify/src/modules/llm-strategy-codegen/types
```

Expected: every authority write is in one of these resolver-backed files:

- `market-instrument-symbol-resolver.service.ts`
- `semantic-seed-extractor.service.ts`
- `semantic-seed-state-builder.service.ts`
- `semantic-open-slot-answer-resolver.service.ts`
- `conversation-semantic-edit.service.ts`

Expected: read-only consumers remain in canonical, IR, publication, strategy summary, graph, consistency, and display services.

- [ ] **Step 2: Update spec audit note with implementation evidence**

Append this section to `docs/superpowers/specs/2026-05-06-ai-quant-context-symbol-contract-design.md`:

```md
## Implementation Audit

- Authority Write: `SemanticSeedExtractorService`, `SemanticSeedStateBuilderService`, `SemanticOpenSlotAnswerResolverService`, and `ConversationSemanticEditService` route symbol writes through `MarketInstrumentSymbolResolverService`.
- Compatibility Input: planner and legacy context symbol values enter through `SemanticSeedStateBuilderService`, which normalizes strings and structured symbol values before creating `contextSlots.symbol`.
- Validation / Display: canonical, IR, publication, graph, consistency, and summary services continue reading `contextSlots.symbol` after normalization and do not decide user-facing symbol clarification.
- Regression Evidence: resolver, seed extractor, seed state builder, open slot answer, semantic edit, conversation, and publication tests cover the symbol authority path.
```

- [ ] **Step 3: Run focused unit tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/market-instrument-symbol-resolver.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts -t "symbols from .*strategy text"
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts -t "normalizes .*symbol"
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-open-slot-answer-resolver.service.spec.ts -t "symbol context slot"
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/conversation-semantic-edit.service.spec.ts -t "symbol context slot from .*semantic edit"
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts -t "does not ask for symbol again"
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts -t "normalized semantic context symbol"
```

Expected: all commands PASS.

- [ ] **Step 4: Run broader verification**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-open-slot-answer-resolver.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/conversation-semantic-edit.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts -t "symbol|context|grid"
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts -t "symbol|context|publication"
dx build quantify --dev
```

Expected: all tests PASS and `dx build quantify --dev` exits 0.

- [ ] **Step 5: Commit audit and verification note**

```bash
git add docs/superpowers/specs/2026-05-06-ai-quant-context-symbol-contract-design.md
git commit -F - <<'MSG'
docs: add context symbol implementation audit

Refs: #968
MSG
```

## Self-Review

- Spec coverage: resolver output, supported expressions, slot contract metadata, seed extraction, builder ingestion, open slot answers, semantic edit, legacy/planner ingestion, mainflow conversation, and publication consistency are mapped to Tasks 1-7.
- Type consistency: `MarketInstrumentSymbolResolution`, `SemanticSlotState.contracts`, `CodegenContextSlotPatchValue`, and `MarketInstrumentSymbolResolverService.buildContextContract()` are introduced before later tasks consume them.
- Scope control: exchange, marketType, timeframe, canonical spec shape, IR shape, and publication field shape remain unchanged.
- Verification: focused tests prove each authority write path; broader tests and build catch downstream type or behavior regressions.
