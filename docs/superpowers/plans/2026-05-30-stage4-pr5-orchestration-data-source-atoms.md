# Stage 4 PR5 Orchestration Data-Source Atoms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Stage 4 rules-only orchestration and data-source binding atom coverage while proving deploy-ready rows through the full rule pipeline.

**Architecture:** `SemanticState.rules[]` remains the only executable source. PR5 adds orchestration matrix rows under `rules[].effects.orchestration`, extends `scope.dataSource` schema binding for `funding` and `open_interest`, and keeps unsupported market-data predicates fail-closed. Deploy-ready evidence must pass dialogue -> dispatcher -> rules -> readiness -> assistant text -> display -> canonical -> IR -> script/runtime -> backtest -> deploy payload.

**Tech Stack:** TypeScript, Jest, NestJS services, `dx` command runner, existing llm-strategy-codegen services.

---

## File Map

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/atom-coverage-matrix.ts`  
  Add PR5 direct rows and source/data requirements.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/atom-coverage-matrix.spec.ts`  
  Add PR5 matrix invariants and PR2 market-data binding rules.
- Create: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/orchestration-data-source-dialogue-entrance.spec.ts`  
  Prove attempt-1 routing into typed rules roles.
- Create: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/rules-only-full-pipeline-pr5.spec.ts`  
  Full-chain proof for deploy-ready PR5 rows and fail-closed proof for non-ready rows.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`  
  Extend `SemanticOrchestrationDataSourceSchema` with `funding` and `open_interest`.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec-v2.ts`  
  Ensure canonical data-source schema type accepts the extended semantic union.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ir.ts`  
  Ensure IR data-source schema type accepts the extended semantic union.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`  
  Accept `funding` and `open_interest` in `scope.dataSource` promotion from rules and orchestration contracts.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/atom-contracts/atom-contract-registry.ts`  
  Update `scope.dataSource` clarification copy and golden utterances for extended schema names.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/stage4-real-strategy-corpus.ts`  
  Add PR5 corpus cases with `expectedFailure` aligned to matrix blockers.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/real-strategy-corpus.spec.ts`  
  Add categories and role checks if corpus categories expand.
- Modify as needed: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts`, `publication-gate-rules-only-hash-chain.spec.ts`, `display-logic-graph-rules-tree.spec.ts`  
  Add source-path checks only for rows claimed deploy-ready.

## Guardrails

- Do not touch PR4 action/program statuses except assertions that they remain unchanged.
- Do not migrate DCA into `program.dca`.
- Do not add flat projection, legacy five-bucket fallback, or tests that use legacy checklist as PR5 evidence.
- Do not mark PR2 market-data predicates deploy-ready unless a real data-source binding reaches deploy payload.
- Every deploy-ready PR5 row needs one full-pipeline test.

### Task 1: Add Failing PR5 Matrix Tests

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/atom-coverage-matrix.spec.ts`

- [ ] **Step 1: Add PR5 key lists after PR4 lists**

```ts
const pr5OrchestrationAtomKeys = [
  'orchestration.multi_timeframe',
  'orchestration.multi_symbol',
  'orchestration.multi_leg',
  'orchestration.portfolio_risk',
  'orchestration.regime_gate',
  'orchestration.data_source_binding',
] as const

const pr2MarketDataPredicateKeys = [
  'orderbook.imbalance',
  'fundingRate.condition',
  'openInterest.condition',
  'liquidation.condition',
  'event.externalSignal',
] as const
```

- [ ] **Step 2: Add PR5 row constant inside `describe`**

```ts
  const pr5Rows = STAGE4_ATOM_COVERAGE_MATRIX.filter(row => row.prBatch === 'pr5-orchestration-data')
```

- [ ] **Step 3: Add typed orchestration path invariant**

```ts
  it('contains direct PR5 orchestration atom rows under typed orchestration effects', () => {
    const rowsByKey = new Map(STAGE4_ATOM_COVERAGE_MATRIX.map(row => [row.atomKey, row]))

    for (const key of pr5OrchestrationAtomKeys) {
      const row = rowsByKey.get(key)
      expect(row).toBeDefined()
      expect(row?.family).toBe('orchestration')
      expect(row?.rulePath).toBe('rules[].effects.orchestration')
      expect(row?.prBatch).toBe('pr5-orchestration-data')
      expect(row?.coveredAtomKeys.length).toBeGreaterThan(0)
    }
  })
```

- [ ] **Step 4: Add deploy-ready full-chain metadata invariant**

```ts
  it('requires deploy-ready PR5 rows to declare full rules pipeline evidence', () => {
    const invalidRows = pr5Rows.filter(row =>
      isStage4DeployReadyAtom(row)
      && (
        row.utteranceExamples.length < 3
        || !row.displayShape.includes('source path')
        || !row.canonicalShape.includes('source path')
        || !row.irShape.includes('source path')
        || !row.runtimeRequirement.includes('runtime')
        || !row.deployPayloadImpact.some(item => item.includes('sourcePath') || item.includes('dataRequirements'))
        || !row.reachesBacktest
        || !row.reachesDeployPayload
        || row.unsupportedReason !== null
      ),
    )

    expect(invalidRows).toEqual([])
  })
```

- [ ] **Step 5: Add fail-closed invariant**

```ts
  it('requires non deploy-ready PR5 rows to carry concrete blockers', () => {
    const invalidRows = pr5Rows.filter(row =>
      !isStage4DeployReadyAtom(row)
      && (
        row.unsupportedReason === null
        || (row.reachesBacktest && row.reachesDeployPayload)
      ),
    )

    expect(invalidRows).toEqual([])
  })
```

- [ ] **Step 6: Add market-data upgrade guard**

```ts
  it('keeps PR2 market-data predicates low unless PR5 data-source binding reaches deploy payload', () => {
    const rowsByKey = new Map(STAGE4_ATOM_COVERAGE_MATRIX.map(row => [row.atomKey, row]))
    const bindingRow = rowsByKey.get('orchestration.data_source_binding')
    const bindingReady = bindingRow ? isStage4DeployReadyAtom(bindingRow) : false

    for (const key of pr2MarketDataPredicateKeys) {
      const row = rowsByKey.get(key)
      expect(row).toBeDefined()
      if (isStage4DeployReadyAtom(row!)) {
        expect(bindingReady).toBe(true)
        expect(row?.deployPayloadImpact.some(item => item.includes('dataRequirements'))).toBe(true)
      }
    }
  })
```

- [ ] **Step 7: Run test and verify failure before matrix rows**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/atom-coverage-matrix.spec.ts
```

Expected: FAIL because PR5 direct rows are missing or incomplete.

- [ ] **Step 8: Commit failing test**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/atom-coverage-matrix.spec.ts
git commit -F - <<'MSG'
test: add stage4 pr5 matrix invariants

Refs: #1739
Refs: #1631
MSG
```

### Task 2: Implement PR5 Matrix Rows

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/atom-coverage-matrix.ts`

- [ ] **Step 1: Replace or supersede `orchestration.foundation.scope_timeframe` with direct PR5 rows**

Use direct row keys. If keeping the foundation row for history, make sure unique atom keys remain and non-ready foundation has a concrete blocker. Preferred implementation removes the foundation row and adds direct rows.

- [ ] **Step 2: Add deploy-ready candidates only where existing full-pipeline proof will be added**

Start with conservative ready rows for substrate that current publication can prove. Use this shape for `orchestration.multi_timeframe` only if Task 6 proves full pipeline:

```ts
  {
    atomKey: 'orchestration.multi_timeframe',
    family: 'orchestration',
    rulePath: 'rules[].effects.orchestration',
    coveredAtomKeys: ['scope.timeframe'],
    paramsSchema: ['primaryTimeframe', 'requiredTimeframes', 'alignmentPolicy'],
    requiredSlots: ['primaryTimeframe', 'requiredTimeframes'],
    utteranceExamples: ['BTC 15m 入场，1h MA50 上方才允许开多。', 'Use 15m entries with 1h trend confirmation.', '15m EMA20 上穿，4h 趋势向上才交易。'],
    displayShape: 'multi-timeframe orchestration scope with rules source path',
    canonicalShape: 'CanonicalOrchestrationScope:timeframe with source path',
    irShape: 'IrOrchestrationScope:timeframe with source path',
    runtimeRequirement: 'runtime requires aligned OHLCV bars for primary and confirmation timeframes',
    requiredDataSources: ['ohlcv'],
    deployPayloadImpact: ['dataRequirements.requiredTimeframes', 'orchestrationScopes.sourcePath'],
    corpusCases: ['stage4-multi-timeframe-trend-confirmation'],
    status: 'deploy_ready',
    unsupportedReason: null,
    prBatch: 'pr5-orchestration-data',
    reachesBacktest: true,
    reachesDeployPayload: true,
  },
```

- [ ] **Step 3: Add conservative low-status rows for not-yet-proven orchestration**

Use this exact pattern for rows not proven by full-pipeline tests:

```ts
  {
    atomKey: 'orchestration.data_source_binding',
    family: 'orchestration',
    rulePath: 'rules[].effects.orchestration',
    coveredAtomKeys: ['scope.dataSource'],
    paramsSchema: ['role', 'feedId', 'schemaRef'],
    requiredSlots: ['role', 'feedId', 'schemaRef'],
    utteranceExamples: ['用 Binance orderbook 做确认数据源。', 'Funding rate feed is the confirmation source.', 'TradingView webhook 是事件源。'],
    displayShape: 'data-source binding orchestration scope with rules source path',
    canonicalShape: 'CanonicalOrchestrationScope:dataSource with source path',
    irShape: 'IrOrchestrationScope:dataSource with source path',
    runtimeRequirement: 'runtime data feed and deploy payload binding required before executable use',
    requiredDataSources: ['orderbook', 'funding', 'open_interest', 'liquidation', 'webhook'],
    deployPayloadImpact: ['unsupported:deployPayload.dataRequirements.sourcePath'],
    corpusCases: ['stage4-orderbook-data-source-binding', 'stage4-funding-data-source-binding', 'stage4-open-interest-data-source-binding', 'stage4-liquidation-data-source-binding', 'stage4-webhook-event-source-binding'],
    status: 'canonical_ready',
    unsupportedReason: 'deploy_payload_missing_binding',
    prBatch: 'pr5-orchestration-data',
    reachesBacktest: false,
    reachesDeployPayload: false,
  },
```

- [ ] **Step 4: Add remaining row keys with blockers unless Task 6 proves ready**

Add rows for:

```ts
'orchestration.multi_symbol'
'orchestration.multi_leg'
'orchestration.portfolio_risk'
'orchestration.regime_gate'
```

Use `status: 'canonical_ready'` or `status: 'ir_ready'` only if existing tests prove that stage. Use `unsupportedReason: 'runtime_missing_data'` or `unsupportedReason: 'deploy_payload_missing_binding'` for missing runtime/deploy.

- [ ] **Step 5: Run matrix test**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/atom-coverage-matrix.spec.ts
```

Expected: PASS for matrix invariants.

- [ ] **Step 6: Commit matrix implementation**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/stage4/atom-coverage-matrix.ts apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/atom-coverage-matrix.spec.ts
git commit -F - <<'MSG'
feat: add stage4 pr5 orchestration matrix rows

Refs: #1739
Refs: #1631
MSG
```

### Task 3: Extend Data-Source Schema Binding

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/atom-contracts/atom-contract-registry.ts`

- [ ] **Step 1: Extend semantic schema union**

```ts
export type SemanticOrchestrationDataSourceSchema = 'ohlcv' | 'orderbook' | 'funding' | 'open_interest' | 'liquidation' | 'webhook_event'
```

- [ ] **Step 2: Add local guard in canonical builder**

Near existing `scope.dataSource` checks, add a private helper:

```ts
  private isSupportedDataSourceSchemaRef(value: unknown): value is SemanticOrchestrationDataSourceSchema {
    return value === 'ohlcv'
      || value === 'orderbook'
      || value === 'funding'
      || value === 'open_interest'
      || value === 'liquidation'
      || value === 'webhook_event'
  }
```

- [ ] **Step 3: Replace inline schema checks**

Replace both checks shaped like:

```ts
schemaRef !== 'ohlcv' && schemaRef !== 'orderbook' && schemaRef !== 'liquidation' && schemaRef !== 'webhook_event'
```

with:

```ts
!this.isSupportedDataSourceSchemaRef(schemaRef)
```

- [ ] **Step 4: Update clarification copy**

In `atom-contract-registry.ts`, update `scope.dataSource` schema question:

```ts
if (slotKey === 'orchestration.scope.dataSource.schema_ref') return '请确认数据源 schema（ohlcv/orderbook/funding/open_interest/liquidation/webhook_event）'
```

- [ ] **Step 5: Run atom contract and builder tests**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/atom-contracts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit schema binding**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts apps/quantify/src/modules/llm-strategy-codegen/atom-contracts/atom-contract-registry.ts
git commit -F - <<'MSG'
feat: extend stage4 data-source binding schemas

Refs: #1739
Refs: #1631
MSG
```

### Task 4: Add Dialogue Entrance Tests

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/orchestration-data-source-dialogue-entrance.spec.ts`

- [ ] **Step 1: Create helper functions**

```ts
import { collectAtomLeaves, isRuleEffectsByRole } from '../../types/atom-expr'
import { GenericSeedDispatcher } from '../../services/generic-seed-dispatcher.service'

type DispatchPatch = ReturnType<GenericSeedDispatcher['dispatch']>
type EffectRole = 'actions' | 'risks' | 'positions' | 'orchestration' | 'programs'

function collectEffectKeys(patch: DispatchPatch, role: EffectRole): string[] {
  return (patch.rules ?? []).flatMap((rule) => {
    if (!isRuleEffectsByRole(rule.effects)) return []
    return rule.effects[role].flatMap(effect => collectAtomLeaves(effect).map(leaf => leaf.key))
  })
}

function collectConditionKeys(patch: DispatchPatch): string[] {
  return (patch.rules ?? []).flatMap(rule => collectAtomLeaves(rule.condition).map(leaf => leaf.key))
}

function expectTypedRules(patch: DispatchPatch): void {
  expect(patch.rules?.length ?? 0).toBeGreaterThan(0)
  for (const rule of patch.rules ?? []) expect(isRuleEffectsByRole(rule.effects)).toBe(true)
}
```

- [ ] **Step 2: Add orchestration route cases**

```ts
describe('Stage 4 PR5 orchestration and data-source dialogue entrance', () => {
  const dispatcher = new GenericSeedDispatcher()

  it.each([
    ['scope.timeframe', 'BTC 15m EMA20 上穿 EMA50 开多，1h MA50 上方才允许入场。'],
    ['scope.symbol', 'BTCUSDT 和 ETHUSDT 都按 EMA20 上穿 EMA50 开多。'],
    ['portfolioRisk.drawdown_block', 'EMA20 上穿开多，组合最大回撤超过 8% 停止开仓。'],
    ['gate.regime', '价格高于 EMA50 才允许做多，EMA20 上穿开多。'],
  ])('attempt-1 routes %s into orchestration effects without action/program pollution', (expectedKey, utterance) => {
    const patch = dispatcher.dispatch(utterance)

    expectTypedRules(patch)
    expect(collectEffectKeys(patch, 'orchestration')).toContain(expectedKey)
    expect(collectEffectKeys(patch, 'actions')).not.toContain(expectedKey)
    expect(collectEffectKeys(patch, 'programs')).not.toContain(expectedKey)
  })
})
```

- [ ] **Step 3: Add market-data fail-closed route cases**

```ts
  it.each([
    ['orderbook.imbalance', 'orderbook imbalance 大于 60% 才开多。'],
    ['fundingRate.condition', '资金费率为正并且 EMA20 上穿才开多。'],
    ['openInterest.condition', '未平仓量增加时确认突破。'],
    ['liquidation.condition', '出现多头清算瀑布后只做空。'],
    ['event.externalSignal', '收到 TradingView webhook buy 信号后开多。'],
  ])('keeps unsupported or unbound market-data predicate %s out of fake deploy-ready assumptions', (expectedKey, utterance) => {
    const patch = dispatcher.dispatch(utterance)

    expectTypedRules(patch)
    const allKeys = new Set([...collectConditionKeys(patch), ...collectEffectKeys(patch, 'orchestration')])
    expect(allKeys.has(expectedKey) || collectEffectKeys(patch, 'orchestration').includes('scope.dataSource')).toBe(true)
  })
```

- [ ] **Step 4: Add duplicate rule check**

```ts
  it('does not duplicate entry or exit rules for orchestration context', () => {
    const patch = dispatcher.dispatch('BTC 15m EMA20 上穿 EMA50 开多，1h MA50 上方才允许入场，单笔 10% 仓位。')
    const phases = (patch.rules ?? []).map(rule => rule.phase)

    expect(phases.filter(phase => phase === 'entry')).toHaveLength(1)
    expect(phases.filter(phase => phase === 'exit')).toHaveLength(0)
  })
```

- [ ] **Step 5: Run dialogue test**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/orchestration-data-source-dialogue-entrance.spec.ts
```

Expected: PASS after dispatcher support or adjusted fail-closed expectations match actual support.

- [ ] **Step 6: Commit dialogue tests**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/orchestration-data-source-dialogue-entrance.spec.ts
git commit -F - <<'MSG'
test: add stage4 pr5 dialogue entrance coverage

Refs: #1739
Refs: #1631
MSG
```

### Task 5: Extend Corpus Cases

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/stage4-real-strategy-corpus.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/real-strategy-corpus.spec.ts`

- [ ] **Step 1: Add categories if needed**

If existing categories are enough, reuse them. If adding a data-source category, extend both type and test:

```ts
export type Stage4RealStrategyCategory =
  | 'simple_trend'
  | 'mean_reversion'
  | 'grid'
  | 'dca'
  | 'add_position'
  | 'portfolio_risk'
  | 'multi_timeframe'
  | 'multi_symbol'
  | 'data_source_binding'
  | 'action_lifecycle'
  | 'execution_program'
```

- [ ] **Step 2: Add PR5 corpus cases**

```ts
  {
    id: 'stage4-regime-gate-trend-filter',
    category: 'portfolio_risk',
    initialUserMessage: 'BTCUSDT 15m。价格高于 EMA50 才允许做多，EMA20 上穿 EMA50 开多，单笔 10% 仓位。',
    expectedAtomKeys: ['gate.regime', 'indicator.cross_over', 'position.sizing'],
    expectedSemanticIntent: ['regime gate', 'trend entry', 'fixed ratio sizing'],
    clarificationTurns: [],
    expectedFailure: 'runtime_missing_data',
  },
  {
    id: 'stage4-orderbook-data-source-binding',
    category: 'data_source_binding',
    initialUserMessage: 'BTCUSDT 15m。EMA20 上穿开多，但需要 Binance orderbook imbalance 大于 60% 确认。',
    expectedAtomKeys: ['orderbook.imbalance'],
    expectedSemanticIntent: ['orderbook confirmation source', 'fail closed without deploy binding'],
    clarificationTurns: [],
    expectedFailure: 'deploy_payload_missing_binding',
  },
  {
    id: 'stage4-funding-data-source-binding',
    category: 'data_source_binding',
    initialUserMessage: 'BTCUSDT 15m。资金费率为正并且 EMA20 上穿时开多。',
    expectedAtomKeys: ['fundingRate.condition'],
    expectedSemanticIntent: ['funding rate confirmation source', 'fail closed without runtime feed'],
    clarificationTurns: [],
    expectedFailure: 'runtime_missing_data',
  },
  {
    id: 'stage4-open-interest-data-source-binding',
    category: 'data_source_binding',
    initialUserMessage: 'BTCUSDT 15m。未平仓量增加并且突破 20 根高点时开多。',
    expectedAtomKeys: ['openInterest.condition'],
    expectedSemanticIntent: ['open interest confirmation source', 'fail closed without runtime feed'],
    clarificationTurns: [],
    expectedFailure: 'runtime_missing_data',
  },
  {
    id: 'stage4-liquidation-data-source-binding',
    category: 'data_source_binding',
    initialUserMessage: 'BTCUSDT 15m。出现多头清算瀑布后只做空。',
    expectedAtomKeys: ['liquidation.condition'],
    expectedSemanticIntent: ['liquidation event source', 'fail closed without deploy binding'],
    clarificationTurns: [],
    expectedFailure: 'deploy_payload_missing_binding',
  },
  {
    id: 'stage4-webhook-event-source-binding',
    category: 'data_source_binding',
    initialUserMessage: '收到 TradingView webhook buy 信号后开多，单笔 10% 仓位。',
    expectedAtomKeys: ['event.externalSignal'],
    expectedSemanticIntent: ['external webhook event source', 'fail closed without event deploy binding'],
    clarificationTurns: [],
    expectedFailure: 'deploy_payload_missing_binding',
  },
```

- [ ] **Step 3: Update expected categories**

In `real-strategy-corpus.spec.ts` add:

```ts
  'data_source_binding',
```

- [ ] **Step 4: Run corpus tests**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/real-strategy-corpus.spec.ts
```

Expected: PASS. If a predicate is not dispatched yet, either add conservative dispatcher support in Task 7 or change the case to `scope.dataSource` binding evidence with the same fail-closed blocker.

- [ ] **Step 5: Commit corpus changes**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/stage4/stage4-real-strategy-corpus.ts apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/real-strategy-corpus.spec.ts
git commit -F - <<'MSG'
test: add stage4 pr5 real strategy corpus cases

Refs: #1739
Refs: #1631
MSG
```

### Task 6: Add Full Rules Pipeline Tests

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/rules-only-full-pipeline-pr5.spec.ts`

- [ ] **Step 1: Create full-pipeline fixture**

```ts
import type { CodegenSemanticPatch } from '../../types/codegen-semantic-patch'
import { CanonicalSpecBuilderService } from '../../services/canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../../services/canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../../services/canonical-strategy-ast-compiler.service'
import { CodegenGraphSnapshotService } from '../../services/codegen-graph-snapshot.service'
import { CodegenPublicationGenerationStage } from '../../services/codegen-publication-generation.stage'
import { CompiledScriptEmitterService } from '../../services/compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '../../services/compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from '../../services/compiled-script-parser.service'
import { GenericSeedDispatcher } from '../../services/generic-seed-dispatcher.service'
import { ScriptProfileExtractorService } from '../../services/script-profile-extractor.service'
import { SemanticContractReadinessService } from '../../services/semantic-contract-readiness.service'
import { SemanticSeedStateBuilderService } from '../../services/semantic-seed-state-builder.service'
import { SemanticStateProjectionService } from '../../services/semantic-state-projection.service'
import { SpecDescBuilderService } from '../../services/spec-desc-builder.service'
import { StrategyConsistencyService } from '../../services/strategy-consistency.service'
import { StrategySummaryBuilderService } from '../../services/strategy-summary-builder.service'
import { StrategySummaryObservationService } from '../../services/strategy-summary-observation.service'

function createPublicationStage(): CodegenPublicationGenerationStage {
  return new CodegenPublicationGenerationStage(
    new CanonicalSpecBuilderService(),
    new SpecDescBuilderService(),
    new StrategySummaryBuilderService(new ScriptProfileExtractorService()),
    new StrategyConsistencyService(new ScriptProfileExtractorService()),
    new CanonicalSpecV2IrCompilerService(),
    new CanonicalStrategyAstCompilerService(),
    new CompiledScriptEmitterService(),
    new CompiledScriptExecutionEnvelopeService(),
    new CompiledScriptParserService(),
    new StrategySummaryObservationService(),
    undefined,
    new CodegenGraphSnapshotService(),
  )
}
```

- [ ] **Step 2: Add full-pipeline runner**

```ts
async function runFullPipeline(utterance: string) {
  const dispatcher = new GenericSeedDispatcher()
  const semanticPatch = dispatcher.dispatch(utterance) as CodegenSemanticPatch
  expect(semanticPatch.rules?.length ?? 0).toBeGreaterThan(0)

  const state = new SemanticSeedStateBuilderService().build(semanticPatch, utterance)
  expect(state).not.toBeNull()
  expect(state?.rules?.length ?? 0).toBeGreaterThan(0)

  const readiness = new SemanticContractReadinessService().evaluate(state!)
  expect(readiness).toBeDefined()

  const projection = new SemanticStateProjectionService()
  const displayGraph = projection.buildDisplayLogicGraph(state!)
  expect(displayGraph.blocks.length).toBeGreaterThan(0)

  const artifacts = await createPublicationStage().generate({ semanticState: state! })
  expect(artifacts.canonicalSpec.rules.length).toBeGreaterThan(0)
  expect(artifacts.compiled.ir.ruleBlocks.length).toBeGreaterThan(0)
  expect(artifacts.ast.decisionPrograms.length).toBeGreaterThan(0)
  expect(artifacts.compiledScript).toContain('protocolVersion')
  expect(artifacts.compiledScript).toContain('onBar')
  expect(artifacts.validation.passed).toBe(true)
  expect(artifacts.publishParams.symbol).toBeTruthy()
  expect(artifacts.publishParams.timeframe).toBeTruthy()

  return { semanticPatch, state: state!, readiness, displayGraph, artifacts }
}
```

- [ ] **Step 3: Add deploy-ready full-pipeline case for each ready PR5 row**

```ts
describe('Stage 4 PR5 full rules pipeline', () => {
  it('multi-timeframe deploy-ready row survives dialogue through deploy payload', async () => {
    const result = await runFullPipeline('BTCUSDT 15m。EMA20 上穿 EMA50 开多，1h MA50 上方才允许入场，单笔 10% 仓位。')
    const serialized = JSON.stringify(result)

    expect(serialized).toContain('rules[')
    expect(serialized).toContain('scope.timeframe')
    expect(serialized).toContain('requiredTimeframes')
    expect(serialized).toContain('sourcePath')
  })
})
```

If additional PR5 rows are marked `deploy_ready`, add one test per row with the same full chain and atom-specific `sourcePath`/payload assertions.

- [ ] **Step 4: Add fail-closed full-pipeline checks for non-ready rows**

```ts
  it.each([
    ['orderbook binding', 'BTCUSDT 15m。EMA20 上穿开多，但需要 Binance orderbook imbalance 大于 60% 确认。', 'deploy_payload_missing_binding'],
    ['funding binding', 'BTCUSDT 15m。资金费率为正并且 EMA20 上穿时开多。', 'runtime_missing_data'],
    ['open interest binding', 'BTCUSDT 15m。未平仓量增加并且突破 20 根高点时开多。', 'runtime_missing_data'],
  ])('%s remains fail-closed before fake deploy payload', async (_name, utterance, blocker) => {
    const dispatcher = new GenericSeedDispatcher()
    const semanticPatch = dispatcher.dispatch(utterance) as CodegenSemanticPatch
    const state = new SemanticSeedStateBuilderService().build(semanticPatch, utterance)

    expect(state).not.toBeNull()
    const readiness = new SemanticContractReadinessService().evaluate(state!)
    const readinessJson = JSON.stringify(readiness)
    const stateJson = JSON.stringify(state)

    expect(stateJson).toContain('rules')
    expect(readinessJson.includes(blocker) || readiness.missingSlots.length > 0).toBe(true)
  })
```

- [ ] **Step 5: Run full-pipeline PR5 test**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/rules-only-full-pipeline-pr5.spec.ts
```

Expected: PASS. If the multi-timeframe case cannot prove deploy payload, downgrade `orchestration.multi_timeframe` in Task 2 and remove the deploy-ready assertion.

- [ ] **Step 6: Commit full-pipeline tests**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/rules-only-full-pipeline-pr5.spec.ts
git commit -F - <<'MSG'
test: prove stage4 pr5 full rules pipeline

Refs: #1739
Refs: #1631
MSG
```

### Task 7: Add Minimal Dispatcher Support Only Where Needed

**Files:**
- Modify only if tests show missing attempt-1 routing: `apps/quantify/src/modules/llm-strategy-codegen/services/generic-seed-dispatcher.service.ts`
- Modify if contract surfaces need keywords: `apps/quantify/src/modules/llm-strategy-codegen/atom-contracts/atom-contract-registry.ts`

- [ ] **Step 1: Prefer registry surfaces over dispatcher branches**

Add or adjust keywords in `ATOM_CONTRACT_REGISTRY` surfaces for these atom keys instead of adding atom-key-specific dispatcher branches:

```ts
'scope.dataSource'
'scope.timeframe'
'scope.symbol'
'gate.regime'
'portfolioRisk.drawdown_block'
'orderbook.imbalance'
'fundingRate.condition'
'openInterest.condition'
'liquidation.condition'
'external.signal'
```

- [ ] **Step 2: If schema extraction is missing, add generic parser support**

Add a parser branch by extractor kind, not by atom key. The output must normalize user terms to schema refs:

```ts
function normalizeDataSourceSchemaText(value: string): 'ohlcv' | 'orderbook' | 'funding' | 'open_interest' | 'liquidation' | 'webhook_event' | null {
  const text = value.toLowerCase()
  if (/ohlcv|kline|bar|蜡烛|k线/iu.test(text)) return 'ohlcv'
  if (/orderbook|盘口|深度/iu.test(text)) return 'orderbook'
  if (/funding|资金费率/iu.test(text)) return 'funding'
  if (/open\s*interest|oi|未平仓/iu.test(text)) return 'open_interest'
  if (/liquidation|清算|爆仓/iu.test(text)) return 'liquidation'
  if (/webhook|external|tradingview|事件源/iu.test(text)) return 'webhook_event'
  return null
}
```

- [ ] **Step 3: Rerun dialogue and corpus tests**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/orchestration-data-source-dialogue-entrance.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/real-strategy-corpus.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Commit routing support if files changed**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/generic-seed-dispatcher.service.ts apps/quantify/src/modules/llm-strategy-codegen/atom-contracts/atom-contract-registry.ts
git commit -F - <<'MSG'
feat: route stage4 pr5 orchestration data-source utterances

Refs: #1739
Refs: #1631
MSG
```

### Task 8: Add Focused Display / Canonical / IR / Publication Assertions

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts`

- [ ] **Step 1: Add display source-path test for ready PR5 rows**

```ts
it('renders PR5 orchestration source path from rules tree display graph', () => {
  const rules: SemanticRule[] = [{
    id: 'rule-pr5-timeframe',
    phase: 'entry',
    sideScope: 'long',
    condition: { kind: 'atom', key: 'indicator.cross_over', params: { indicator: 'ema', fastPeriod: 20, slowPeriod: 50, timeframe: '15m' } },
    effects: {
      actions: [{ kind: 'atom', key: 'action.open_long', params: {} }],
      risks: [],
      positions: [{ kind: 'atom', key: 'position.sizing', params: { sizing: { mode: 'RATIO', value: 0.1 } } }],
      programs: [],
      orchestration: [{ kind: 'atom', key: 'scope.timeframe', params: { timeframeScopeKind: 'timeframe', primaryTimeframe: '15m', requiredTimeframes: ['1h'], alignmentPolicy: 'strict' } }],
    },
  }]
  const graph = service.buildDisplayLogicGraph(baseState({ rules }))
  const text = graph.blocks.flatMap(block => block.items).map(item => item.text).join('\n')

  expect(text).toContain('1h')
  expect(text).not.toContain('legacy')
})
```

- [ ] **Step 2: Add canonical/IR source path checks**

Use existing rules-only fixture builders in each test file. Assert:

```ts
expect(JSON.stringify(spec.orchestration?.scopes ?? [])).toContain('rules[0].effects.orchestration[0]')
expect(JSON.stringify(ir.orchestrationScopes ?? [])).toContain('scopeKind')
```

- [ ] **Step 3: Add publication fail-closed check for unbound data source**

Assert unsupported rows do not pass deploy payload gate:

```ts
expect(JSON.stringify(result)).not.toContain('deployPayload.dataRequirements.sourcePath')
```

- [ ] **Step 4: Run focused tests**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit focused assertions**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts
git commit -F - <<'MSG'
test: assert pr5 orchestration source paths through publication

Refs: #1739
Refs: #1631
MSG
```

### Task 9: Run Required Validation and Final Commit

**Files:**
- No new files expected. Commit any remaining test expectation or matrix alignment edits.

- [ ] **Step 1: Run Stage 4 unit suite**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4
```

Expected: PASS.

- [ ] **Step 2: Run atom contract suite**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/atom-contracts
```

Expected: PASS.

- [ ] **Step 3: Run focused services suites**

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts
```

Expected: PASS.

- [ ] **Step 4: Run Stage 4 rules-only e2e**

```bash
dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen/stage4-rules-only-atoms.e2e-spec.ts
```

Expected: PASS with at least current pass count; current baseline is 10 or more passed.

- [ ] **Step 5: Build quantify**

```bash
dx build quantify --dev
```

Expected: PASS.

- [ ] **Step 6: Inspect PR4 rows stayed unchanged**

```bash
git diff origin/main...HEAD -- apps/quantify/src/modules/llm-strategy-codegen/stage4/atom-coverage-matrix.ts | rg "program.fixed_grid_gated|program.dca|action.reduce_position|action.limit_order|action.conditional_order" -n
```

Expected: only context lines or intentional unchanged assertions; no deploy-ready promotion for these rows.

- [ ] **Step 7: Commit remaining changes**

```bash
git status --short
git add apps/quantify/src/modules/llm-strategy-codegen apps/quantify/e2e/llm-strategy-codegen/stage4-rules-only-atoms.e2e-spec.ts
git commit -F - <<'MSG'
feat: add stage4 orchestration data-source atoms

Refs: #1739
Refs: #1631
MSG
```

If nothing remains to commit, skip this step and keep earlier commits.

### Task 10: Prepare PR

**Files:**
- No source files.

- [ ] **Step 1: Confirm branch and status**

```bash
git status --short --branch
git log --oneline origin/main..HEAD
```

Expected: branch is `feat/1739-stage4-orchestration-data-source-atoms-pr5`; status clean.

- [ ] **Step 2: Push branch**

```bash
git push -u origin feat/1739-stage4-orchestration-data-source-atoms-pr5
```

Expected: push succeeds. If pre-push build hook runs, include its result in PR validation.

- [ ] **Step 3: Create PR with required body**

```bash
gh pr create --title "feat: add stage4 orchestration data-source atoms" --body-file - <<'MSG'
## 变更目的

- 扩展 Stage 4 PR5 orchestration 与 data-source binding atom 覆盖。
- 保持 rules-only 主链路，不引入 legacy flat projection / five-bucket fallback。
- 只将完整 rules 全流程走通的 atom 标为 deploy-ready。

## 主要改动和解决的问题

- 新增 PR5 matrix rows，统一挂到 `rules[].effects.orchestration`。
- 扩展 `scope.dataSource` schema binding，覆盖 `ohlcv/orderbook/funding/open_interest/liquidation/webhook_event`。
- 新增 attempt-1 dialogue、corpus、full-pipeline、display/canonical/IR/publication 断言。
- 未具备 runtime/deploy binding 的 market-data predicate 保持 fail-closed，并声明 blocker。

## 遗留的问题

- 未实现 PR6 staging 90% acceptance，继续由 #1631 后续 PR 覆盖。
- 未补全所有 market-data predicate runtime/deploy binding；本 PR 中保留 fail-closed 状态。

## 已做的验证

- `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4` → 通过
- `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/atom-contracts` → 通过
- `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts` → 通过
- `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts` → 通过
- `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts` → 通过
- `dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen/stage4-rules-only-atoms.e2e-spec.ts` → 通过，pass count 未减少
- `dx build quantify --dev` → 通过

##  PR 遗留未做的

- 无。

## 关联

- Closes: #1739
- Refs: #1631
MSG
```

Expected: PR created against `main`.

## Self-Review

- Spec coverage: plan covers matrix, schema binding, dialogue routing, corpus, full rules pipeline, focused display/canonical/IR/publication checks, validation, PR body.
- Red-flag scan: no incomplete markers are intentionally left.
- Type consistency: data-source schema names are `funding` and `open_interest` in semantic/canonical/IR; public webhook matrix metadata uses `webhook`, semantic schema uses `webhook_event`.
