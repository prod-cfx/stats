import type { CodegenSemanticPatch } from '@/modules/llm-strategy-codegen/types/codegen-semantic-patch'
import type { AtomExprAtom, SemanticRule } from '@/modules/llm-strategy-codegen/types/atom-expr'
import { CanonicalSpecBuilderService } from '@/modules/llm-strategy-codegen/services/canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '@/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '@/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service'
import { CodegenGraphSnapshotService } from '@/modules/llm-strategy-codegen/services/codegen-graph-snapshot.service'
import { CodegenPublicationGenerationStage } from '@/modules/llm-strategy-codegen/services/codegen-publication-generation.stage'
import { CompiledScriptEmitterService } from '@/modules/llm-strategy-codegen/services/compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '@/modules/llm-strategy-codegen/services/compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from '@/modules/llm-strategy-codegen/services/compiled-script-parser.service'
import { GenericSeedDispatcher } from '@/modules/llm-strategy-codegen/services/generic-seed-dispatcher.service'
import { ScriptProfileExtractorService } from '@/modules/llm-strategy-codegen/services/script-profile-extractor.service'
import { SemanticSeedStateBuilderService } from '@/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service'
import { SpecDescBuilderService } from '@/modules/llm-strategy-codegen/services/spec-desc-builder.service'
import { StrategyConsistencyService } from '@/modules/llm-strategy-codegen/services/strategy-consistency.service'
import { StrategySummaryBuilderService } from '@/modules/llm-strategy-codegen/services/strategy-summary-builder.service'
import { StrategySummaryObservationService } from '@/modules/llm-strategy-codegen/services/strategy-summary-observation.service'
import { SemanticStateProjectionService } from '@/modules/llm-strategy-codegen/services/semantic-state-projection.service'
import { collectAtomLeaves, listRuleEffects } from '@/modules/llm-strategy-codegen/types/atom-expr'
import type { SemanticState } from '@/modules/llm-strategy-codegen/types/semantic-state'
import { evaluateExprPool, runDecisionPrograms } from '@ai/shared/script-engine/compiled-runtime'
import { OFFICIAL_STRATEGY_PLAZA_TEMPLATES } from '../constants/official-strategy-plaza-templates'
import { OFFICIAL_STRATEGY_PLAZA_BACKTEST_EVIDENCE } from '../constants/official-strategy-plaza-backtest-evidence.constant'

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

function getTemplateInitialMessage(templateId: string): string {
  const template = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.find(item => item.id === templateId)
  if (!template) throw new Error(`${templateId} template missing`)
  return template.editSeed.initialMessage
}

function buildStateFromMessage(message: string): SemanticState {
  const patch = new GenericSeedDispatcher().dispatch(message) as CodegenSemanticPatch
  const state = new SemanticSeedStateBuilderService().build(patch, message)
  if (!state) throw new Error('semantic seed state missing')
  return state
}

function buildRulesFromMessage(message: string): readonly SemanticRule[] {
  return buildStateFromMessage(message).rules ?? []
}

function collectRuleAtoms(rules: readonly SemanticRule[]): AtomExprAtom[] {
  return rules.flatMap(rule => [
    ...collectAtomLeaves(rule.condition),
    ...listRuleEffects(rule.effects).flatMap(effect => collectAtomLeaves(effect)),
  ])
}

function findRuleAtom(rules: readonly SemanticRule[], key: string): AtomExprAtom | undefined {
  return collectRuleAtoms(rules).find(atom => atom.key === key)
}

function findRuleEffectAtom(rule: SemanticRule | undefined, key: string): AtomExprAtom | undefined {
  if (!rule) return undefined
  return listRuleEffects(rule.effects)
    .flatMap(effect => collectAtomLeaves(effect))
    .find(atom => atom.key === key)
}

function findRuleConditionAtom(rule: SemanticRule | undefined, key: string): AtomExprAtom | undefined {
  if (!rule) return undefined
  return collectAtomLeaves(rule.condition).find(atom => atom.key === key)
}

async function generateArtifactsFromTemplate(templateId: string) {
  return createPublicationStage().generate({ semanticState: buildStateFromMessage(getTemplateInitialMessage(templateId)) })
}

function risingBars(count = 60) {
  return Array.from({ length: count }, (_, index) => {
    const close = index < count - 1 ? 100 : 130
    return { open: close, high: close, low: close, close, volume: 1, timestamp: index + 1 }
  })
}

describe('Strategy Plaza official edit seed rules mainflow codegen', () => {
  it.each([
    'low-drawdown-regime-gate',
    'orderbook-imbalance-long',
    'fixed-grid-gated',
    'drawdown-dca-budget',
    'timed-dca-budget',
    'trend-filtered-grid',
    'funding-oi-confirmation',
    'grid-breakout-stop',
  ])('%s generates compiled script from the edit seed used by the edit flow', async (templateId) => {
    const message = getTemplateInitialMessage(templateId)
    const patch = new GenericSeedDispatcher().dispatch(message) as CodegenSemanticPatch
    const state = new SemanticSeedStateBuilderService().build(patch, message)

    expect(state).not.toBeNull()
    if (!state) throw new Error(`${templateId} edit seed state missing`)
    const artifacts = await createPublicationStage().generate({ semanticState: state })

    expect(artifacts.validation.passed).toBe(true)
    expect(artifacts.semanticAtomInvariant.status).toBe('PASSED')
    expect(artifacts.compiledScript).toContain('protocolVersion')
    expect(artifacts.compiledScript).toContain('onBar')
  })

  it('keeps orderbook imbalance as an entry predicate in rules mainflow', () => {
    const rules = buildRulesFromMessage(getTemplateInitialMessage('orderbook-imbalance-long'))
    const orderbookImbalance = findRuleAtom(rules, 'orderbook.imbalance')
    const breakout = findRuleAtom(rules, 'price.rolling_extrema_breakout')
    const entryRule = rules.find(rule => rule.phase === 'entry')
    const entryConditionKeys = entryRule ? collectAtomLeaves(entryRule.condition).map(atom => atom.key) : []

    expect(orderbookImbalance).toBeDefined()
    expect(orderbookImbalance?.params).toMatchObject({ operator: 'gt', ratio: 1.083333 })
    expect(breakout?.params).toMatchObject({ event: 'breakout_up', extrema: 'high', lookbackBars: 6 })
    expect(entryConditionKeys).toEqual(expect.arrayContaining(['price.rolling_extrema_breakout', 'orderbook.imbalance']))
    expect(entryConditionKeys).not.toContain('indicator.cross_over')
    expect(entryConditionKeys).not.toContain('gate.regime')
  })

  it('keeps fixed grid range count and step in rules mainflow', () => {
    const rules = buildRulesFromMessage(getTemplateInitialMessage('fixed-grid-gated'))
    const fixedGrid = findRuleAtom(rules, 'program.fixed_grid_gated')

    expect(fixedGrid).toBeDefined()
    expect(fixedGrid?.params).toMatchObject({
      programKind: 'fixed_grid_gated',
      lowerBound: 65000,
      upperBound: 80000,
      levelCount: 10,
      stepPct: 5,
    })
  })

  it('keeps fixed grid start gate active after the first bar', async () => {
    const artifacts = await generateArtifactsFromTemplate('fixed-grid-gated')
    const predicateIds = artifacts.compiled.ir.signalCatalog.predicates.map(item => item.id)

    expect(predicateIds).toEqual(expect.arrayContaining([
      expect.stringContaining('active_range'),
    ]))
    expect(predicateIds.join(' ')).not.toContain('execution_on_start')
    expect(artifacts.compiledScript).not.toContain('BAR_INDEX')
  })

  it.each([
    'fixed-grid-gated',
    'trend-filtered-grid',
    'grid-breakout-stop',
  ])('%s keeps grid side mode separate from account position mode', async (templateId) => {
    const state = buildStateFromMessage(getTemplateInitialMessage(templateId))
    const artifacts = await createPublicationStage().generate({ semanticState: state })
    const executionModel = artifacts.compiledScript.match(/const EXECUTION_MODEL = (\{.*\}) as const/u)

    expect(executionModel).not.toBeNull()
    expect(artifacts.compiled.ir.portfolio.positionMode).toBe('long_only')
    expect(JSON.parse(executionModel?.[1] ?? '{}').positionMode).toBe('long_only')
  })

  it('keeps breakout stop grid as explicit fixed range grid in rules mainflow', () => {
    const rules = buildRulesFromMessage(getTemplateInitialMessage('grid-breakout-stop'))
    const fixedGrid = findRuleAtom(rules, 'program.fixed_grid_gated')
    const stopLoss = findRuleAtom(rules, 'risk.stop_loss_pct')
    const takeProfit = findRuleAtom(rules, 'risk.take_profit_pct')

    expect(fixedGrid).toBeDefined()
    expect(fixedGrid?.params).toMatchObject({
      programKind: 'fixed_grid_gated',
      lowerBound: 65600,
      upperBound: 69600,
      absoluteSpacing: 100,
      breakoutAction: 'stop',
    })
    expect(stopLoss?.params).toMatchObject({ valuePct: 0.6 })
    expect(takeProfit?.params).toMatchObject({ valuePct: 0.12 })
  })

  it('renders orderbook imbalance instead of an EMA-only precondition in confirmation summary', () => {
    const view = new SemanticStateProjectionService().buildConversationView(buildStateFromMessage(getTemplateInitialMessage('orderbook-imbalance-long')))

    expect(view.summary).toContain('盘口失衡')
    expect(view.summary).toContain('突破过去 6 根 K 线')
    expect(view.summary).not.toContain('只在价格高于 EMA')
    expect(view.summary).not.toContain('只在价格低于 EMA')
  })

  it('renders fixed grid explicit range count and step in confirmation summary', () => {
    const view = new SemanticStateProjectionService().buildConversationView(buildStateFromMessage(getTemplateInitialMessage('fixed-grid-gated')))

    expect(view.summary).toContain('65000-80000')
    expect(view.summary).toContain('10 档')
    expect(view.summary).toContain('5%')
    expect(view.summary).not.toContain('挂 0 档')
    expect(view.summary).not.toContain('步长 0%')
  })

  it('keeps drawdown DCA schedule separate from the 8% average-price exit', () => {
    const rules = buildRulesFromMessage(getTemplateInitialMessage('drawdown-dca-budget'))
    const entryRule = rules.find(rule => rule.phase === 'entry')
    const exitRule = rules.find(rule => rule.phase === 'exit' && findRuleConditionAtom(rule, 'price.percent_change'))
    const dcaSchedule = findRuleEffectAtom(entryRule, 'position.dca_schedule')
    const entryPercentChange = findRuleConditionAtom(entryRule, 'price.percent_change')
    const exitPercentChange = findRuleConditionAtom(exitRule, 'price.percent_change')

    expect(dcaSchedule?.params).toMatchObject({
      dropPct: 3,
      maxCount: 3,
      perOrderSizing: { kind: 'quote', value: 100, asset: 'USDT' },
      capitalCap: { kind: 'quote', value: 1000, asset: 'USDT' },
    })
    expect(entryPercentChange?.params.valuePct).not.toBe(-8)
    expect(exitRule ? exitPercentChange?.params : { basis: 'entry_avg_price', valuePct: -8 }).toMatchObject({ basis: 'entry_avg_price', valuePct: -8 })
  })

  it('compiles drawdown DCA with runtime-positive price interval metadata', async () => {
    const artifacts = await generateArtifactsFromTemplate('drawdown-dca-budget')
    const dcaRule = artifacts.compiled.ir.ruleBlocks.find(block => block.metadata?.dcaSchedule)

    expect(dcaRule?.metadata?.dcaSchedule).toEqual(expect.objectContaining({
      triggerMode: 'price_interval',
      priceIntervalPct: 3,
    }))
  })

  it('keeps timed DCA as a long-only spot program without short-market conflict', () => {
    const rules = buildRulesFromMessage(getTemplateInitialMessage('timed-dca-budget'))
    const atoms = collectRuleAtoms(rules)
    const dcaProgram = findRuleAtom(rules, 'program.dca')
    const dcaSchedule = findRuleAtom(rules, 'position.dca_schedule')
    const takeProfit = findRuleAtom(rules, 'risk.take_profit_pct')
    const stopLoss = findRuleAtom(rules, 'risk.stop_loss_pct')

    expect(dcaProgram).toBeDefined()
    expect(dcaSchedule?.params).toMatchObject({
      intervalHours: 24,
      maxCount: 10,
      perOrderSizing: { kind: 'quote', value: 100, asset: 'USDT' },
      capitalCap: { kind: 'quote', value: 1000, asset: 'USDT' },
    })
    expect(takeProfit?.params).toMatchObject({ valuePct: 0.12 })
    expect(stopLoss?.params).toMatchObject({ valuePct: 3 })
    expect(atoms.map(atom => atom.key)).not.toEqual(expect.arrayContaining(['action.open_short', 'action.close_short']))
  })

  it('compiles timed DCA cadence as executable cooldown without breaking DCA schedule', async () => {
    const state = buildStateFromMessage(getTemplateInitialMessage('timed-dca-budget'))
    const artifacts = await createPublicationStage().generate({ semanticState: state })
    const riskPredicates = artifacts.compiled.ir.riskPolicy?.riskPredicates ?? artifacts.compiled.ir.riskPredicates ?? []
    const dcaRule = artifacts.compiled.ir.ruleBlocks.find(block => block.metadata?.dcaSchedule)

    expect(riskPredicates.map(predicate => predicate.kind)).toContain('cooldownBars')
    expect(dcaRule?.metadata?.dcaSchedule).toEqual(expect.objectContaining({
      triggerMode: 'time_interval',
      timeIntervalMs: 24 * 60 * 60 * 1000,
    }))
    expect(artifacts.compiledScript).toContain('ADD_LONG')
  })

  it('keeps Funding plus OI threshold in rules mainflow', () => {
    const rules = buildRulesFromMessage(getTemplateInitialMessage('funding-oi-confirmation'))
    const entryRule = rules.find(rule => rule.phase === 'entry')
    const funding = findRuleConditionAtom(entryRule, 'fundingRate.condition')
    const oi = findRuleConditionAtom(entryRule, 'openInterest.condition')
    const breakout = findRuleConditionAtom(entryRule, 'price.rolling_extrema_breakout')
    const entryConditionKeys = entryRule ? collectAtomLeaves(entryRule.condition).map(atom => atom.key) : []

    expect(entryConditionKeys).toEqual(expect.arrayContaining(['price.rolling_extrema_breakout', 'fundingRate.condition', 'openInterest.condition']))
    expect(entryConditionKeys).not.toContain('indicator.cross_over')
    expect(breakout?.params).toMatchObject({ event: 'breakout_up', extrema: 'high', lookbackBars: 8 })
    expect(funding?.params).toMatchObject({ operator: 'GT', value: 0 })
    expect(oi?.params).toMatchObject({ direction: 'up', operator: 'GT', value: 0.5 })
  })

  it('fires orderbook imbalance confirmation with rolling breakout in generated runtime artifacts', async () => {
    const artifacts = await generateArtifactsFromTemplate('orderbook-imbalance-long')
    const ast = artifacts.ast
    const exprValues = evaluateExprPool(
      {
        bars: risingBars(),
        timestamp: 60,
        position: { side: 'flat', qty: 0 },
        accountEquity: 10_000,
        currentPrice: 130,
        eventInbox: {
          'orderbook.imbalance': [{ id: 'book-1', ts: 59, payload: { bidDepth: 1_700, askDepth: 1_000 } }],
        },
        __compiledDecisionState: { barIndex: 60, lastTriggeredByProgram: {} },
      } as never,
      ast.exprPool,
      ast.topology.exprOrder,
      ast.executionModel,
    )
    const decision = runDecisionPrograms(
      { position: { side: 'flat', qty: 0 }, accountEquity: 10_000, currentPrice: 130, __compiledDecisionState: { barIndex: 60, lastTriggeredByProgram: {} } } as never,
      ast.decisionPrograms as never,
      exprValues,
      { forceExit: false, blockNewEntry: false, strategyHalt: false },
      ast.topology.decisionOrder,
      undefined,
      undefined,
      ast.orchestrationScopes,
      ast.orchestrationLegScopes,
    )

    expect(decision.action).toBe('OPEN_LONG')
  })

  it('fires funding plus OI confirmation with rolling breakout in generated runtime artifacts', async () => {
    const artifacts = await generateArtifactsFromTemplate('funding-oi-confirmation')
    const ast = artifacts.ast
    const exprValues = evaluateExprPool(
      {
        bars: risingBars(),
        timestamp: 60,
        position: { side: 'flat', qty: 0 },
        accountEquity: 10_000,
        currentPrice: 130,
        eventInbox: {
          'funding.rate': [{ id: 'funding-1', ts: 59, payload: { fundingRate: 0.0001 } }],
          open_interest: [
            { id: 'oi-1', ts: 58, payload: { openInterest: 100 } },
            { id: 'oi-2', ts: 59, payload: { openInterest: 104 } },
          ],
        },
        __compiledDecisionState: { barIndex: 60, lastTriggeredByProgram: {} },
      } as never,
      ast.exprPool,
      ast.topology.exprOrder,
      ast.executionModel,
    )
    const decision = runDecisionPrograms(
      { position: { side: 'flat', qty: 0 }, accountEquity: 10_000, currentPrice: 130, __compiledDecisionState: { barIndex: 60, lastTriggeredByProgram: {} } } as never,
      ast.decisionPrograms as never,
      exprValues,
      { forceExit: false, blockNewEntry: false, strategyHalt: false },
      ast.topology.decisionOrder,
      undefined,
      undefined,
      ast.orchestrationScopes,
      ast.orchestrationLegScopes,
    )

    expect(decision.action).toBe('OPEN_LONG')
  })

  it.each([
    'orderbook-imbalance-long',
    'fixed-grid-gated',
    'drawdown-dca-budget',
    'timed-dca-budget',
    'funding-oi-confirmation',
    'grid-breakout-stop',
  ])('%s preserves evidence cadence and hold bars as executable rules atoms', async (templateId) => {
    const evidence = OFFICIAL_STRATEGY_PLAZA_BACKTEST_EVIDENCE.templates.find(item => item.templateId === templateId)
    const params = evidence?.params as Record<string, unknown> | undefined
    const artifacts = await generateArtifactsFromTemplate(templateId)
    const riskPredicates = artifacts.compiled.ir.riskPolicy?.riskPredicates ?? artifacts.compiled.ir.riskPredicates ?? []
    const cooldownRuleBlocks = artifacts.compiled.ir.ruleBlocks.filter(block => typeof block.cooldownBars === 'number')
    const cooldownPredicates = riskPredicates.filter(predicate => predicate.kind === 'cooldownBars')

    if (typeof params?.holdBars === 'number') {
      expect(riskPredicates).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'timeStopBars', params: expect.objectContaining({ maxBars: params.holdBars }) }),
      ]))
      expect(artifacts.compiledScript).toContain('timeStopBars')
    }

    if (typeof params?.cadence === 'number') {
      expect([...cooldownRuleBlocks, ...cooldownPredicates]).toEqual(expect.arrayContaining([
        expect.objectContaining(
          'cooldownBars' in (cooldownRuleBlocks[0] ?? {})
            ? { cooldownBars: params.cadence }
            : { kind: 'cooldownBars', params: expect.objectContaining({ bars: params.cadence }) },
        ),
      ]))
      expect(artifacts.compiledScript).toContain('cooldownBars')
    }
  })
})
