# AI Quant Semantic Display Logic Graph Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate the existing AI Quant logic graph UI from completed locked `SemanticState` atoms so new strategies no longer show unsupported condition placeholders.

**Architecture:** Add a backend semantic display graph projection that outputs the same `blocks/items` shape the frontend already renders. Attach that projection to `specDesc.displayLogicGraph` when codegen builds confirmation/publication spec descriptions, then make the frontend builder prefer that server projection and keep the old `specDesc.rules` parser as a compatibility fallback.

**Tech Stack:** TypeScript, NestJS quantify service, React/Next frontend utilities, Jest/Vitest-style repo tests through `dx`.

---

## File Structure

- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`
  - Owns semantic state read/projection logic.
  - Add exported display graph interfaces and `buildDisplayLogicGraph(state: SemanticState)`.
  - Reuse existing semantic expression, risk, position, and context formatting helpers.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/spec-desc-builder.service.ts`
  - Accept optional `semanticState` in `SpecDescBuildExtras`.
  - Attach `displayLogicGraph` to returned `specDesc` only when semantic state is complete enough to project.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
  - Pass `semanticState` into `specDescBuilder.buildFromCanonicalSpec()` at confirmation/publication paths that currently only pass `normalizedIntent` and `executionContext`.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts`
  - Add direct backend projection tests for the BTCUSDT/OKX 1m perp example and expression/group/action/risk coverage.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/spec-desc-builder.service.spec.ts`
  - Assert `displayLogicGraph` is included when `semanticState` is supplied and absent when it is not.
- Modify `apps/front/src/components/ai-quant/display-logic-graph.ts`
  - Add type guard for server-provided `specDesc.displayLogicGraph`.
  - Return it before reading legacy `specDesc.rules`.
- Modify `apps/front/src/components/ai-quant/display-logic-graph.test.ts`
  - Add frontend preference test that proves server display graph bypasses unsupported legacy condition parsing.

## Task 1: Backend Semantic Display Graph Projection

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts`

- [ ] **Step 1: Add failing test for the user BTCUSDT strategy**

Append this test inside `describe('SemanticStateProjectionService', () => { ... })` in `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts`:

```ts
  it('builds display logic graph from locked semantic atoms for previous candle breakout strategy', () => {
    const state: SemanticState = {
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'semantic-entry-1',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'long',
          params: {
            expression: {
              kind: 'predicate',
              op: 'GT',
              left: { kind: 'series', source: 'bar', field: 'close' },
              right: { kind: 'series', source: 'bar', field: 'high', offsetBars: 1 },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'semantic-exit-1',
          key: 'condition.expression',
          phase: 'exit',
          sideScope: 'long',
          params: {
            expression: {
              kind: 'predicate',
              op: 'LT',
              left: { kind: 'series', source: 'bar', field: 'close' },
              right: { kind: 'series', source: 'bar', field: 'low', offsetBars: 1 },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'semantic-gate-1',
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
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] },
        { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit', openSlots: [] },
      ],
      risk: [
        {
          id: 'risk-stop-loss',
          key: 'risk.stop_loss_pct',
          params: { valuePct: 1, basis: 'entry_avg_price' },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      position: {
        sizing: { kind: 'ratio', value: 0.03, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.03,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      contextSlots: {
        exchange: {
          slotKey: 'exchange',
          fieldPath: 'contextSlots.exchange',
          value: 'okx',
          status: 'locked',
          priority: 'context',
          questionHint: '请选择交易所',
          affectsExecution: true,
        },
        symbol: {
          slotKey: 'symbol',
          fieldPath: 'contextSlots.symbol',
          value: 'BTCUSDT',
          status: 'locked',
          priority: 'context',
          questionHint: '请选择交易标的',
          affectsExecution: true,
        },
        marketType: {
          slotKey: 'marketType',
          fieldPath: 'contextSlots.marketType',
          value: 'perp',
          status: 'locked',
          priority: 'context',
          questionHint: '请选择市场类型',
          affectsExecution: true,
        },
        timeframe: {
          slotKey: 'timeframe',
          fieldPath: 'contextSlots.timeframe',
          value: '1m',
          status: 'locked',
          priority: 'context',
          questionHint: '请选择周期',
          affectsExecution: true,
        },
      },
      normalizationNotes: [],
      updatedAt: '2026-04-29T00:00:00.000Z',
    }

    const graph = service.buildDisplayLogicGraph(state)
    const text = graph.blocks.flatMap(block => block.items.map(item => item.text)).join(' ')

    expect(graph.blocks.map(block => block.type)).toEqual(['IF', 'AND_AT_THEN', 'EXECUTE'])
    expect(graph.blocks[0]?.items.map(item => item.text)).toEqual([
      '收盘价高于前 1 根最高价，且持有多仓等于false',
      '开多 3%',
    ])
    expect(graph.blocks[1]?.items.map(item => item.text)).toEqual([
      '收盘价低于前 1 根最低价',
      '平多',
    ])
    expect(text).toContain('交易所: OKX')
    expect(text).toContain('标的: BTCUSDT')
    expect(text).toContain('周期: 1m')
    expect(text).toContain('仓位: 3%')
    expect(text).toContain('市场: 永续')
    expect(text).toContain('风控: 止损：价格相对入场均价下跌1% 强制平仓 -> 平仓')
    expect(text).not.toContain('不支持的条件')
    expect(text).not.toContain('待补充')
  })
```

- [ ] **Step 2: Run the new backend test and verify it fails**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts -t "builds display logic graph from locked semantic atoms"
```

Expected: FAIL because `buildDisplayLogicGraph` does not exist on `SemanticStateProjectionService`.

- [ ] **Step 3: Add display graph types and public method**

In `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`, add these interfaces after `SemanticConversationView`:

```ts
type SemanticDisplayBlockType = 'IF' | 'AND_AT_THEN' | 'OR_THEN' | 'EXECUTE'

interface SemanticDisplayBaseItem {
  id: string
  text: string
}

export interface SemanticDisplayConditionItem extends SemanticDisplayBaseItem {
  kind: 'condition'
}

export interface SemanticDisplayActionItem extends SemanticDisplayBaseItem {
  kind: 'action'
}

export interface SemanticDisplayExecuteItem extends SemanticDisplayBaseItem {
  kind: 'execute'
  key: string
  value?: string
}

export interface SemanticDisplayLogicGraph {
  blocks: Array<{
    type: SemanticDisplayBlockType
    items: Array<SemanticDisplayConditionItem | SemanticDisplayActionItem | SemanticDisplayExecuteItem>
  }>
}
```

Inside `SemanticStateProjectionService`, add this public method near `buildConversationView()`:

```ts
  buildDisplayLogicGraph(state: SemanticState): SemanticDisplayLogicGraph {
    const triggers = this.filterDeterministicTriggers(state.triggers)
      .filter(trigger => trigger.phase === 'entry' || trigger.phase === 'exit')
      .sort((left, right) => this.compareTriggers(left, right))
    const gates = this.filterDeterministicTriggers(state.triggers)
      .filter(trigger => trigger.phase === 'gate')
      .sort((left, right) => this.compareTriggers(left, right))
    const actions = this.filterDeterministicActions(state.actions)
    const entryActionText = this.resolveEntryActionText(actions, state.position)
    const blocks = triggers.map((trigger, index) => {
      const conditionText = this.buildDisplayTriggerCondition(trigger, gates)
      const actionText = this.resolveTriggerActionText(trigger, entryActionText)
      return {
        type: this.resolveDisplayBlockType(trigger, index),
        items: [
          { kind: 'condition' as const, id: `condition-${trigger.id}`, text: conditionText },
          { kind: 'action' as const, id: `action-${trigger.id}`, text: actionText },
        ],
      }
    })

    const executeBlock = this.buildDisplayExecuteBlock(state)
    return {
      blocks: [...blocks, executeBlock],
    }
  }
```

- [ ] **Step 4: Add helper methods for trigger/action/execute projection**

Still in `SemanticStateProjectionService`, add these private helpers before `buildExecutionContext()`:

```ts
  private resolveDisplayBlockType(trigger: SemanticState['triggers'][number], index: number): SemanticDisplayBlockType {
    if (index === 0) return 'IF'
    const join = typeof trigger.params.join === 'string' ? trigger.params.join.toUpperCase() : ''
    return join === 'OR' ? 'OR_THEN' : 'AND_AT_THEN'
  }

  private buildDisplayTriggerCondition(
    trigger: SemanticState['triggers'][number],
    gates: SemanticState['triggers'],
  ): string {
    const base = this.formatTriggerConditionOnly(trigger)
    if (trigger.phase !== 'entry' || gates.length === 0) return base
    const gateText = gates
      .map(gate => this.formatTriggerConditionOnly(gate))
      .filter(item => item.length > 0)
      .join('，且')
    return gateText ? `${base}，且${gateText}` : base
  }

  private formatTriggerConditionOnly(trigger: SemanticState['triggers'][number]): string {
    if (trigger.key === 'condition.expression') {
      return this.formatSemanticExpression(trigger.params.expression)
    }
    const summary = this.buildTriggerSummary([trigger], false)
    return summary
      .replace(/^入场：/u, '')
      .replace(/^出场：/u, '')
      .replace(/时做多开仓$/u, '')
      .replace(/时做空开仓$/u, '')
      .replace(/时平多$/u, '')
      .replace(/时平空$/u, '')
      .replace(/时平仓$/u, '')
      .trim()
  }

  private resolveTriggerActionText(
    trigger: SemanticState['triggers'][number],
    entryActionText: string,
  ): string {
    if (trigger.phase === 'entry') return entryActionText
    if (trigger.sideScope === 'short') return '平空'
    if (trigger.sideScope === 'both') return '平仓'
    return '平多'
  }

  private resolveEntryActionText(
    actions: SemanticState['actions'],
    position: SemanticState['position'],
  ): string {
    const hasOpenShort = actions.some(action => action.key === 'open_short')
    const verb = hasOpenShort ? '开空' : '开多'
    const sizingText = this.formatDisplayPositionSizing(position)
    return sizingText ? `${verb} ${sizingText}` : verb
  }

  private formatDisplayPositionSizing(position: SemanticState['position']): string | null {
    if (!this.hasValidLockedPosition(position)) return null
    const sizing = position.sizing ?? normalizeLegacyPositionSizing(position)
    if (!sizing) return null
    if (sizing.kind === 'ratio') {
      const ratioValue = sizing.unit === 'percent' ? sizing.value : sizing.value * 100
      return `${this.formatPercent(ratioValue)}%`
    }
    if (sizing.kind === 'quote' || sizing.kind === 'base') {
      return `${this.formatNumber(sizing.value)} ${sizing.asset}`
    }
    return null
  }

  private buildDisplayExecuteBlock(state: SemanticState): SemanticDisplayLogicGraph['blocks'][number] {
    const items: SemanticDisplayExecuteItem[] = []
    const context = this.buildExecutionContext(state.contextSlots)
    this.pushExecuteItem(items, 'exchange', context.exchange, context.exchange ? `交易所: ${context.exchange.toUpperCase()}` : null)
    this.pushExecuteItem(items, 'symbol', context.symbol, context.symbol ? `标的: ${context.symbol}` : null)
    this.pushExecuteItem(items, 'timeframe', context.timeframe, context.timeframe ? `周期: ${context.timeframe}` : null)
    const positionSizing = this.formatDisplayPositionSizing(state.position)
    this.pushExecuteItem(items, 'positionSizing', positionSizing, positionSizing ? `仓位: ${positionSizing}` : null)
    this.pushExecuteItem(items, 'marketType', context.marketType, this.formatDisplayMarketType(context.marketType))
    this.filterDeterministicRisk(state.risk)
      .sort((left, right) => this.compareRiskAtoms(left, right))
      .map(risk => this.formatDisplayRiskSummary(risk))
      .filter((text): text is string => text.length > 0)
      .forEach((text, index) => {
        items.push({ kind: 'execute', id: `execute-risk-${index}`, key: 'risk', value: text, text })
      })
    return { type: 'EXECUTE', items }
  }

  private pushExecuteItem(
    items: SemanticDisplayExecuteItem[],
    key: string,
    value: string | null,
    text: string | null,
  ): void {
    if (!value || !text) return
    items.push({ kind: 'execute', id: `execute-${key}`, key, value, text })
  }

  private formatDisplayMarketType(value: string | null): string | null {
    if (value === 'spot') return '市场: 现货'
    if (value === 'perp') return '市场: 永续'
    return value ? `市场: ${value}` : null
  }

  private formatDisplayRiskSummary(risk: SemanticRiskState): string {
    if (risk.key === 'risk.stop_loss_pct') {
      const valuePct = risk.params.valuePct
      if (typeof valuePct !== 'number' || !Number.isFinite(valuePct) || valuePct <= 0) return ''
      const basis = this.describeRiskBasis(risk.params.basis)
      return `风控: 止损：价格相对${basis}下跌${this.formatPercent(valuePct)}% 强制平仓 -> 平仓`
    }
    if (risk.key === 'risk.take_profit_pct') {
      const valuePct = risk.params.valuePct
      if (typeof valuePct !== 'number' || !Number.isFinite(valuePct) || valuePct <= 0) return ''
      const basis = this.describeRiskBasis(risk.params.basis)
      return `风控: 止盈：价格相对${basis}上涨${this.formatPercent(valuePct)}% 平仓 -> 平仓`
    }
    const summary = this.buildRiskSummary([risk])
    return summary ? `风控: ${summary}` : ''
  }
```

- [ ] **Step 5: Run backend projection test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts -t "builds display logic graph from locked semantic atoms"
```

Expected: PASS.

- [ ] **Step 6: Commit backend projection**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts
git commit -F - <<'MSG'
feat: 投影原子语义逻辑图

变更说明：
- 新增 SemanticState 到现有逻辑图结构的展示投影
- 覆盖上一根高低点表达式、持仓准入、仓位与止损摘要

Refs: #936
MSG
```

## Task 2: Attach Display Graph To specDesc

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/spec-desc-builder.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/spec-desc-builder.service.spec.ts`

- [ ] **Step 1: Add failing spec-desc builder test**

Append this test to `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/spec-desc-builder.service.spec.ts`:

```ts
  it('attaches semantic display logic graph when semanticState is provided', () => {
    const semanticState: SemanticState = {
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'entry-close-gt-high',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'long',
          params: {
            expression: {
              kind: 'predicate',
              op: 'GT',
              left: { kind: 'series', source: 'bar', field: 'close' },
              right: { kind: 'series', source: 'bar', field: 'high', offsetBars: 1 },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [{ id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
      risk: [],
      position: {
        sizing: { kind: 'ratio', value: 0.03, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.03,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-29T00:00:00.000Z',
    }

    const specDesc = service.buildFromCanonicalSpec(
      {
        version: 2,
        market: { exchange: 'okx', symbol: 'BTCUSDT', marketType: 'perp', defaultTimeframe: '1m' },
        indicators: [],
        sizing: { mode: 'RATIO', value: 0.03 },
        executionPolicy: { signalTiming: 'BAR_CLOSE', fillTiming: 'NEXT_BAR_OPEN' },
        dataRequirements: { requiredTimeframes: ['1m'] },
        rules: [],
      },
      '',
      { semanticState },
    )

    expect(specDesc.displayLogicGraph).toEqual(expect.objectContaining({
      blocks: expect.arrayContaining([
        expect.objectContaining({ type: 'IF' }),
        expect.objectContaining({ type: 'EXECUTE' }),
      ]),
    }))
    expect(JSON.stringify(specDesc.displayLogicGraph)).toContain('收盘价高于前 1 根最高价')
    expect(JSON.stringify(specDesc.displayLogicGraph)).toContain('开多 3%')
  })
```

At the top of the test file, add:

```ts
import type { SemanticState } from '../../types/semantic-state'
```

- [ ] **Step 2: Run spec-desc test and verify it fails**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/spec-desc-builder.service.spec.ts -t "attaches semantic display logic graph"
```

Expected: FAIL because `semanticState` is not accepted in `SpecDescBuildExtras` and `displayLogicGraph` is not attached.

- [ ] **Step 3: Wire projection into SpecDescBuilderService**

Modify imports in `apps/quantify/src/modules/llm-strategy-codegen/services/spec-desc-builder.service.ts`:

```ts
import type { SemanticState } from '../types/semantic-state'
import { SemanticStateProjectionService } from './semantic-state-projection.service'
```

Extend `SpecDescBuildExtras`:

```ts
interface SpecDescBuildExtras {
  normalizedIntent?: StrategyNormalizedIntent | null
  executionContext?: StrategyExecutionContext | null
  semanticState?: SemanticState | null
}
```

Update constructor:

```ts
  constructor(
    private readonly digest: CanonicalSpecV2DigestService = new CanonicalSpecV2DigestService(),
    private readonly semanticProjection: SemanticStateProjectionService = new SemanticStateProjectionService(),
  ) {}
```

Inside `buildFromCanonicalSpec()`, before `return {`, add:

```ts
    const displayLogicGraph = extras?.semanticState
      ? this.semanticProjection.buildDisplayLogicGraph(extras.semanticState)
      : null
```

Inside the returned object, add this property near `summary`:

```ts
      ...(displayLogicGraph ? { displayLogicGraph } : {}),
```

- [ ] **Step 4: Run spec-desc test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/spec-desc-builder.service.spec.ts -t "attaches semantic display logic graph"
```

Expected: PASS.

- [ ] **Step 5: Commit specDesc attachment**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/spec-desc-builder.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/spec-desc-builder.service.spec.ts
git commit -F - <<'MSG'
feat: 在 specDesc 附加语义展示逻辑图

变更说明：
- SpecDescBuilder 支持从 semanticState 生成 displayLogicGraph
- 保持 canonical spec 与脚本生成主链路不变

Refs: #936
MSG
```

## Task 3: Pass SemanticState At Codegen specDesc Build Sites

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

- [ ] **Step 1: Add regression test for completed semantic confirmation response**

Add a focused test near the existing semantic confirmation tests in `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`:

```ts
  it('returns semantic display logic graph for completed previous candle breakout strategy', async () => {
    const semanticState: SemanticState = {
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'semantic-entry-1',
          key: 'condition.expression',
          phase: 'entry',
          sideScope: 'long',
          params: {
            expression: {
              kind: 'predicate',
              op: 'GT',
              left: { kind: 'series', source: 'bar', field: 'close' },
              right: { kind: 'series', source: 'bar', field: 'high', offsetBars: 1 },
            },
          },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
      ],
      actions: [{ id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit', openSlots: [] }],
      risk: [],
      position: {
        sizing: { kind: 'ratio', value: 0.03, unit: 'ratio' },
        mode: 'fixed_ratio',
        value: 0.03,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-29T00:00:00.000Z',
    }

    const canonicalSpec = service['buildCanonicalSpecForConversation'](
      semanticState,
      service['buildNormalizationFromSemanticState'](semanticState),
    )
    const specDesc = service['specDescBuilder'].buildFromCanonicalSpec(canonicalSpec, '', {
      normalizedIntent: canonicalSpec.metadata?.normalized?.intent ?? null,
      semanticState,
    })

    expect(specDesc).toEqual(expect.objectContaining({
      displayLogicGraph: expect.objectContaining({
        blocks: expect.arrayContaining([
          expect.objectContaining({ type: 'IF' }),
          expect.objectContaining({ type: 'EXECUTE' }),
        ]),
      }),
    }))
    expect(JSON.stringify(specDesc.displayLogicGraph)).toContain('收盘价高于前 1 根最高价')
    expect(JSON.stringify(specDesc.displayLogicGraph)).not.toContain('不支持的条件')
  })
```

If the test file does not already import `SemanticState`, add:

```ts
import type { SemanticState } from '../../types/semantic-state'
```

- [ ] **Step 2: Run focused conversation test and verify it fails**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts -t "returns semantic display logic graph for completed previous candle breakout strategy"
```

Expected: FAIL because the specDesc builder or codegen service path has not yet attached `displayLogicGraph`.

- [ ] **Step 3: Pass semanticState into buildFromCanonicalSpec calls**

In `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`, update calls that build current-session confirmation/publication `specDesc`. For each call that already has a local `semanticState`, `reducedSemanticState`, `semanticStateAfterAnswers`, `replacementState`, or `baseSemanticState`, include that value in the extras object.

Example pattern:

```ts
    const specDesc = this.specDescBuilder.buildFromCanonicalSpec(canonicalSpec, '', {
      normalizedIntent: normalization.normalizedIntent,
      executionContext: this.resolveSemanticClarificationArtifacts(reducedSemanticState).executionContext.context,
      semanticState: reducedSemanticState,
    })
```

For the confirmation view path around `confirmationViewSpecDesc`, use:

```ts
      {
        normalizedIntent: confirmationViewNormalization.normalizedIntent,
        executionContext: confirmationViewArtifacts.executionContext.context,
        semanticState: semanticStateAfterAnswers,
      },
```

Do not pass semantic state for legacy snapshot recovery paths unless the local recovered `semanticState` is already available and typed.

- [ ] **Step 4: Run focused conversation test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts -t "returns semantic display logic graph for completed previous candle breakout strategy"
```

Expected: PASS.

- [ ] **Step 5: Commit conversation wiring**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -F - <<'MSG'
fix: 生成确认逻辑图时传递语义状态

变更说明：
- 在 codegen specDesc 构建路径传递 locked SemanticState
- 让新生成策略返回后端 displayLogicGraph 展示投影

Refs: #936
MSG
```

## Task 4: Frontend Prefer Server Display Graph

**Files:**
- Modify: `apps/front/src/components/ai-quant/display-logic-graph.ts`
- Test: `apps/front/src/components/ai-quant/display-logic-graph.test.ts`

- [ ] **Step 1: Add failing frontend preference test**

Append this test to `apps/front/src/components/ai-quant/display-logic-graph.test.ts`:

```ts
  it('prefers server-provided displayLogicGraph over legacy condition-key parsing', () => {
    const graph = buildDisplayLogicGraphFromCodegenSpec({
      specDesc: {
        displayLogicGraph: {
          blocks: [
            {
              type: 'IF',
              items: [
                { kind: 'condition', id: 'condition-entry', text: '收盘价高于前 1 根最高价，且持有多仓等于false' },
                { kind: 'action', id: 'action-entry', text: '开多 3%' },
              ],
            },
            {
              type: 'EXECUTE',
              items: [
                { kind: 'execute', id: 'execute-exchange', key: 'exchange', value: 'okx', text: '交易所: OKX' },
              ],
            },
          ],
        },
        rules: [
          {
            id: 'legacy-unsupported',
            phase: 'entry',
            condition: { key: 'condition.expression' },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      },
    })

    const text = graph.blocks.flatMap(block => block.items.map(item => item.text)).join(' ')

    expect(graph.blocks).toHaveLength(2)
    expect(text).toContain('收盘价高于前 1 根最高价')
    expect(text).toContain('开多 3%')
    expect(text).not.toContain('不支持的条件，待补充')
  })
```

- [ ] **Step 2: Run frontend test and verify it fails**

Run:

```bash
dx test unit front apps/front/src/components/ai-quant/display-logic-graph.test.ts -t "prefers server-provided displayLogicGraph"
```

Expected: FAIL because the builder ignores `specDesc.displayLogicGraph`.

- [ ] **Step 3: Add display graph guard and early return**

In `apps/front/src/components/ai-quant/display-logic-graph.ts`, extend `DisplayLogicGraphSpecDesc`:

```ts
  displayLogicGraph?: unknown
```

Add these helpers near `isRecord()`:

```ts
function isDisplayBlockType(value: unknown): value is DisplayBlockType {
  return value === 'IF' || value === 'AND_AT_THEN' || value === 'OR_THEN' || value === 'EXECUTE'
}

function normalizeServerDisplayLogicGraph(value: unknown): DisplayLogicGraph | null {
  if (!isRecord(value) || !Array.isArray(value.blocks)) return null
  const blocks: DisplayBlock[] = []
  for (const block of value.blocks) {
    if (!isRecord(block) || !isDisplayBlockType(block.type) || !Array.isArray(block.items)) return null
    const items: DisplayBlock['items'] = []
    for (const item of block.items) {
      if (!isRecord(item)) return null
      const id = asString(item.id)
      const text = asString(item.text)
      if (!id || !text) return null
      if (item.kind === 'condition') {
        items.push({ kind: 'condition', id, text })
        continue
      }
      if (item.kind === 'action') {
        items.push({ kind: 'action', id, text })
        continue
      }
      if (item.kind === 'execute') {
        const key = asString(item.key)
        if (!key) return null
        const valueText = asString(item.value)
        items.push(valueText ? { kind: 'execute', id, key, value: valueText, text } : { kind: 'execute', id, key, text })
        continue
      }
      return null
    }
    blocks.push({ type: block.type, items })
  }
  return blocks.length > 0 ? { blocks } : null
}
```

At the start of `buildDisplayLogicGraphFromCodegenSpec()`, after `specDesc` is set, add:

```ts
  const serverDisplayGraph = normalizeServerDisplayLogicGraph(specDesc?.displayLogicGraph)
  if (serverDisplayGraph) return serverDisplayGraph
```

- [ ] **Step 4: Run frontend display graph test**

Run:

```bash
dx test unit front apps/front/src/components/ai-quant/display-logic-graph.test.ts -t "prefers server-provided displayLogicGraph"
```

Expected: PASS.

- [ ] **Step 5: Run all display graph frontend tests**

Run:

```bash
dx test unit front apps/front/src/components/ai-quant/display-logic-graph.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit frontend preference**

```bash
git add apps/front/src/components/ai-quant/display-logic-graph.ts apps/front/src/components/ai-quant/display-logic-graph.test.ts
git commit -F - <<'MSG'
fix: 前端优先渲染后端语义逻辑图

变更说明：
- display graph builder 优先消费 specDesc.displayLogicGraph
- 旧 specDesc.rules 解析保留为兼容兜底

Refs: #936
MSG
```

## Task 5: Integration Verification

**Files:**
- Review: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Review: `apps/quantify/src/modules/llm-strategy-codegen/services/spec-desc-builder.service.ts`
- Review: `apps/front/src/components/ai-quant/display-logic-graph.ts`

- [ ] **Step 1: Run targeted backend tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/spec-desc-builder.service.spec.ts
```

Expected: PASS.

- [ ] **Step 2: Run targeted frontend tests**

Run:

```bash
dx test unit front apps/front/src/components/ai-quant/display-logic-graph.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
dx lint
```

Expected: PASS. If lint reports only touched-file formatting issues, apply the formatter/lint suggestion and rerun `dx lint`.

- [ ] **Step 4: Inspect final diff**

Run:

```bash
git status --short
git diff --stat origin/main...HEAD
git diff origin/main...HEAD -- apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts apps/front/src/components/ai-quant/display-logic-graph.ts
```

Expected: only issue #936 implementation and plan/spec commits are present.

- [ ] **Step 5: Final commit for any verification fixes**

If Step 3 changes files, commit them:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/spec-desc-builder.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/front/src/components/ai-quant/display-logic-graph.ts
git commit -F - <<'MSG'
chore: 修正语义逻辑图格式化

变更说明：
- 修正 #936 实现后的格式化或 lint 问题

Refs: #936
MSG
```

If no files changed after verification, do not create an empty commit.

## Self-Review

- Spec coverage:
  - Existing UI unchanged: Task 4 only changes data preference in the builder, not preview components.
  - New strategies use semantic state projection: Tasks 1-3.
  - No historical migration: Tasks keep old frontend parser as fallback only.
  - No main data flow changes: Tasks attach display-only `specDesc.displayLogicGraph` without changing canonical spec/IR/compiler.
  - Unsupported placeholder eliminated for new semantic graphs: Task 1 backend test and Task 4 frontend preference test.
- Placeholder scan:
  - The plan contains no unresolved implementation placeholders, and every task has exact paths and commands.
- Type consistency:
  - Backend display graph uses the same block/item shape as frontend `DisplayLogicGraph`.
  - `specDesc.displayLogicGraph` is treated as optional server projection by the frontend.
  - `SemanticStateProjectionService.buildDisplayLogicGraph(state)` is the single backend projection entry point.
