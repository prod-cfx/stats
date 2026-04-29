# AI Quant Semantic Seed Open Slots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the PR #921 seed-boundary migration so seed extraction can preserve locked and open semantic nodes instead of dropping partially recognized strategy semantics.

**Architecture:** Extend the seed patch node envelope, move patch-to-`SemanticState` conversion into a focused builder service, and teach seed extraction to emit `condition.expression` nodes for previous-bar high/low comparisons plus open breakout nodes for partial references. The canonical path remains `SemanticState -> CanonicalSpec`; normalizedIntent stays a compatibility adapter only.

**Tech Stack:** NestJS service classes, TypeScript strict mode, Jest unit tests via `dx test unit quantify`, existing `SemanticState` / `CodegenSemanticPatch` types.

---

## File Structure

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts`
  - Add optional semantic node envelope fields to patch trigger, action, risk, and position shapes.
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts`
  - Own conversion from `CodegenSemanticPatch` to `SemanticState`, preserving optional `status`, `source`, `evidence`, and `openSlots`.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
  - Inject and delegate to `SemanticSeedStateBuilderService`; remove private conversion helpers or leave wrappers that call the service for compatibility.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts`
  - Register `SemanticSeedStateBuilderService`.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
  - Emit previous high/low `condition.expression` triggers and partial breakout open nodes.
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts`
  - Cover envelope preservation and backwards compatibility.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`
  - Cover previous high/low extraction and partial reference open slots.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts`
  - Stop casting `CodegenConversationService` as a private factory if the builder is extracted; add compileability regression for the BTCUSDT previous high/low strategy.

---

### Task 1: Extend Patch Types

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts`

- [ ] **Step 1: Write type-level shape in the patch type file**

Replace the current import and interfaces with this structure, keeping the existing `CodegenSemanticTriggerParams` export:

```ts
import type {
  SemanticEvidence,
  SemanticExpression,
  SemanticNodeStatus,
  SemanticPositionSizingContract,
  SemanticSlotState,
  SemanticSource,
} from './semantic-state'

export type CodegenSemanticTriggerParams = Record<string, unknown> & {
  expression?: SemanticExpression
}

export interface CodegenSemanticNodeEnvelope {
  id?: string
  status?: SemanticNodeStatus
  source?: SemanticSource
  evidence?: SemanticEvidence
  openSlots?: SemanticSlotState[]
}

export interface CodegenSemanticPatch {
  contextSlots?: Record<string, string | number | boolean | null>
  triggers?: Array<CodegenSemanticNodeEnvelope & {
    key: string
    phase: 'entry' | 'exit' | 'risk' | 'gate'
    sideScope?: 'long' | 'short' | 'both'
    params?: CodegenSemanticTriggerParams
  }>
  actions?: Array<CodegenSemanticNodeEnvelope & {
    key: string
    params?: Record<string, unknown>
  }>
  risk?: Array<CodegenSemanticNodeEnvelope & {
    key: string
    params: Record<string, unknown>
  }>
  position?: (CodegenSemanticNodeEnvelope & {
    sizing?: SemanticPositionSizingContract | null
    mode: string
    value: number
    positionMode: string
  }) | null
}
```

- [ ] **Step 2: Run the type-related tests**

Run:

```bash
dx test unit quantify -- --runInBand strategy-semantic-contracts
```

Expected: PASS. If the CLI does not forward the Jest pattern in this environment, run the broader command:

```bash
dx test unit quantify -- --runInBand
```

Expected: PASS or existing unrelated failures only.

- [ ] **Step 3: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts
git commit -F - <<'MSG'
feat: 扩展语义 seed patch 节点 envelope

变更说明：
- 为 CodegenSemanticPatch 节点补充 status/source/evidence/openSlots
- 保持现有轻量 seed patch 输入兼容

Refs: #921
MSG
```

---

### Task 2: Extract Semantic Seed State Builder

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`

- [ ] **Step 1: Write failing builder tests**

Create `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts`:

```ts
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'

describe('SemanticSeedStateBuilderService', () => {
  const service = new SemanticSeedStateBuilderService()

  it('preserves open trigger envelope from semantic seed patch', () => {
    const state = service.build({
      triggers: [{
        id: 'trigger-open-breakout',
        key: 'price.breakout_up',
        phase: 'entry',
        sideScope: 'long',
        status: 'open',
        source: 'user_explicit',
        params: { reference: 'unknown' },
        evidence: { text: '突破关键位置开多', source: 'user_explicit' },
        openSlots: [{
          slotKey: 'trigger.reference_definition',
          fieldPath: 'triggers[0].params.reference',
          status: 'open',
          priority: 'core',
          questionHint: '请确认突破参考位置如何定义。',
          affectsExecution: true,
          evidence: { text: '关键位置', source: 'user_explicit' },
        }],
      }],
    })

    expect(state?.triggers[0]).toEqual(expect.objectContaining({
      id: 'trigger-open-breakout',
      key: 'price.breakout_up',
      phase: 'entry',
      sideScope: 'long',
      status: 'open',
      source: 'user_explicit',
      params: { reference: 'unknown' },
      openSlots: [expect.objectContaining({
        slotKey: 'trigger.reference_definition',
        status: 'open',
      })],
    }))
  })

  it('keeps legacy lightweight trigger patches locked by default', () => {
    const state = service.build({
      triggers: [{
        key: 'condition.expression',
        phase: 'entry',
        sideScope: 'long',
        params: {
          expression: {
            kind: 'predicate',
            op: 'GT',
            left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
            right: { kind: 'series', source: 'bar', field: 'open', offsetBars: 0 },
          },
        },
      }],
      actions: [{ key: 'open_long' }],
    })

    expect(state?.triggers[0]).toEqual(expect.objectContaining({
      status: 'locked',
      source: 'user_explicit',
      openSlots: [],
    }))
    expect(state?.actions[0]).toEqual(expect.objectContaining({
      status: 'locked',
      source: 'user_explicit',
    }))
  })
})
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
dx test unit quantify -- --runInBand semantic-seed-state-builder
```

Expected: FAIL because `SemanticSeedStateBuilderService` does not exist.

- [ ] **Step 3: Implement the builder service**

Create `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts` with the conversion logic currently embedded in `CodegenConversationService`, plus envelope preservation:

```ts
import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'
import type {
  SemanticActionState,
  SemanticNodeStatus,
  SemanticPositionSizingContract,
  SemanticRiskState,
  SemanticSlotState,
  SemanticState,
  SemanticTriggerState,
} from '../types/semantic-state'
import { Injectable } from '@nestjs/common'

@Injectable()
export class SemanticSeedStateBuilderService {
  build(semanticPatch: unknown): SemanticState | null {
    if (!semanticPatch || typeof semanticPatch !== 'object' || Array.isArray(semanticPatch)) return null

    const record = semanticPatch as Record<string, unknown>
    const triggerItems = Array.isArray(record.triggers) ? record.triggers : (Array.isArray(record.triggerUpdates) ? record.triggerUpdates : [])
    const actionItems = Array.isArray(record.actions) ? record.actions : (Array.isArray(record.actionUpdates) ? record.actionUpdates : [])
    const riskItems = Array.isArray(record.risk) ? record.risk : (Array.isArray(record.riskUpdates) ? record.riskUpdates : [])
    const positionUpdate = this.toPositionState(record.position ?? record.positionUpdate)
    const contextSlots = this.toContextSlots(record.contextSlots ?? record.contextUpdates ?? record.context)

    const triggers = triggerItems.map((item, index) => this.toTriggerState(item, index)).filter((item): item is SemanticTriggerState => item !== null)
    const actions = actionItems.map((item, index) => this.toActionState(item, index)).filter((item): item is SemanticActionState => item !== null)
    const risk = riskItems.map((item, index) => this.toRiskState(item, index)).filter((item): item is SemanticRiskState => item !== null)

    if (triggers.length === 0 && actions.length === 0 && risk.length === 0 && !positionUpdate && !Object.values(contextSlots).some(Boolean)) {
      return null
    }

    return {
      version: 1,
      families: [],
      triggers,
      actions,
      risk,
      position: positionUpdate,
      contextSlots,
      normalizationNotes: [],
      updatedAt: new Date().toISOString(),
    }
  }

  private toTriggerState(update: unknown, index: number): SemanticTriggerState | null {
    if (!this.isRecord(update)) return null
    const key = this.readTrimmedString(update.key)
    const phase = update.phase
    if (!key || (phase !== 'entry' && phase !== 'exit' && phase !== 'risk' && phase !== 'gate')) return null

    const openSlots = this.readOpenSlots(update.openSlots)
    return {
      id: this.readTrimmedString(update.id) ?? `planner-trigger-${index + 1}`,
      key,
      phase,
      params: this.readParams(update.params),
      ...(update.sideScope === 'long' || update.sideScope === 'short' || update.sideScope === 'both' ? { sideScope: update.sideScope } : {}),
      status: this.resolveNodeStatus(update.status, openSlots),
      source: update.source === 'inferred' || update.source === 'derived' ? update.source : 'user_explicit',
      ...(this.isRecord(update.evidence) && typeof update.evidence.text === 'string' && typeof update.evidence.source === 'string'
        ? { evidence: update.evidence as SemanticTriggerState['evidence'] }
        : {}),
      openSlots,
    }
  }

  private toActionState(update: unknown, index: number): SemanticActionState | null {
    if (!this.isRecord(update)) return null
    const key = this.readTrimmedString(update.key)
    if (!key) return null
    const openSlots = this.readOpenSlots(update.openSlots)
    return {
      id: this.readTrimmedString(update.id) ?? `planner-action-${index + 1}`,
      key,
      ...(this.isRecord(update.params) ? { params: { ...update.params } } : {}),
      status: this.resolveNodeStatus(update.status, openSlots),
      source: update.source === 'inferred' || update.source === 'derived' ? update.source : 'user_explicit',
      ...(this.isRecord(update.evidence) && typeof update.evidence.text === 'string' && typeof update.evidence.source === 'string'
        ? { evidence: update.evidence as SemanticActionState['evidence'] }
        : {}),
    }
  }

  private toRiskState(update: unknown, index: number): SemanticRiskState | null {
    if (!this.isRecord(update)) return null
    const key = this.readTrimmedString(update.key)
    if (!key) return null
    const openSlots = this.readOpenSlots(update.openSlots)
    return {
      id: this.readTrimmedString(update.id) ?? `planner-risk-${index + 1}`,
      key,
      params: this.readParams(update.params),
      status: this.resolveNodeStatus(update.status, openSlots),
      source: update.source === 'inferred' || update.source === 'derived' ? update.source : 'user_explicit',
      ...(this.isRecord(update.evidence) && typeof update.evidence.text === 'string' && typeof update.evidence.source === 'string'
        ? { evidence: update.evidence as SemanticRiskState['evidence'] }
        : {}),
      openSlots,
    }
  }

  private toPositionState(update: unknown): SemanticState['position'] {
    if (!this.isRecord(update)) return null
    const sizing = this.readPositionSizing(update.sizing)
    if (typeof update.mode !== 'string' || typeof update.positionMode !== 'string' || typeof update.value !== 'number' || !Number.isFinite(update.value)) {
      return null
    }
    const openSlots = this.readOpenSlots(update.openSlots)
    return {
      ...(sizing ? { sizing } : {}),
      mode: update.mode,
      value: update.value,
      positionMode: update.positionMode === 'both' ? 'long_short' : update.positionMode,
      status: this.resolveNodeStatus(update.status, openSlots),
      source: update.source === 'inferred' || update.source === 'derived' ? update.source : 'user_explicit',
      ...(this.isRecord(update.evidence) && typeof update.evidence.text === 'string' && typeof update.evidence.source === 'string'
        ? { evidence: update.evidence as SemanticState['position']['evidence'] }
        : {}),
      openSlots,
    }
  }

  private toContextSlots(update: unknown): SemanticState['contextSlots'] {
    if (!this.isRecord(update)) return { exchange: null, symbol: null, marketType: null, timeframe: null }
    return {
      exchange: this.toContextSlot('exchange', update.exchange),
      symbol: this.toContextSlot('symbol', update.symbol),
      marketType: this.toContextSlot('marketType', update.marketType),
      timeframe: this.toContextSlot('timeframe', update.timeframe),
    }
  }

  private toContextSlot(field: 'exchange' | 'symbol' | 'marketType' | 'timeframe', value: unknown): SemanticState['contextSlots'][typeof field] {
    if (typeof value !== 'string' || !value.trim()) return null
    const questionHints = {
      exchange: '请确认交易所（binance / okx / hyperliquid）。',
      symbol: '请确认策略交易标的（例如 BTCUSDT）。',
      marketType: '请确认市场类型（现货或合约/perp）。',
      timeframe: '请确认策略主周期（例如 15m 或 1h）。',
    } as const
    return {
      slotKey: field,
      fieldPath: `contextSlots.${field}`,
      value: value.trim(),
      status: 'locked',
      priority: 'context',
      questionHint: questionHints[field],
      affectsExecution: true,
    }
  }

  private resolveNodeStatus(value: unknown, openSlots: SemanticSlotState[]): SemanticNodeStatus {
    if (value === 'superseded') return 'superseded'
    if (value === 'open' || openSlots.some(slot => slot.status === 'open')) return 'open'
    return 'locked'
  }

  private readOpenSlots(value: unknown): SemanticSlotState[] {
    if (!Array.isArray(value)) return []
    return value.filter((item): item is SemanticSlotState => this.isSemanticSlot(item))
  }

  private isSemanticSlot(value: unknown): value is SemanticSlotState {
    return this.isRecord(value)
      && typeof value.slotKey === 'string'
      && typeof value.fieldPath === 'string'
      && (value.status === 'open' || value.status === 'locked' || value.status === 'superseded')
      && (value.priority === 'core' || value.priority === 'behavior' || value.priority === 'risk' || value.priority === 'context')
      && typeof value.questionHint === 'string'
      && typeof value.affectsExecution === 'boolean'
  }

  private readParams(value: unknown): Record<string, unknown> {
    return this.isRecord(value) ? { ...value } : {}
  }

  private readPositionSizing(value: unknown): SemanticPositionSizingContract | null {
    if (!this.isRecord(value) || typeof value.value !== 'number' || !Number.isFinite(value.value) || value.value <= 0) return null
    if (value.kind === 'ratio' && (value.unit === 'ratio' || value.unit === 'percent')) return { kind: 'ratio', value: value.value, unit: value.unit }
    if (value.kind === 'quote' && (value.asset === 'USDT' || value.asset === 'USDC' || value.asset === 'USD')) return { kind: 'quote', value: value.value, asset: value.asset }
    if (value.kind === 'base' && typeof value.asset === 'string' && /^[A-Z][A-Z0-9]{1,15}$/u.test(value.asset)) return { kind: 'base', value: value.value, asset: value.asset }
    return null
  }

  private readTrimmedString(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value)
  }
}
```

- [ ] **Step 4: Wire builder into module and conversation service**

Modify `apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts`:

```ts
import { SemanticSeedStateBuilderService } from './services/semantic-seed-state-builder.service'
```

Add `SemanticSeedStateBuilderService` to `providers` next to `SemanticSeedExtractorService`.

Modify `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`:

```ts
import { SemanticSeedStateBuilderService } from './semantic-seed-state-builder.service'
```

Add the constructor dependency after `semanticSeedExtractor`:

```ts
private readonly semanticSeedStateBuilder: SemanticSeedStateBuilderService = new SemanticSeedStateBuilderService(),
```

Replace the body of `buildSemanticStateFromPlannerPatch()` with:

```ts
private buildSemanticStateFromPlannerPatch(
  semanticPatch: unknown,
): SemanticState | null {
  return this.semanticSeedStateBuilder.build(semanticPatch)
}
```

Remove now-unused private helper methods from `CodegenConversationService` only after TypeScript reports them unused. Keep the wrapper method because existing tests access it through a cast.

- [ ] **Step 5: Run builder and conversation tests**

Run:

```bash
dx test unit quantify -- --runInBand semantic-seed-state-builder codegen-conversation.service
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-state-builder.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts
git commit -F - <<'MSG'
refactor: 抽出语义 seed state builder

变更说明：
- 将 seed patch 到 SemanticState 的转换从会话服务抽出
- 保留旧 patch 默认 locked 行为
- 保留 openSlots/status/evidence 节点 envelope

Refs: #921
MSG
```

---

### Task 3: Add Previous Bar High/Low Seed Expressions

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`

- [ ] **Step 1: Write failing seed extractor tests**

Add these tests to `SemanticSeedExtractorService` spec:

```ts
it('extracts previous bar high breakout and previous bar low breakdown expressions', () => {
  const patch = service.extract('用 BTCUSDT 1m K 线。如果最新收盘价突破上一根 K 线最高价，且当前没有持仓，则开多，使用可用余额的 3%。如果最新收盘价跌破上一根 K 线最低价，则平多。')

  expect(patch.triggers).toEqual(expect.arrayContaining([
    expect.objectContaining({
      key: 'condition.expression',
      phase: 'entry',
      sideScope: 'long',
      params: {
        expression: {
          kind: 'predicate',
          op: 'GT',
          left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
          right: { kind: 'series', source: 'bar', field: 'high', offsetBars: 1 },
        },
      },
    }),
    expect.objectContaining({
      key: 'condition.expression',
      phase: 'gate',
      sideScope: 'long',
      params: {
        expression: {
          kind: 'predicate',
          op: 'EQ',
          left: { kind: 'position', field: 'has_position', side: 'long' },
          right: { kind: 'constant', value: false },
        },
      },
    }),
    expect.objectContaining({
      key: 'condition.expression',
      phase: 'exit',
      sideScope: 'long',
      params: {
        expression: {
          kind: 'predicate',
          op: 'LT',
          left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
          right: { kind: 'series', source: 'bar', field: 'low', offsetBars: 1 },
        },
      },
    }),
  ]))
  expect(patch.actions).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'open_long' }),
    expect.objectContaining({ key: 'close_long' }),
  ]))
  expect(patch.position).toEqual({
    mode: 'fixed_ratio',
    value: 0.03,
    positionMode: 'long_only',
    sizing: { kind: 'ratio', value: 0.03, unit: 'ratio' },
  })
})
```

- [ ] **Step 2: Run seed extractor test and verify it fails**

Run:

```bash
dx test unit quantify -- --runInBand semantic-seed-extractor
```

Expected: FAIL because previous high/low expressions are not extracted.

- [ ] **Step 3: Implement previous high/low expression extraction**

In `semantic-seed-extractor.service.ts`, add a new trigger extractor before generic breakout extraction:

```ts
private pushPreviousBarExtremaExpressionTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
  for (const clause of this.splitLogicClauses(segment)) {
    const expression = this.extractPreviousBarExtremaExpression(clause)
    if (!expression) continue

    const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
    if (!intent) continue

    this.pushTrigger(triggers, seen, {
      key: 'condition.expression',
      phase: intent.phase,
      sideScope: intent.sideScope,
      params: { expression },
    })
  }
}

private extractPreviousBarExtremaExpression(clause: string): SemanticExpression | null {
  const compact = clause.replace(/\s+/gu, '')
  const closeLatest = /(?:最新|当前)?(?:K线)?收盘价|close/iu
  const previousHigh = /(?:上一根|前一根|上根)(?:K线)?(?:最高价|最高|高点|high)/iu
  const previousLow = /(?:上一根|前一根|上根)(?:K线)?(?:最低价|最低|低点|low)/iu

  if (closeLatest.test(compact) && previousHigh.test(compact) && /突破|升破|上破|高于|大于|超过|站上|>/u.test(compact)) {
    return {
      kind: 'predicate',
      op: 'GT',
      left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
      right: { kind: 'series', source: 'bar', field: 'high', offsetBars: 1 },
    }
  }

  if (closeLatest.test(compact) && previousLow.test(compact) && /跌破|下破|跌穿|低于|小于|失守|</u.test(compact)) {
    return {
      kind: 'predicate',
      op: 'LT',
      left: { kind: 'series', source: 'bar', field: 'close', offsetBars: 0 },
      right: { kind: 'series', source: 'bar', field: 'low', offsetBars: 1 },
    }
  }

  return null
}
```

Call it in `extractTriggers()` after `pushNoPositionGateTriggers()`:

```ts
this.pushPreviousBarExtremaExpressionTriggers(segment, triggers, seen)
```

- [ ] **Step 4: Ensure position sizing includes explicit sizing contract**

If the new test fails because percent sizing lacks `sizing`, update `extractPosition()` so ratio sizing returns:

```ts
return {
  sizing: { kind: 'ratio', value: percent / 100, unit: 'ratio' },
  mode: 'fixed_ratio',
  value: percent / 100,
  positionMode: this.resolvePositionMode(text, triggers),
}
```

- [ ] **Step 5: Run seed extractor tests**

Run:

```bash
dx test unit quantify -- --runInBand semantic-seed-extractor
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
git commit -F - <<'MSG'
feat: 抽取上一根 K 线高低点表达式语义

变更说明：
- 将最新收盘价突破上一根高点抽成 condition.expression
- 将最新收盘价跌破上一根低点抽成 condition.expression
- 保留无持仓 gate 与仓位 sizing 语义

Refs: #921
MSG
```

---

### Task 4: Emit Open Nodes for Partial Breakout References

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-reducer.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-reducer.service.ts`

- [ ] **Step 1: Write failing partial breakout seed test**

Add:

```ts
it('emits an open breakout trigger for undefined key reference phrases', () => {
  const patch = service.extract('突破关键位置开多，单笔 3%。')

  expect(patch.triggers).toEqual(expect.arrayContaining([
    expect.objectContaining({
      key: 'price.breakout_up',
      phase: 'entry',
      sideScope: 'long',
      status: 'open',
      params: expect.objectContaining({ reference: 'unknown' }),
      openSlots: [expect.objectContaining({
        slotKey: 'trigger.reference_definition',
        fieldPath: 'triggers[0].params.reference',
        status: 'open',
        priority: 'core',
        affectsExecution: true,
      })],
    }),
  ]))
})
```

- [ ] **Step 2: Implement open breakout seed emission**

Add a helper in `semantic-seed-extractor.service.ts`:

```ts
private pushPartialBreakoutTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
  if (!/(突破|升破|上破|跌破|下破|失守).{0,12}(关键位置|支撑|压力|阻力)/u.test(segment)) return

  for (const clause of this.splitLogicClauses(segment)) {
    const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
    if (!intent) continue

    const isDown = /跌破|下破|失守|支撑/u.test(clause)
    const referenceText = /支撑/u.test(clause)
      ? '支撑'
      : /压力|阻力/u.test(clause)
        ? '压力'
        : '关键位置'

    this.pushTrigger(triggers, seen, {
      key: isDown ? 'price.breakout_down' : 'price.breakout_up',
      phase: intent.phase,
      sideScope: intent.sideScope,
      status: 'open',
      params: { reference: 'unknown', referenceText },
      evidence: { text: clause, source: 'user_explicit' },
      openSlots: [{
        slotKey: 'trigger.reference_definition',
        fieldPath: `triggers[${triggers.length}].params.reference`,
        status: 'open',
        priority: 'core',
        questionHint: `请确认${referenceText}如何定义。`,
        affectsExecution: true,
        evidence: { text: referenceText, source: 'user_explicit' },
      }],
    })
  }
}
```

Call it before `pushBreakoutTriggers()`:

```ts
this.pushPartialBreakoutTriggers(segment, triggers, seen)
```

- [ ] **Step 3: Teach reducer to lock reference definition answers**

Add a reducer spec:

```ts
it('locks trigger reference definition slots from clarification answers', () => {
  const next = service.applyClarificationAnswer({
    currentState: {
      version: 1,
      families: [],
      triggers: [{
        id: 'trigger-open-breakout',
        key: 'price.breakout_up',
        phase: 'entry',
        sideScope: 'long',
        params: { reference: 'unknown' },
        status: 'open',
        source: 'user_explicit',
        openSlots: [{
          slotKey: 'trigger.reference_definition',
          fieldPath: 'triggers[0].params.reference',
          status: 'open',
          priority: 'core',
          questionHint: '请确认关键位置如何定义。',
          affectsExecution: true,
        }],
      }],
      actions: [{ id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' }],
      risk: [],
      position: null,
      contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
      normalizationNotes: [],
      updatedAt: '2026-04-29T00:00:00.000Z',
    },
    targetSlotKey: 'trigger.reference_definition',
    targetFieldPath: 'triggers[0].params.reference',
    answer: '最近 20 根 K 线高点',
  })

  expect(next.triggers[0]).toEqual(expect.objectContaining({
    status: 'locked',
    params: expect.objectContaining({
      reference: 'channel_high',
      period: 20,
    }),
  }))
})
```

Implement in `SemanticStateReducerService.reduceSupportedSlot()` before generic slot reducers:

```ts
if (slot.slotKey === 'trigger.reference_definition') {
  const periodMatch = answerText.match(/最近\s*(\d{1,4})\s*根\s*K?\s*线/u)
  const period = periodMatch?.[1] ? Number(periodMatch[1]) : null
  const reference = /低点|最低|支撑/u.test(answerText)
    ? 'channel_low'
    : /高点|最高|压力|阻力/u.test(answerText)
      ? 'channel_high'
      : null
  if (!reference || !period || !Number.isFinite(period)) return null
  return {
    paramKey: 'reference',
    paramValue: reference,
    slotValue: answerText,
    extraParams: { period },
  }
}
```

If `SupportedSlotReduction` only supports one param, extend it:

```ts
interface SupportedSlotReduction {
  paramKey: 'reference.period' | 'confirmationMode' | 'rangeLower' | 'rangeUpper' | 'stepPct' | 'sideMode' | 'reference'
  paramValue: number | string
  slotValue: number | string
  extraParams?: Record<string, number | string>
}
```

When applying the reduction, after setting the primary param, add:

```ts
if (reduction.extraParams) {
  Object.assign(trigger.params, reduction.extraParams)
}
```

- [ ] **Step 4: Run partial seed and reducer tests**

Run:

```bash
dx test unit quantify -- --runInBand semantic-seed-extractor semantic-state-reducer
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-reducer.service.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-reducer.service.spec.ts
git commit -F - <<'MSG'
feat: 保留未完成突破语义 open slots

变更说明：
- 将关键位置/支撑/压力突破识别为 open 语义节点
- 支持澄清答案将突破参考归约为通道高低点

Refs: #921
MSG
```

---

### Task 5: Add End-to-End Semantic Regression

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

- [ ] **Step 1: Add semantic-only regression for BTCUSDT previous high/low**

In `semantic-only-strategy-regression.spec.ts`, add:

```ts
it('compiles BTCUSDT previous bar high-low breakout semantics through SemanticState mainline', async () => {
  const semanticState = withLockedMarketContext(
    buildSemanticStateFromMessage('用 BTCUSDT 1m K 线。如果最新收盘价突破上一根 K 线最高价，且当前没有持仓，则开多，使用可用余额的 3%。如果最新收盘价跌破上一根 K 线最低价，则平多。'),
    { exchange: 'okx', marketType: 'perp', symbol: 'BTCUSDT', timeframe: '1m' },
  )

  const canonicalSpec = canonicalSpecBuilder.buildFromSemanticState(semanticState)

  expect(canonicalSpec.rules).toEqual(expect.arrayContaining([
    expect.objectContaining({
      phase: 'entry',
      actions: [expect.objectContaining({ type: 'OPEN_LONG' })],
    }),
    expect.objectContaining({
      phase: 'exit',
      actions: [expect.objectContaining({ type: 'CLOSE_LONG' })],
    }),
  ]))
  expect(canonicalSpec.sizing).toEqual({ mode: 'RATIO', value: 0.03 })
})
```

- [ ] **Step 2: Add conversation regression for the user-visible prompt**

In `codegen-conversation.service.spec.ts`, add a case near the existing seed extraction or compileability prompt tests:

```ts
it('does not ask for entry or exit rules after previous bar high-low seed semantics are complete', async () => {
  const result = await service.startSession({
    userId: 'u1',
    initialMessage: '用 BTCUSDT 1m K 线。如果最新收盘价突破上一根 K 线最高价，且当前没有持仓，则开多，使用可用余额的 3%。如果最新收盘价跌破上一根 K 线最低价，则平多。',
  } as StartCodegenSessionDto)

  expect(result.assistantPrompt).toContain('请确认交易所')
  expect(result.assistantPrompt).not.toContain('未识别可编译入场规则')
  expect(result.assistantPrompt).not.toContain('未识别可编译出场规则')
})
```

Use the local fixture style in that spec for repository and AI mocks. The test must not introduce network calls.

- [ ] **Step 3: Run regression tests**

Run:

```bash
dx test unit quantify -- --runInBand semantic-only-strategy-regression codegen-conversation.service
```

Expected: PASS.

- [ ] **Step 4: Run full targeted Quantify unit suite**

Run:

```bash
dx test unit quantify -- --runInBand
```

Expected: PASS. If unrelated existing failures appear, record the failing test names and rerun the affected new tests from Steps 3 and 4 to prove this change is not the cause.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -F - <<'MSG'
test: 覆盖上一根高低点语义主链路

变更说明：
- 验证 previous high/low seed 语义可编译为开多和平多规则
- 防止完整语义被误报为缺少入场或出场规则

Refs: #921
MSG
```

---

### Task 6: Final Verification

**Files:**
- Verify all modified files from Tasks 1-5.

- [ ] **Step 1: Run lint**

Run:

```bash
dx lint
```

Expected: PASS.

- [ ] **Step 2: Run Quantify build**

Run:

```bash
dx build quantify --dev
```

Expected: PASS.

- [ ] **Step 3: Run targeted tests one final time**

Run:

```bash
dx test unit quantify -- --runInBand semantic-seed-state-builder semantic-seed-extractor semantic-state-reducer semantic-only-strategy-regression codegen-conversation.service
```

Expected: PASS.

- [ ] **Step 4: Inspect final diff**

Run:

```bash
git diff --stat HEAD~5..HEAD
git status --short
```

Expected: the diff only contains the files listed in this plan, and `git status --short` is empty.

- [ ] **Step 5: Commit any final fixes**

If final verification required small fixes, commit them:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen
git commit -F - <<'MSG'
fix: 收敛语义 seed open slots 验证问题

变更说明：
- 修复最终验证发现的类型或测试问题

Refs: #921
MSG
```

If no fixes are needed, do not create an empty commit.
