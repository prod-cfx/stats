# AI Quant Semantic Atom Invariant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent AI Quant publication from drifting explicit percent-change user intent, starting with the ORDIUSDT previous-close rise 1% close-long failure.

**Architecture:** Keep the existing semanticState -> normalizedIntent -> canonicalSpec -> IR -> AST -> compiled script pipeline. Fix percent-change extraction at the local clause boundary, then add a publication-time semantic atom invariant gate that validates explicit `price.percent_change` atoms against canonicalSpec/IR/AST before publishing. Existing Bollinger, MA, and grid compilation remains unchanged and is protected by regression tests.

**Tech Stack:** TypeScript, NestJS services, Jest unit tests, Nx/dx quantify test entrypoint.

---

## File Structure

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
  - Responsibility: extract semantic atoms from raw user text. The change is limited to percent-change clause splitting and local direction detection.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`
  - Responsibility: prove mixed percentage clauses are extracted independently.
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-invariant.service.ts`
  - Responsibility: validate explicit semantic atoms against canonicalSpec/IR/AST without changing generated artifacts.
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-invariant.service.spec.ts`
  - Responsibility: prove the invariant passes for `GTE 0.01` and fails for `LTE -0.01`.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts`
  - Responsibility: run the invariant gate after AST compilation and before emitting/persisting a compiled script.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts`
  - Responsibility: prove publication generation rejects semantic atom drift and keeps Bollinger/MA/grid golden cases passing.

## Task 1: Add Failing Percent-Clause Extraction Regression

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`

- [ ] **Step 1: Add the failing ORDIUSDT extraction test**

Append this test near the existing percent-change extraction tests:

```ts
  it('keeps previous-close rise exit separate from stop-loss drop in the same strategy description', () => {
    const patch = service.extract(
      '在 OKX 现货 ORDIUSDT 上，主周期 1h，使用 10% 固定仓位只做多；入场动作为立即开始时市价买入；出场规则为价格相对前收盘上涨 1% 时卖出，另有相对入场均价下跌 5% 止损卖出、相对入场均价上涨 10% 止盈卖出。',
    )

    expect(patch.contextSlots).toEqual(expect.objectContaining({
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
    }))
    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'execution.on_start',
        phase: 'entry',
        sideScope: 'long',
      }),
      expect.objectContaining({
        key: 'price.percent_change',
        phase: 'exit',
        sideScope: 'long',
        params: expect.objectContaining({
          basis: 'prev_close',
          direction: 'up',
          valuePct: 1,
          window: '1h',
        }),
      }),
    ]))
    expect(patch.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.stop_loss_pct',
        params: expect.objectContaining({
          valuePct: 5,
          basis: 'entry_avg_price',
        }),
      }),
      expect.objectContaining({
        key: 'risk.take_profit_pct',
        params: expect.objectContaining({
          valuePct: 10,
          basis: 'entry_avg_price',
        }),
      }),
    ]))
    expect(patch.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
      expect.objectContaining({ key: 'close_long' }),
    ]))
    expect(patch.position).toEqual({
      mode: 'fixed_ratio',
      value: 0.1,
      positionMode: 'long_only',
    })
  })
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
dx test unit quantify --testPathPattern=semantic-seed-extractor.service.spec.ts --runInBand
```

Expected: the new test fails because the percent-change trigger is extracted as `valuePct: -1` or lacks `direction: 'up'`.

- [ ] **Step 3: Commit the failing test**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
git commit -F - <<'MSG'
test: cover percent change clause drift

Refs: #863
MSG
```

## Task 2: Fix Local Percent-Clause Extraction

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`

- [ ] **Step 1: Replace percent direction detection with local clause parsing**

In `pushPercentChangeTrigger`, replace the direction and trigger payload block with this code:

```ts
    const direction = this.resolvePercentDirection(segment)
    if (!direction) return
    const basis = this.resolvePercentBasis(segment)
    const window = this.extractFirstTimeframe(segment)

    this.pushTrigger(triggers, seen, {
      key: 'price.percent_change',
      phase: intent.phase,
      sideScope: intent.sideScope,
      params: {
        direction,
        valuePct: direction === 'down' ? -Math.abs(valuePct) : Math.abs(valuePct),
        basis,
        ...(window ? { window } : {}),
      },
    })
```

- [ ] **Step 2: Replace `splitPercentChangeClauses` with a clause extractor that handles punctuation and risk phrases**

Replace the current `splitPercentChangeClauses` method with:

```ts
  private splitPercentChangeClauses(segment: string): string[] {
    const normalized = segment
      .replace(/；/gu, ';')
      .replace(/。/gu, ';')
      .replace(/，/gu, ',')
      .replace(/、/gu, ',')
    const punctuationClauses = normalized
      .split(/[;,]/u)
      .map(clause => clause.trim())
      .filter(Boolean)

    const clausePattern = /(?:(?:出场|入场|买入|卖出|平仓|开仓|做多|做空|平多|平空|止损|止盈|相对|价格|当前K线|收盘价)[^;,\n]{0,80}?(?:上涨|下跌|涨|跌|回落|回调|反弹)[^;,\n]{0,40}?(?:\d+(?:\.\d+)?\s*%|百分之?\s*\d+(?:\.\d+)?)[^;,\n]{0,60}?(?:买入|卖出|入场|出场|离场|开仓|平仓|平多|平空|做多|做空|开多|开空|止损|止盈))|(?:\d{1,2}\s*(?:m|h|d|分钟|分|小时|时|天|日)[^;,\n]{0,80}?(?:上涨|下跌|涨|跌|回落|回调|反弹)[^;,\n]{0,40}?(?:\d+(?:\.\d+)?\s*%|百分之?\s*\d+(?:\.\d+)?)[^;,\n]{0,60}?(?:买入|卖出|入场|出场|离场|开仓|平仓|平多|平空|做多|做空|开多|开空|止损|止盈))/giu

    const extracted = punctuationClauses.flatMap((clause) => {
      const matches = Array.from(clause.matchAll(clausePattern))
        .map(match => match[0].trim())
        .filter(Boolean)
      return matches.length > 0 ? matches : [clause]
    })

    return extracted.length > 1 ? extracted : [segment]
  }
```

- [ ] **Step 3: Add a helper for local direction**

Add this method next to `hasExplicitPriceChangeDirection`:

```ts
  private resolvePercentDirection(segment: string): 'up' | 'down' | null {
    const hasDown = /下跌|跌|回落|回调/u.test(segment)
    const hasUp = /上涨|涨|反弹/u.test(segment)
    if (hasDown && !hasUp) return 'down'
    if (hasUp && !hasDown) return 'up'

    const percentMatch = segment.match(/(?:\d+(?:\.\d+)?\s*%|百分之?\s*\d+(?:\.\d+)?)/u)
    if (!percentMatch || typeof percentMatch.index !== 'number') return null

    const before = segment.slice(0, percentMatch.index)
    const after = segment.slice(percentMatch.index + percentMatch[0].length)
    const nearestDown = Math.max(before.lastIndexOf('下跌'), before.lastIndexOf('跌'), before.lastIndexOf('回落'), before.lastIndexOf('回调'))
    const nearestUp = Math.max(before.lastIndexOf('上涨'), before.lastIndexOf('涨'), before.lastIndexOf('反弹'))

    if (nearestDown >= 0 || nearestUp >= 0) {
      return nearestDown > nearestUp ? 'down' : 'up'
    }

    if (/下跌|跌|回落|回调/u.test(after) && !/上涨|涨|反弹/u.test(after)) return 'down'
    if (/上涨|涨|反弹/u.test(after) && !/下跌|跌|回落|回调/u.test(after)) return 'up'

    return null
  }
```

- [ ] **Step 4: Run focused extractor tests**

Run:

```bash
dx test unit quantify --testPathPattern=semantic-seed-extractor.service.spec.ts --runInBand
```

Expected: all tests in `semantic-seed-extractor.service.spec.ts` pass, including the new ORDIUSDT case.

- [ ] **Step 5: Commit the extractor fix**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts
git commit -F - <<'MSG'
fix: parse percent change clauses locally

Refs: #863
MSG
```

## Task 3: Add Semantic Atom Invariant Service

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-invariant.service.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-invariant.service.spec.ts`

- [ ] **Step 1: Write tests for pass and fail cases**

Create `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-invariant.service.spec.ts`:

```ts
import type { SemanticState } from '../../types/semantic-state'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { SemanticAtomInvariantService } from '../semantic-atom-invariant.service'
import { buildNormalizedIntentFromSemanticState } from '../semantic-state-normalization'

describe('SemanticAtomInvariantService', () => {
  const service = new SemanticAtomInvariantService()

  function buildSemanticState(): SemanticState {
    return {
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'entry-on-start',
          key: 'execution.on_start',
          phase: 'entry',
          sideScope: 'long',
          params: { timing: 'on_start', orderType: 'market', occurrence: 'once' },
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
        },
        {
          id: 'exit-rise-prev-close',
          key: 'price.percent_change',
          phase: 'exit',
          sideScope: 'long',
          params: { direction: 'up', valuePct: 1, basis: 'prev_close', window: '1h' },
          status: 'locked',
          source: 'user_explicit',
          evidence: { text: '价格相对前收盘上涨 1% 时卖出', source: 'user_explicit' },
          openSlots: [],
        },
      ],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
      ],
      risk: [],
      position: {
        mode: 'fixed_ratio',
        value: 0.1,
        positionMode: 'long_only',
        status: 'locked',
        source: 'user_explicit',
      },
      contextSlots: {
        exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', value: 'okx', status: 'locked', priority: 'context', questionHint: '请确认交易所。', affectsExecution: true },
        symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'ORDIUSDT', status: 'locked', priority: 'context', questionHint: '请确认交易标的。', affectsExecution: true },
        marketType: { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'spot', status: 'locked', priority: 'context', questionHint: '请确认市场类型。', affectsExecution: true },
        timeframe: { slotKey: 'timeframe', fieldPath: 'contextSlots.timeframe', value: '1h', status: 'locked', priority: 'context', questionHint: '请确认周期。', affectsExecution: true },
      },
      normalizationNotes: [],
      updatedAt: '2026-04-23T00:00:00.000Z',
    }
  }

  function compile(state: SemanticState) {
    const builder = new CanonicalSpecBuilderService()
    const spec = builder.buildFromNormalizedIntent(
      {
        market: { exchange: 'okx', marketType: 'spot', defaultTimeframe: '1h' },
        symbols: ['ORDIUSDT'],
        timeframes: ['1h'],
      },
      buildNormalizedIntentFromSemanticState(state),
    )
    const compiled = new CanonicalSpecV2IrCompilerService().compile({
      canonicalSpec: spec,
      fallback: { exchange: 'okx', symbol: 'ORDIUSDT', baseTimeframe: '1h', positionPct: 10 },
    })
    const ast = new CanonicalStrategyAstCompilerService().compile(compiled.ir)
    return { spec, ir: compiled.ir, ast }
  }

  it('passes when previous-close rise close-long compiles to GTE 0.01', () => {
    const state = buildSemanticState()
    const { spec, ir, ast } = compile(state)

    const checks = service.validate({ semanticState: state, canonicalSpec: spec, ir, ast })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_atom.price_percent_change',
        status: 'passed',
        level: 'critical',
      }),
    ]))
  })

  it('fails when previous-close rise close-long compiles to LTE -0.01', () => {
    const state = buildSemanticState()
    const { spec, ir, ast } = compile(state)
    const driftedAst = {
      ...ast,
      exprPool: ast.exprPool.map(expr => (
        expr.sourceRef === 'exit_price_percent_change_140_price_change_pct'
          ? { ...expr, payload: { ...expr.payload, kind: 'LTE' as const } }
          : expr.sourceRef === 'const_0_01'
            ? { ...expr, id: expr.id.replace('const_0_01', 'const_-0_01'), sourceRef: 'const_-0_01', payload: { ...expr.payload, id: 'const_-0_01', value: -0.01 } }
            : expr
      )),
    }

    const checks = service.validate({ semanticState: state, canonicalSpec: spec, ir, ast: driftedAst })

    expect(checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'semantic_atom.price_percent_change',
        status: 'failed',
        level: 'critical',
      }),
    ]))
  })
})
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
dx test unit quantify --testPathPattern=semantic-atom-invariant.service.spec.ts --runInBand
```

Expected: FAIL with module not found for `semantic-atom-invariant.service`.

- [ ] **Step 3: Create the invariant service**

Create `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-invariant.service.ts`:

```ts
import type { StrategyAstV1 } from '../types/canonical-strategy-ast'
import type { CanonicalStrategyIrV1 } from '../types/canonical-strategy-ir'
import type { CanonicalStrategySpec } from '../types/canonical-strategy-spec'
import type { SemanticState, SemanticTriggerState } from '../types/semantic-state'
import type { StrategyConsistencyCheck } from '../types/strategy-consistency-report'
import { Injectable } from '@nestjs/common'

type PriceChangeDirection = 'up' | 'down'

@Injectable()
export class SemanticAtomInvariantService {
  validate(input: {
    semanticState: SemanticState
    canonicalSpec: CanonicalStrategySpec
    ir: CanonicalStrategyIrV1
    ast: StrategyAstV1
  }): StrategyConsistencyCheck[] {
    return [
      ...this.validatePricePercentChange(input.semanticState, input.ast),
    ]
  }

  private validatePricePercentChange(
    semanticState: SemanticState,
    ast: StrategyAstV1,
  ): StrategyConsistencyCheck[] {
    return semanticState.triggers
      .filter(trigger => this.isBlockingPricePercentChangeTrigger(trigger))
      .map(trigger => this.validatePricePercentChangeTrigger(trigger, ast))
  }

  private isBlockingPricePercentChangeTrigger(trigger: SemanticTriggerState): boolean {
    const basis = typeof trigger.params.basis === 'string' ? trigger.params.basis : 'prev_close'
    return trigger.key === 'price.percent_change'
      && trigger.status === 'locked'
      && trigger.source === 'user_explicit'
      && basis === 'prev_close'
      && (trigger.phase === 'entry' || trigger.phase === 'exit')
  }

  private validatePricePercentChangeTrigger(
    trigger: SemanticTriggerState,
    ast: StrategyAstV1,
  ): StrategyConsistencyCheck {
    const direction = this.resolveDirection(trigger)
    const valuePct = this.readPositiveNumber(trigger.params.valuePct)
    const expectedAction = this.expectedAction(trigger)
    const expectedOp = direction === 'down' ? 'LTE' : 'GTE'
    const expectedValue = direction === 'down'
      ? -Number((valuePct / 100).toFixed(4))
      : Number((valuePct / 100).toFixed(4))
    const matchingPrograms = ast.decisionPrograms.filter(program =>
      program.phase === trigger.phase
      && program.actions.some(action => action.kind === expectedAction)
    )
    const actual = matchingPrograms.map(program => this.describeProgramPredicate(program.when, ast))
    const passed = actual.some(item =>
      item?.predicateKind === expectedOp
      && item.constValue === expectedValue
      && item.hasPriceChangeSeries,
    )

    return {
      key: 'semantic_atom.price_percent_change',
      level: 'critical',
      status: passed ? 'passed' : 'failed',
      expected: {
        triggerId: trigger.id,
        phase: trigger.phase,
        action: expectedAction,
        predicateKind: expectedOp,
        constValue: expectedValue,
        basis: trigger.params.basis ?? 'prev_close',
      },
      actual,
      message: passed
        ? 'price.percent_change semantic atom matches AST.'
        : `price.percent_change semantic atom drift: expected ${expectedOp} ${expectedValue}, actual ${JSON.stringify(actual)}`,
    }
  }

  private resolveDirection(trigger: SemanticTriggerState): PriceChangeDirection {
    const explicit = trigger.params.direction
    if (explicit === 'up' || explicit === '上涨' || explicit === '涨') return 'up'
    if (explicit === 'down' || explicit === '下跌' || explicit === '跌') return 'down'

    const valuePct = this.readNumber(trigger.params.valuePct)
    return valuePct < 0 ? 'down' : 'up'
  }

  private expectedAction(trigger: SemanticTriggerState): 'OPEN_LONG' | 'OPEN_SHORT' | 'CLOSE_LONG' | 'CLOSE_SHORT' {
    if (trigger.phase === 'entry') {
      return trigger.sideScope === 'short' ? 'OPEN_SHORT' : 'OPEN_LONG'
    }
    return trigger.sideScope === 'short' ? 'CLOSE_SHORT' : 'CLOSE_LONG'
  }

  private describeProgramPredicate(
    predicateExprId: string,
    ast: StrategyAstV1,
  ): {
    predicateKind: unknown
    constValue: number | null
    hasPriceChangeSeries: boolean
  } | null {
    const exprIndex = new Map(ast.exprPool.map(expr => [expr.id, expr]))
    const predicate = exprIndex.get(predicateExprId)
    if (!predicate || predicate.nodeType !== 'predicate') return null

    const deps = predicate.deps ?? []
    const depExprs = deps.map(dep => exprIndex.get(dep)).filter(Boolean)
    const constExpr = depExprs.find(expr => expr?.nodeType === 'series' && expr.payload.kind === 'CONST')
    const priceChangeExpr = depExprs.find(expr => expr?.nodeType === 'series' && expr.payload.kind === 'PRICE_CHANGE_PCT')
    const constValue = typeof constExpr?.payload.value === 'number' ? constExpr.payload.value : null

    return {
      predicateKind: predicate.payload.kind,
      constValue,
      hasPriceChangeSeries: Boolean(priceChangeExpr),
    }
  }

  private readPositiveNumber(value: unknown): number {
    const numeric = Math.abs(this.readNumber(value))
    return Number.isFinite(numeric) && numeric > 0 ? numeric : 0
  }

  private readNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0
  }
}
```

- [ ] **Step 4: Run the invariant tests**

Run:

```bash
dx test unit quantify --testPathPattern=semantic-atom-invariant.service.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 5: Commit the invariant service**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-invariant.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-invariant.service.spec.ts
git commit -F - <<'MSG'
feat: add semantic atom invariant check

Refs: #863
MSG
```

## Task 4: Wire Invariant Gate Into Publication Generation

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts`

- [ ] **Step 1: Add a publication rejection test**

Append this test to `codegen-publication-generation.stage.spec.ts`:

```ts
  it('rejects publication when explicit previous-close rise compiles as a drop close', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const semanticState = {
      version: 1,
      families: ['single-leg'],
      triggers: [
        { id: 'entry-on-start', key: 'execution.on_start', phase: 'entry', sideScope: 'long', params: { timing: 'on_start', orderType: 'market', occurrence: 'once' }, status: 'locked', source: 'user_explicit', openSlots: [] },
        { id: 'exit-rise-prev-close', key: 'price.percent_change', phase: 'exit', sideScope: 'long', params: { direction: 'up', valuePct: 1, basis: 'prev_close', window: '1h' }, status: 'locked', source: 'user_explicit', evidence: { text: '价格相对前收盘上涨 1% 时卖出', source: 'user_explicit' }, openSlots: [] },
      ],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
      ],
      risk: [],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_only', status: 'locked', source: 'user_explicit' },
      contextSlots: {
        exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', value: 'okx', status: 'locked', priority: 'context', questionHint: '请确认交易所。', affectsExecution: true },
        symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'ORDIUSDT', status: 'locked', priority: 'context', questionHint: '请确认交易标的。', affectsExecution: true },
        marketType: { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'spot', status: 'locked', priority: 'context', questionHint: '请确认市场类型。', affectsExecution: true },
        timeframe: { slotKey: 'timeframe', fieldPath: 'contextSlots.timeframe', value: '1h', status: 'locked', priority: 'context', questionHint: '请确认周期。', affectsExecution: true },
      },
      normalizationNotes: [],
      updatedAt: '2026-04-23T00:00:00.000Z',
    } as SemanticState
    const driftedCanonicalSpec = canonicalSpecBuilder.buildFromNormalizedIntent(
      {
        market: { exchange: 'okx', marketType: 'spot', defaultTimeframe: '1h' },
        symbols: ['ORDIUSDT'],
        timeframes: ['1h'],
      },
      {
        ...buildNormalizedIntentFromSemanticState(semanticState),
        triggers: buildNormalizedIntentFromSemanticState(semanticState).triggers.map(trigger =>
          trigger.key === 'price.percent_change'
            ? { ...trigger, params: { ...trigger.params, direction: 'down', valuePct: -1 } }
            : trigger,
        ),
      },
    )
    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      new SpecDescBuilderService(),
      strategySummaryBuilder,
      new StrategyConsistencyService(new ScriptProfileExtractorService()),
      new CanonicalSpecV2IrCompilerService(),
      new CanonicalStrategyAstCompilerService(),
      new CompiledScriptEmitterService(),
      new CompiledScriptExecutionEnvelopeService(),
      new CompiledScriptParserService(),
    )

    await expect(stage.generate({
      semanticState,
      canonicalSpecOverride: driftedCanonicalSpec,
    })).rejects.toThrow(/codegen.semantic_atom_drift/)
  })
```

- [ ] **Step 2: Run the publication generation test and verify it fails**

Run:

```bash
dx test unit quantify --testPathPattern=codegen-publication-generation.stage.spec.ts --runInBand
```

Expected: the new test fails because no semantic atom invariant gate runs yet.

- [ ] **Step 3: Inject the invariant service into publication generation**

In `codegen-publication-generation.stage.ts`, add the import:

```ts
import { SemanticAtomInvariantService } from './semantic-atom-invariant.service'
```

Update the constructor signature by adding the final optional dependency:

```ts
    private readonly strategySummaryObservation: StrategySummaryObservationService = new StrategySummaryObservationService(),
    private readonly semanticAtomInvariant: SemanticAtomInvariantService = new SemanticAtomInvariantService(),
```

- [ ] **Step 4: Run the gate after AST compilation**

In `generate`, immediately after:

```ts
    const ast = this.canonicalStrategyAstCompiler.compile(compiled.ir)
```

add:

```ts
    const atomInvariantChecks = this.semanticAtomInvariant.validate({
      semanticState: input.semanticState,
      canonicalSpec,
      ir: compiled.ir,
      ast,
    })
    const atomInvariantFailures = atomInvariantChecks.filter(check => check.level === 'critical' && check.status === 'failed')
    if (atomInvariantFailures.length > 0) {
      const message = atomInvariantFailures.map(check => check.message).join('；')
      throw new Error(`codegen.semantic_atom_drift: ${message}`)
    }
```

- [ ] **Step 5: Add passing invariant diagnostics into `sessionSpecDesc`**

In the `sessionSpecDesc` object, add:

```ts
      semanticAtomInvariant: {
        status: atomInvariantChecks.some(check => check.status === 'failed') ? 'FAILED' : 'PASSED',
        checks: atomInvariantChecks,
      },
```

- [ ] **Step 6: Run publication tests**

Run:

```bash
dx test unit quantify --testPathPattern=codegen-publication-generation.stage.spec.ts --runInBand
```

Expected: PASS, including existing Bollinger, MA, and grid tests.

- [ ] **Step 7: Commit the publication gate**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts
git commit -F - <<'MSG'
fix: block semantic atom drift before publication

Refs: #863
MSG
```

## Task 5: Add End-to-End Golden Regression For The ORDIUSDT Scenario

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts`

- [ ] **Step 1: Add a success test that inspects the AST shape**

Append this test:

```ts
  it('publishes ORDIUSDT previous-close rise exit as GTE 0.01 close-long', async () => {
    const canonicalSpecBuilder = new CanonicalSpecBuilderService()
    const strategySummaryBuilder = new StrategySummaryBuilderService(new ScriptProfileExtractorService())
    const semanticState = {
      version: 1,
      families: ['single-leg'],
      triggers: [
        { id: 'entry-on-start', key: 'execution.on_start', phase: 'entry', sideScope: 'long', params: { timing: 'on_start', orderType: 'market', occurrence: 'once' }, status: 'locked', source: 'user_explicit', openSlots: [] },
        { id: 'exit-rise-prev-close', key: 'price.percent_change', phase: 'exit', sideScope: 'long', params: { direction: 'up', valuePct: 1, basis: 'prev_close', window: '1h' }, status: 'locked', source: 'user_explicit', evidence: { text: '价格相对前收盘上涨 1% 时卖出', source: 'user_explicit' }, openSlots: [] },
      ],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
      ],
      risk: [
        { id: 'risk-stop-loss', key: 'risk.stop_loss_pct', params: { valuePct: 5, basis: 'entry_avg_price' }, status: 'locked', source: 'user_explicit', openSlots: [] },
        { id: 'risk-take-profit', key: 'risk.take_profit_pct', params: { valuePct: 10, basis: 'entry_avg_price' }, status: 'locked', source: 'user_explicit', openSlots: [] },
      ],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_only', status: 'locked', source: 'user_explicit' },
      contextSlots: {
        exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', value: 'okx', status: 'locked', priority: 'context', questionHint: '请确认交易所。', affectsExecution: true },
        symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'ORDIUSDT', status: 'locked', priority: 'context', questionHint: '请确认交易标的。', affectsExecution: true },
        marketType: { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'spot', status: 'locked', priority: 'context', questionHint: '请确认市场类型。', affectsExecution: true },
        timeframe: { slotKey: 'timeframe', fieldPath: 'contextSlots.timeframe', value: '1h', status: 'locked', priority: 'context', questionHint: '请确认周期。', affectsExecution: true },
      },
      normalizationNotes: [],
      updatedAt: '2026-04-23T00:00:00.000Z',
    } as SemanticState
    const stage = new CodegenPublicationGenerationStage(
      canonicalSpecBuilder,
      new SpecDescBuilderService(),
      strategySummaryBuilder,
      new StrategyConsistencyService(new ScriptProfileExtractorService()),
      new CanonicalSpecV2IrCompilerService(),
      new CanonicalStrategyAstCompilerService(),
      new CompiledScriptEmitterService(),
      new CompiledScriptExecutionEnvelopeService(),
      new CompiledScriptParserService(),
    )

    const artifacts = await stage.generate({ semanticState })
    const exitDecision = artifacts.ast.decisionPrograms.find(program =>
      program.phase === 'exit'
      && program.actions.some(action => action.kind === 'CLOSE_LONG')
      && program.sourceRef.includes('price-percent_change')
    )
    expect(exitDecision).toBeDefined()
    const predicate = artifacts.ast.exprPool.find(expr => expr.id === exitDecision?.when)
    const constExpr = artifacts.ast.exprPool.find(expr =>
      predicate?.deps.includes(expr.id)
      && expr.nodeType === 'series'
      && expr.payload.kind === 'CONST'
    )
    const priceChangeExpr = artifacts.ast.exprPool.find(expr =>
      predicate?.deps.includes(expr.id)
      && expr.nodeType === 'series'
      && expr.payload.kind === 'PRICE_CHANGE_PCT'
    )

    expect(predicate).toEqual(expect.objectContaining({
      nodeType: 'predicate',
      payload: expect.objectContaining({ kind: 'GTE' }),
    }))
    expect(constExpr?.payload.value).toBe(0.01)
    expect(priceChangeExpr).toEqual(expect.objectContaining({
      nodeType: 'series',
      payload: expect.objectContaining({ kind: 'PRICE_CHANGE_PCT' }),
    }))
    expect(artifacts.semanticAtomInvariant.status).toBe('PASSED')
  })
```

- [ ] **Step 2: Run publication generation tests**

Run:

```bash
dx test unit quantify --testPathPattern=codegen-publication-generation.stage.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 3: Commit the golden regression**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts
git commit -F - <<'MSG'
test: lock ORDIUSDT semantic atom publication

Refs: #863
MSG
```

## Task 6: Verification

**Files:**
- No new source files beyond Tasks 1-5.

- [ ] **Step 1: Run targeted unit tests**

Run:

```bash
dx test unit quantify --testPathPattern=semantic-seed-extractor.service.spec.ts --runInBand
dx test unit quantify --testPathPattern=semantic-atom-invariant.service.spec.ts --runInBand
dx test unit quantify --testPathPattern=codegen-publication-generation.stage.spec.ts --runInBand
```

Expected: all three commands PASS.

- [ ] **Step 2: Run existing compiler/consistency regression tests**

Run:

```bash
dx test unit quantify --testPathPattern=strategy-consistency.service.spec.ts --runInBand
dx test unit quantify --testPathPattern=canonical-spec-v2-ir-compiler.service.spec.ts --runInBand
```

Expected: both commands PASS. These cover already-working Bollinger, MA, grid, and compiled artifact projection behavior.

- [ ] **Step 3: Run lint**

Run:

```bash
dx lint
```

Expected: PASS.

- [ ] **Step 4: Commit verification-only adjustments if any were needed**

If lint or tests required a small follow-up edit, commit it:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services apps/quantify/src/modules/llm-strategy-codegen/services/__tests__
git commit -F - <<'MSG'
fix: satisfy semantic atom invariant verification

Refs: #863
MSG
```

If no edits were needed, do not create an empty commit.

## Self-Review

- Spec coverage: Tasks 1-2 address local clause extraction; Tasks 3-5 add the blocking `price.percent_change` invariant gate; Task 6 protects existing Bollinger, MA, and grid behavior through targeted regression commands.
- Gap scan: The plan gives concrete file paths, code snippets, commands, and expected outcomes for every task.
- Type consistency: The plan uses existing `SemanticState`, `CanonicalStrategySpec`, `CanonicalStrategyIrV1`, `StrategyAstV1`, and `StrategyConsistencyCheck` types.
