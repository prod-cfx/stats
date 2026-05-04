import type { CanonicalRuleV2, CanonicalStrategySpecV2 } from '../../types/canonical-strategy-spec'
import type { SemanticState } from '../../types/semantic-state'
import { NORMALIZED_TRIGGER_ATOM_KEYS } from '../../types/strategy-normalized-intent'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CodegenConversationService } from '../codegen-conversation.service'
import { CodegenPublicationGenerationStage } from '../codegen-publication-generation.stage'
import { CompiledPublicationGateService } from '../compiled-publication-gate.service'
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import { CompiledScriptExecutionEnvelopeService } from '../compiled-script-execution-envelope.service'
import { CompiledScriptParserService } from '../compiled-script-parser.service'
import { RuntimeGuardrailService } from '../runtime-guardrail.service'
import { ScriptProfileExtractorService } from '../script-profile-extractor.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { buildNormalizedIntentFromSemanticState } from '../semantic-state-normalization'
import { SpecDescBuilderService } from '../spec-desc-builder.service'
import { StaticGuardrailService } from '../static-guardrail.service'
import { StrategyClarificationQuestionService } from '../strategy-clarification-question.service'
import { StrategyClarificationRulesService } from '../strategy-clarification-rules.service'
import { StrategyCompileabilityDecisionService } from '../strategy-compileability-decision.service'
import { StrategyConsistencyService } from '../strategy-consistency.service'
import { StrategySummaryBuilderService } from '../strategy-summary-builder.service'

interface PublishedCaseResult {
  semanticState: SemanticState
  canonicalSpec: CanonicalStrategySpecV2
  publishedSnapshot: Record<string, unknown>
}

interface RejectedCaseResult {
  semanticState: SemanticState
  canonicalSpec: CanonicalStrategySpecV2
  error: Error
}

interface SemanticStateFactory {
  buildSemanticStateFromPlannerPatch: (semanticPatch: unknown) => SemanticState | null
  findNextOpenSemanticSlot: (semanticState: SemanticState) => { slotKey: string; questionHint: string } | null
}

describe('semantic-only strategy regression verification', () => {
  jest.setTimeout(60_000)

  const seedExtractor = new SemanticSeedExtractorService()
  const canonicalSpecBuilder = new CanonicalSpecBuilderService()
  const specDescBuilder = new SpecDescBuilderService()
  const scriptProfileExtractor = new ScriptProfileExtractorService()
  const strategySummaryBuilder = new StrategySummaryBuilderService(scriptProfileExtractor)
  const strategyConsistencyService = new StrategyConsistencyService(scriptProfileExtractor)
  const compiledScriptParser = new CompiledScriptParserService()
  const publicationStage = new CodegenPublicationGenerationStage(
    canonicalSpecBuilder,
    specDescBuilder,
    strategySummaryBuilder,
    strategyConsistencyService,
    new CanonicalSpecV2IrCompilerService(),
    new CanonicalStrategyAstCompilerService(),
    new CompiledScriptEmitterService(),
    new CompiledScriptExecutionEnvelopeService(),
    compiledScriptParser,
  )
  const semanticStateFactory = new CodegenConversationService(
    { chat: jest.fn() } as never,
    {} as never,
    {} as never,
    {} as never,
    new StaticGuardrailService(),
    new RuntimeGuardrailService(),
    specDescBuilder,
    canonicalSpecBuilder,
    new StrategyCompileabilityDecisionService(),
    new StrategyClarificationRulesService(),
    new StrategyClarificationQuestionService(),
    {} as never,
  ) as unknown as SemanticStateFactory

  const checklistFieldPattern = /"?(?:ChecklistPayload|ChecklistRuleDraft|ChecklistRuleBasis|compatibilityChecklist|checklist|entryRules|exitRules|riskRules|entryRuleDrafts|exitRuleDrafts|riskRuleDrafts)"?/u

  function buildSemanticStateFromMessage(message: string): SemanticState {
    const patch = seedExtractor.extract(message)
    expect(JSON.stringify(patch)).not.toMatch(checklistFieldPattern)
    const semanticState = semanticStateFactory.buildSemanticStateFromPlannerPatch(patch)
    if (!semanticState) {
      throw new Error('semantic_seed_extraction_empty')
    }
    expectSemanticArtifactsAreChecklistFree(semanticState)
    return semanticState
  }

  function withLockedMarketContext(
    semanticState: SemanticState,
    context: { exchange?: 'binance' | 'okx' | 'hyperliquid', symbol?: string, marketType?: 'spot' | 'perp', timeframe?: string } = {},
  ): SemanticState {
    const slot = (
      field: keyof SemanticState['contextSlots'],
      value: string,
    ) => ({
      slotKey: field,
      fieldPath: `contextSlots.${field}`,
      value,
      status: 'locked' as const,
      priority: 'context' as const,
      questionHint: '',
      affectsExecution: true,
    })

    return {
      ...semanticState,
      contextSlots: {
        exchange: slot('exchange', context.exchange ?? 'okx'),
        symbol: slot('symbol', context.symbol ?? 'BTCUSDT'),
        marketType: slot('marketType', context.marketType ?? 'perp'),
        timeframe: slot('timeframe', context.timeframe ?? '15m'),
      },
    }
  }

  function expectSemanticArtifactsAreChecklistFree(...artifacts: unknown[]): void {
    for (const artifact of artifacts) {
      expect(JSON.stringify(artifact)).not.toMatch(checklistFieldPattern)
    }
  }

  function findRepoRoot(startDir: string): string {
    let current = startDir
    while (current !== dirname(current)) {
      if (existsSync(join(current, 'package.json')) && existsSync(join(current, 'apps'))) {
        return current
      }
      current = dirname(current)
    }
    throw new Error(`Unable to locate repository root from ${startDir}`)
  }

  function ruleConditionKeys(canonicalSpec: CanonicalStrategySpecV2): string[] {
    const keys: string[] = []
    const visit = (condition: CanonicalRuleV2['condition']) => {
      if (condition.kind === 'atom') {
        keys.push(condition.key)
        return
      }
      if (condition.kind === 'expression') {
        return
      }
      for (const child of condition.children) {
        visit(child)
      }
    }
    for (const rule of canonicalSpec.rules) {
      visit(rule.condition)
    }
    return keys
  }

  function ruleActionTypes(canonicalSpec: CanonicalStrategySpecV2): string[] {
    return canonicalSpec.rules.flatMap(rule => rule.actions.map(action => action.type))
  }

  const legacyAdapterForbiddenCalls = [
    'new StrategyIntentNormalizerService',
    'buildNormalizedIntentFromSemanticState(',
    'buildFromNormalizedIntent(',
    'semanticGraphBuilder.build(',
    'buildLegacyLogicSnapshotFromSemanticState(',
    'buildLegacyLogicSnapshotProjectionForCompatibility(',
  ]

  function extractNamedMethodBody(source: string, className: string, methodName: string): string | null {
    const classIndex = source.indexOf(`class ${className}`)
    if (classIndex < 0) return null

    const methodIndex = source.indexOf(`${methodName}(`, classIndex)
    if (methodIndex < 0) return null

    const openBraceIndex = source.indexOf('{', methodIndex)
    if (openBraceIndex < 0) return null

    const closeBraceIndex = findMatchingBrace(source, openBraceIndex)
    if (closeBraceIndex < 0) return null

    return source.slice(openBraceIndex + 1, closeBraceIndex)
  }

  function findMatchingBrace(source: string, openBraceIndex: number): number {
    let depth = 0
    for (let index = openBraceIndex; index < source.length; index += 1) {
      const char = source[index]
      if (char === '{') depth += 1
      if (char === '}') depth -= 1
      if (depth === 0) return index
    }

    return -1
  }

  function findLegacyAdapterCallsInMethodBody(methodBody: string): string[] {
    return legacyAdapterForbiddenCalls.filter(call => methodBody.includes(call))
  }

  async function generateAndPublish(sessionId: string, semanticState: SemanticState): Promise<PublishedCaseResult> {
    const artifacts = await publicationStage.generate({ semanticState })
    expectSemanticArtifactsAreChecklistFree(
      semanticState,
      artifacts.normalizedIntent,
      artifacts.canonicalSpec,
      artifacts.semanticView,
    )

    const repo = {
      create: jest.fn().mockResolvedValue({
        id: `${sessionId}-snapshot`,
        snapshotHash: `sha256:${sessionId}`,
      }),
    }
    const gate = new CompiledPublicationGateService(repo as never, compiledScriptParser)
    await gate.publish({
      sessionId,
      canonicalSnapshot: artifacts.canonicalSpec as unknown as Record<string, unknown>,
      semanticView: artifacts.semanticView,
      graphSnapshot: artifacts.compiled.graphSnapshot,
      clarificationState: { status: 'CLEAR', items: [] },
      ir: artifacts.compiled.ir,
      ast: artifacts.ast,
      executionEnvelope: artifacts.executionEnvelope,
      script: artifacts.compiledScript,
      semanticConsistencyReport: artifacts.semanticConsistency as unknown as Record<string, unknown>,
      userIntentSummary: artifacts.userIntentSummary as unknown as Record<string, unknown>,
      strategySummary: artifacts.strategySummary as unknown as Record<string, unknown>,
      scriptSummary: artifacts.scriptSummary as unknown as Record<string, unknown>,
      lockedParams: artifacts.lockedParams,
    })

    const publishedSnapshot = repo.create.mock.calls.at(-1)?.[0] as Record<string, unknown> | undefined
    expect(publishedSnapshot).toEqual(expect.objectContaining({
      specSnapshot: artifacts.canonicalSpec,
      semanticGraph: artifacts.semanticView,
      scriptSnapshot: expect.any(String),
    }))
    expectSemanticArtifactsAreChecklistFree(
      publishedSnapshot?.specSnapshot,
      publishedSnapshot?.semanticGraph,
      publishedSnapshot?.compiledIr,
    )

    return {
      semanticState,
      canonicalSpec: artifacts.canonicalSpec,
      publishedSnapshot: publishedSnapshot ?? {},
    }
  }

  async function expectGenerationRejected(sessionId: string, semanticState: SemanticState): Promise<RejectedCaseResult> {
    const canonicalSpec = canonicalSpecBuilder.buildFromNormalizedIntent(
      buildSemanticCanonicalContext(semanticState),
      buildNormalizedIntentFromSemanticState(semanticState),
    )
    expectSemanticArtifactsAreChecklistFree(semanticState, canonicalSpec)

    await expect(publicationStage.generate({ semanticState })).rejects.toThrow()
    try {
      await publicationStage.generate({ semanticState })
    } catch (error) {
      return {
        semanticState,
        canonicalSpec,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }

    throw new Error(`${sessionId} unexpectedly generated`)
  }

  function buildSemanticCanonicalContext(semanticState: SemanticState): {
    market: {
      exchange?: 'binance' | 'okx' | 'hyperliquid'
      marketType?: 'spot' | 'perp'
      defaultTimeframe?: string
    }
    symbols?: string[]
    timeframes?: string[]
  } {
    const read = (slot: SemanticState['contextSlots'][keyof SemanticState['contextSlots']]) =>
      slot?.status === 'locked' && typeof slot.value === 'string' && slot.value.trim() ? slot.value.trim() : null
    const exchange = read(semanticState.contextSlots.exchange)
    const symbol = read(semanticState.contextSlots.symbol)
    const marketType = read(semanticState.contextSlots.marketType)
    const timeframe = read(semanticState.contextSlots.timeframe)

    return {
      market: {
        ...(exchange === 'binance' || exchange === 'okx' || exchange === 'hyperliquid' ? { exchange } : {}),
        ...(marketType === 'spot' || marketType === 'perp' ? { marketType } : {}),
        ...(timeframe ? { defaultTimeframe: timeframe } : {}),
      },
      ...(symbol ? { symbols: [symbol] } : {}),
      ...(timeframe ? { timeframes: [timeframe] } : {}),
    }
  }

  it('keeps default stop loss basis out of semantic open slots', async () => {
    const semanticState = buildSemanticStateFromMessage('做多，亏损 5% 止损')

    expect(semanticState.risk).toContainEqual(expect.objectContaining({
      key: 'risk.stop_loss_pct',
      status: 'locked',
      params: expect.objectContaining({
        basis: 'entry_avg_price',
        basisSource: 'system_default',
      }),
      openSlots: [],
    }))
  })

  it('recognizes advanced risk expression without asking an unrelated basis question', async () => {
    const semanticState = buildSemanticStateFromMessage('如果持仓亏损超过 5%，暂停策略并平仓')

    expect(semanticState.risk).toContainEqual(expect.objectContaining({
      key: 'risk.condition_expression',
      params: expect.objectContaining({
        capabilityStatus: 'recognized_unsupported',
      }),
    }))
    expect(JSON.stringify(semanticState.risk)).not.toContain('stopLossBasis')
    expect(JSON.stringify(semanticState.risk)).not.toContain('takeProfitBasis')
  })

  it('rejects the MA price-vs-reference case as the explicit semantic compiler gap instead of checklist fallback publishing it', async () => {
    const semanticState = buildSemanticStateFromMessage('OKX 现货 BTCUSDT 15m；15m 收盘确认当价格突破 MA50 时买入；15m 收盘确认当价格跌破 MA10 时卖出；亏损 5% 止损，盈利 10% 止盈；单笔 10%。')
    const result = await expectGenerationRejected('ma-price-reference-gap', semanticState)

    expect(ruleConditionKeys(result.canonicalSpec)).toEqual(expect.arrayContaining([
      'indicator.above',
      'indicator.below',
    ]))
    expect(result.error.message).toContain('codegen.canonical_spec_v2_condition_unsupported:indicator.above')
  })

  it('publishes the EMA crossover case through semantic seed and normalized canonical generation', async () => {
    const result = await generateAndPublish(
      'ema-cross-publish',
      withLockedMarketContext(buildSemanticStateFromMessage('EMA7 上穿 EMA21 做多；EMA7 下穿 EMA21 平多；单笔 10%。')),
    )

    expect(ruleConditionKeys(result.canonicalSpec)).toEqual(expect.arrayContaining([
      'ma.golden_cross',
      'ma.death_cross',
    ]))
    expect(ruleActionTypes(result.canonicalSpec)).toEqual(expect.arrayContaining([
      'OPEN_LONG',
      'CLOSE_LONG',
    ]))
  })

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

  it('publishes Bollinger upper-short and middle-exit semantics without SMA checklist compatibility', async () => {
    const result = await generateAndPublish(
      'bollinger-upper-short-publish',
      buildSemanticStateFromMessage('OKX 合约 BTCUSDT 15m；K线收盘后确认突破布林带(30,2.5)上轨时做空；价格回到布林带中轨(MA30)时平空；单笔 10%。'),
    )

    expect(result.canonicalSpec.indicators).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'bollingerBands', params: { period: 30, stdDev: 2.5 } }),
    ]))
    expect(ruleConditionKeys(result.canonicalSpec)).toEqual(expect.arrayContaining([
      'bollinger.upper_break',
      'bollinger.middle_revert',
    ]))
    expect(ruleActionTypes(result.canonicalSpec)).toEqual(expect.arrayContaining([
      'OPEN_SHORT',
      'CLOSE_SHORT',
    ]))
    expect(result.canonicalSpec.indicators).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'sma' }),
    ]))
  })

  it('publishes two-sided Bollinger semantics from seed extraction', async () => {
    const result = await generateAndPublish(
      'bollinger-two-sided-publish',
      withLockedMarketContext(buildSemanticStateFromMessage('K线收盘后确认突破布林带(20,2)上轨时做空，突破下轨时做多；价格回到布林带中轨时平仓；单笔 10%，亏损 5% 止损。')),
    )

    expect(ruleConditionKeys(result.canonicalSpec)).toEqual(expect.arrayContaining([
      'bollinger.upper_break',
      'bollinger.lower_break',
      'bollinger.middle_revert',
      'position_loss_pct',
    ]))
    expect(ruleActionTypes(result.canonicalSpec)).toEqual(expect.arrayContaining([
      'OPEN_SHORT',
      'OPEN_LONG',
      'CLOSE_SHORT',
      'CLOSE_LONG',
      'FORCE_EXIT',
    ]))
  })

  it('publishes two-sided Bollinger semantics from bare comma parameters', async () => {
    const result = await generateAndPublish(
      'bollinger-bare-comma-publish',
      buildSemanticStateFromMessage('OKX 合约 BTCUSDT 1m，使用布林带 5,1。价格触及或突破上轨时做空，价格触及或突破下轨时做多；多单在价格回到中轨时平仓，空单在价格回到中轨时平仓；单笔仓位 10%，止损 1%，止盈 1.5%。'),
    )

    expect(result.canonicalSpec.indicators).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'bollingerBands', params: { period: 5, stdDev: 1 } }),
    ]))
    expect(ruleConditionKeys(result.canonicalSpec)).toEqual(expect.arrayContaining([
      'bollinger.upper_break',
      'bollinger.lower_break',
      'bollinger.middle_revert',
    ]))
    expect(ruleActionTypes(result.canonicalSpec)).toEqual(expect.arrayContaining([
      'OPEN_SHORT',
      'OPEN_LONG',
      'CLOSE_SHORT',
      'CLOSE_LONG',
    ]))
  })

  it('publishes only the confirmed one-sided Bollinger semantic state', async () => {
    const semanticState = withLockedMarketContext(buildSemanticStateFromMessage('K线收盘后确认突破布林带(20,2)上轨时做空，突破下轨时做多；价格回到布林带中轨时平仓；单笔 10%，亏损 5% 止损。'))
    const longOnlyState: SemanticState = {
      ...semanticState,
      triggers: semanticState.triggers.filter(trigger =>
        trigger.key === 'bollinger.touch_lower' || trigger.key === 'bollinger.touch_middle',
      ).map(trigger => ({
        ...trigger,
        sideScope: 'long',
      })),
      actions: semanticState.actions.filter(action => action.key === 'open_long' || action.key === 'close_long'),
      position: semanticState.position
        ? {
            ...semanticState.position,
            positionMode: 'long_only',
          }
        : null,
    }

    const result = await generateAndPublish('bollinger-long-only-publish', longOnlyState)

    expect(ruleConditionKeys(result.canonicalSpec)).toEqual(expect.arrayContaining([
      'bollinger.lower_break',
      'bollinger.middle_revert',
    ]))
    expect(ruleActionTypes(result.canonicalSpec)).toEqual(expect.arrayContaining([
      'OPEN_LONG',
      'CLOSE_LONG',
    ]))
    expect(ruleActionTypes(result.canonicalSpec)).not.toEqual(expect.arrayContaining([
      'OPEN_SHORT',
      'CLOSE_SHORT',
    ]))
  })

  it('publishes bidirectional grid semantics from explicit range and step seed extraction', async () => {
    const result = await generateAndPublish(
      'grid-bidirectional-publish',
      buildSemanticStateFromMessage('OKX 合约 BTCUSDT 15m；在 60000-80000 区间执行双向网格，步长 0.5%，单笔 10%。'),
    )

    expect(ruleConditionKeys(result.canonicalSpec)).not.toEqual(expect.arrayContaining([
      'grid.range_rebalance',
    ]))
    expect(ruleActionTypes(result.canonicalSpec)).not.toEqual(expect.arrayContaining([
      'OPEN_LONG',
      'CLOSE_LONG',
      'OPEN_SHORT',
      'CLOSE_SHORT',
    ]))
    expect(result.canonicalSpec.orderPrograms).toEqual([
      expect.objectContaining({
        kind: 'contract_order_program',
        mode: 'perp_neutral',
        levelSet: expect.objectContaining({
          lower: 60000,
          upper: 80000,
          spacingPct: 0.5,
        }),
        budget: {
          mode: 'per_order_pct_equity',
          value: 10,
        },
      }),
    ])
    expect(result.publishedSnapshot.scriptSnapshot).toEqual(expect.stringContaining('const ORDER_PROGRAMS = [{'))
    expect(result.publishedSnapshot.scriptSnapshot).toEqual(expect.stringContaining('const DECISION_PROGRAMS = [] as const'))
  })

  it.each([
    {
      sessionId: 'official-grid-range-position-publish',
      message: '基于 OKX 模拟盘 BTC-USDT 现货 15m，创建网格区间策略。入场规则：价格位于最近 36 根 K 线区间下 20% 时买入；出场规则：价格回到区间上 55% 或盈利达到 0.45% 时卖出平仓；风控：单次仓位 25%，不使用杠杆，止损 3%。',
      keys: ['price.range_position_lte', 'price.range_position_gte', 'position_loss_pct', 'risk.take_profit_pct'],
      actions: ['OPEN_LONG', 'CLOSE_LONG', 'FORCE_EXIT'],
    },
    {
      sessionId: 'official-rsi-reversal-publish',
      message: '基于 OKX 模拟盘 ETH-USDT 现货 15m，创建 RSI 反转策略。入场规则：RSI14 从 38 下方向上穿回 38 时买入；出场规则：RSI14 高于 64 时卖出平仓；风控：仓位 25%，不使用杠杆，止损 5%，止盈 0.5%。',
      keys: ['rsi.cross_over', 'rsi.threshold_gte', 'position_loss_pct', 'risk.take_profit_pct'],
      actions: ['OPEN_LONG', 'CLOSE_LONG', 'FORCE_EXIT'],
    },
    {
      sessionId: 'official-breakout-tracking-publish',
      message: '基于 OKX 模拟盘 BTC-USDT-SWAP 合约 15m，创建突破追踪策略。入场规则：价格突破最近 24 根 K 线高点且突破缓冲 0.25% 时做多开仓；出场规则：价格跌回最近 12 根 K 线低点时平多；风控：仓位 25%，2 倍杠杆，止损 3%，止盈 0.6%。',
      keys: ['breakout.channel_high_break', 'breakout.channel_low_break', 'position_loss_pct', 'risk.take_profit_pct'],
      actions: ['OPEN_LONG', 'CLOSE_LONG', 'FORCE_EXIT'],
    },
    {
      sessionId: 'official-macd-cross-publish',
      message: '基于 OKX 模拟盘 ETH-USDT-SWAP 合约 15m，创建 MACD 16/34/12 金叉死叉策略。入场规则：MACD DIF 上穿 DEA 时做多开仓；出场规则：MACD DIF 下穿 DEA 时平多；风控：仓位 35%，2 倍杠杆，止损 2%，止盈 0.5%。',
      keys: ['macd.golden_cross', 'macd.death_cross', 'position_loss_pct', 'risk.take_profit_pct'],
      actions: ['OPEN_LONG', 'CLOSE_LONG', 'FORCE_EXIT'],
    },
  ])('publishes $sessionId through atomic semantic generation', async ({ sessionId, message, keys, actions }) => {
    const result = await generateAndPublish(sessionId, buildSemanticStateFromMessage(message))

    expect(ruleConditionKeys(result.canonicalSpec)).toEqual(expect.arrayContaining(keys))
    expect(ruleActionTypes(result.canonicalSpec)).toEqual(expect.arrayContaining(actions))
  })

  it('extracts fixed-range grid wording as contracts instead of manufacturing checklist rules', () => {
    const patch = seedExtractor.extract('BTCUSDT 固定区间 60000-80000，按 1% 网格买入，触达上方网格卖出，仓位 1%，单笔最大亏损 2%。')

    expect(JSON.stringify(patch)).not.toMatch(checklistFieldPattern)
    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'grid.range_rebalance',
        contracts: expect.arrayContaining([
          expect.objectContaining({
            capabilities: expect.arrayContaining([
              expect.objectContaining({
                domain: 'price',
                verb: 'define',
                object: 'level_set',
                shape: expect.objectContaining({
                  mode: 'fixed_range',
                  lower: 60000,
                  upper: 80000,
                  spacingPct: 1,
                  spacingMode: 'arithmetic',
                }),
              }),
            ]),
          }),
        ]),
      }),
    ]))
    expect(patch.position).toEqual(expect.objectContaining({
      mode: 'fixed_ratio',
      value: 0.01,
      positionMode: 'long_only',
      sizing: { kind: 'ratio', value: 0.01, unit: 'ratio' },
      contracts: expect.arrayContaining([
        expect.objectContaining({
          kind: 'position',
          capabilities: expect.arrayContaining([
            expect.objectContaining({
              domain: 'capital',
              verb: 'allocate',
              object: 'position_sizing',
            }),
          ]),
        }),
      ]),
    }))
  })

  it('keeps incomplete MA semantics in semantic clarification instead of checklist fallback', () => {
    const semanticState: SemanticState = {
      version: 1,
      families: ['single-leg'],
      triggers: [
        {
          id: 'entry-ma-open',
          key: 'indicator.above',
          phase: 'entry',
          sideScope: 'long',
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
          ],
        },
      ],
      actions: [{ id: 'action-open-long', key: 'open_long', status: 'locked', source: 'user_explicit' }],
      position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_only', status: 'locked', source: 'user_explicit' },
      risk: [],
      contextSlots: {
        exchange: null,
        symbol: null,
        marketType: null,
        timeframe: null,
      },
      normalizationNotes: [],
      updatedAt: '2026-04-22T00:00:00.000Z',
    }

    expectSemanticArtifactsAreChecklistFree(semanticState)

    const nextOpenSlot = semanticStateFactory.findNextOpenSemanticSlot(semanticState)
    expect(nextOpenSlot).toEqual(expect.objectContaining({
      slotKey: 'reference.period.entry',
    }))
  })

  it('publishes percent-change entry and position-basis exit semantics', async () => {
    const result = await generateAndPublish(
      'percent-change-publish',
      buildSemanticStateFromMessage('BTCUSDT 3m 当前K线收盘价相对上一根K线收盘价下跌 1% 时买入；15m 相对开仓均价上涨 2% 时卖出；5% 止损；10% 仓位。'),
    )

    expect(ruleConditionKeys(result.canonicalSpec)).toEqual(expect.arrayContaining([
      'price.change_pct',
      'position_gain_pct',
      'position_loss_pct',
    ]))
    expect(result.canonicalSpec.dataRequirements.requiredTimeframes).toEqual(expect.arrayContaining(['3m', '15m']))
    expect(ruleActionTypes(result.canonicalSpec)).toEqual(expect.arrayContaining([
      'OPEN_LONG',
      'CLOSE_LONG',
      'FORCE_EXIT',
    ]))
  })

  it('publishes on-start market entry semantics with stop loss', async () => {
    const result = await generateAndPublish(
      'on-start-publish',
      buildSemanticStateFromMessage('立即开始时市价买入一次；1h；BTCUSDT；单笔 10%；亏损 5% 止损。'),
    )

    expect(ruleConditionKeys(result.canonicalSpec)).toEqual(expect.arrayContaining([
      'execution.on_start',
      'position_loss_pct',
    ]))
    expect(ruleActionTypes(result.canonicalSpec)).toEqual(expect.arrayContaining([
      'OPEN_LONG',
      'FORCE_EXIT',
    ]))
  })

  it('guards Task 6 semantic expression mainline from normalized trigger atom backfill', () => {
    const root = findRepoRoot(resolve(__dirname))
    expect(NORMALIZED_TRIGGER_ATOM_KEYS).toEqual([
      'execution.on_start',
      'price.percent_change',
      'price.range_position_lte',
      'price.range_position_gte',
      'price.breakout_up',
      'price.breakout_down',
      'indicator.cross_over',
      'indicator.cross_under',
      'indicator.above',
      'indicator.below',
      'bollinger.touch_upper',
      'bollinger.touch_lower',
      'bollinger.touch_middle',
      'oscillator.rsi_gte',
      'oscillator.rsi_lte',
      'trend.direction',
      'market.regime',
      'volatility.state',
      'grid.range_rebalance',
    ])
    expect(NORMALIZED_TRIGGER_ATOM_KEYS).not.toEqual(expect.arrayContaining([
      'bar.close_gt_open',
      'bar.close_lt_open',
      'candle.green',
    ]))
    expect(NORMALIZED_TRIGGER_ATOM_KEYS.some(key =>
      /(?:^|\.)(?:bar|candle)(?:\.|$)|close.*open|open.*close|green|red/u.test(key),
    )).toBe(false)

    const scanTargets = [
      {
        file: 'apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts',
        className: 'CodegenConversationService',
        methodName: 'buildCanonicalSpecForConversation',
      },
      {
        file: 'apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts',
        className: 'CodegenPublicationGenerationStage',
        methodName: 'generate',
      },
    ]
    for (const target of scanTargets) {
      const source = readFileSync(join(root, target.file), 'utf8')
      const methodBody = extractNamedMethodBody(source, target.className, target.methodName)
      expect(methodBody).not.toBeNull()
      expect(findLegacyAdapterCallsInMethodBody(methodBody ?? '')).toEqual([])
    }

    const legacyAdapterFiles = [
      'apps/quantify/src/modules/llm-strategy-codegen/services/strategy-intent-normalizer.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-normalization.ts',
    ]
    for (const file of legacyAdapterFiles) {
      expect(readFileSync(join(root, file), 'utf8')).toMatch(/legacy adapter/i)
    }
  })

  it('keeps production conversation main path free of legacy checklist authority', () => {
    const productionFiles = [
      'apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/inferred-confirmation-classifier.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/strategy-execution-context.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/codegen-session-publication-pipeline.service.ts',
    ]
    const root = findRepoRoot(resolve(__dirname))
    const forbiddenPatterns = [
      /projectLegacyLogicSnapshotFromSemanticState/u,
      /buildFallbackSemanticState\s*\(/u,
      /buildCanonicalSpecFromLegacyLogicSnapshotForNonSemanticCompatibilityOnly/u,
      /canonicalSpecBuilder\.build\(\s*checklist\b/u,
      /\bsession\s*(?:(?:\?\.)|\.)\s*checklist\b|\bsession\s*(?:\?\.\s*)?\[\s*['"]checklist['"]\s*\]/u,
    ]

    for (const file of productionFiles) {
      const source = readFileSync(join(root, file), 'utf8')
      for (const pattern of forbiddenPatterns) {
        const match = source.match(pattern)
        if (match) {
          const position = typeof match.index === 'number' ? ` at offset ${match.index}` : ''
          throw new Error(`Production legacy authority guard matched ${pattern} in ${file}${position}: ${match[0]}`)
        }
      }
    }
  })
})
