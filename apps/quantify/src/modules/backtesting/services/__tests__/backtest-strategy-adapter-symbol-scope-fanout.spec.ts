import type { CanonicalStrategyIrV1 } from '@/modules/llm-strategy-codegen/types/canonical-strategy-ir'
import { BacktestStrategyAdapterService } from '@/modules/backtesting/services/backtest-strategy-adapter.service'
import { CanonicalStrategyAstCompilerService } from '@/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '@/modules/llm-strategy-codegen/services/compiled-script-emitter.service'

/**
 * Phase 5 S2 follow-up (#1108): scope.symbol 双 scope 端到端集成 spec
 *
 * 链路：CanonicalStrategyIrV1（双 symbol scope + 双 entry rule）
 *   → CanonicalStrategyAstCompilerService.compile  （IR → AST，metadata.symbolScopeRef 透传）
 *   → CompiledScriptEmitterService.emit            （compiler.v1 脚本 + ORCHESTRATION_SCOPES const）
 *   → BacktestStrategyAdapterService.build         （内部 parse + onBar 含 fan-out wrapper）
 *   → adapter.fn(ctx)                              （fan-out 循环 2 个 symbol scope）
 *
 * 验收：双 scope 单次 onBar 调用产 meta.scopeDecisions 携带 2 条 per-scope 副本
 */

const SHA0 = `sha256:${'a'.repeat(64)}` as const

const baseIr = (): CanonicalStrategyIrV1 => ({
  irVersion: 'csi.v1',
  source: { graphVersion: 1, graphDigest: SHA0, specHash: SHA0 },
  market: { venue: 'binance', instrumentType: 'spot', symbol: 'BTCUSDT', timeframes: ['1h'], priceFeed: 'close' },
  portfolio: {
    positionMode: 'long_only',
    sizing: { mode: 'pct_equity', value: 25 },
    maxConcurrentPositions: 1,
    allowPyramiding: false,
    maxPyramidingLayers: 1,
  },
  dataRequirements: { warmupBars: 21, maxLookback: 21, requiredTimeframes: ['1h'] },
  signalCatalog: {
    series: [
      { id: 'close_1h', kind: 'PRICE', timeframe: '1h', field: 'close' },
      { id: 'ema_7', kind: 'EMA', inputs: ['close_1h'], params: { period: 7 } },
      { id: 'ema_21', kind: 'EMA', inputs: ['close_1h'], params: { period: 21 } },
    ],
    levelSets: [],
    predicates: [
      { id: 'entry_cross', kind: 'CROSS_OVER', args: ['ema_7', 'ema_21'] },
    ],
  },
  ruleBlocks: [
    {
      id: 'entry_btc',
      phase: 'entry',
      when: 'entry_cross',
      priority: 200,
      actions: [{ kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 25 } }],
      metadata: { symbolScopeRef: 's-btc' },
    },
    {
      id: 'entry_eth',
      phase: 'entry',
      when: 'entry_cross',
      priority: 100,
      actions: [{ kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 25 } }],
      metadata: { symbolScopeRef: 's-eth' },
    },
  ],
  orderPrograms: [],
  orchestrationScopes: [
    { id: 's-btc', scopeKind: 'symbol', symbols: ['BTCUSDT'], primarySymbol: 'BTCUSDT' },
    { id: 's-eth', scopeKind: 'symbol', symbols: ['ETHUSDT'], primarySymbol: 'ETHUSDT' },
  ],
  riskPolicy: { guards: [] },
  executionPolicy: {
    signalEvaluation: 'bar_close',
    fillPolicy: 'next_bar_open',
    timeframeAlignment: 'strict',
    orderTypeDefault: 'market',
    timeInForce: 'gtc',
    allowPartialFill: false,
  },
})

function emitDualScopeScript(): string {
  const compiler = new CanonicalStrategyAstCompilerService()
  const emitter = new CompiledScriptEmitterService()
  return emitter.emit({
    ast: compiler.compile(baseIr()),
    executionEnvelope: {
      positionMode: 'long_only',
      marginMode: 'cash',
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 4,
      fillAssumption: 'strict',
    },
  })
}

describe('backtest adapter — scope.symbol fan-out e2e (Phase 5 S2 follow-up #1108)', () => {
  const adapterService = new BacktestStrategyAdapterService()

  it('双 symbol scope 编译产物 → adapter.fn 单次调用产 meta.scopeDecisions 双副本', async () => {
    const scriptCode = emitDualScopeScript()
    expect(scriptCode).toContain('const ORCHESTRATION_SCOPES')

    const strategy = await adapterService.build({
      id: 'fanout-dual-scope',
      protocolVersion: 'v1',
      scriptCode,
      params: {},
    })
    const ctx = {
      bars: [{ time: 1, open: 100, high: 101, low: 99, close: 100, volume: 1 }],
      currentPrice: 100,
    }
    const decision = (await strategy.fn(ctx as never)) as {
      action: string
      meta?: { scopeDecisions?: Array<{ scopeId: string; decision: { action: string } }>; activeSymbolScopeId?: string }
    }
    expect(decision.meta).toBeDefined()
    expect(decision.meta!.scopeDecisions).toBeDefined()
    expect(decision.meta!.scopeDecisions!.length).toBe(2)
    expect(decision.meta!.scopeDecisions!.map(e => e.scopeId)).toEqual(['s-btc', 's-eth'])
    // 双 scope 接收同份 ctx → 决策应一致（同份 bar 数据下两侧 program ref 命中等价）
    const actions = decision.meta!.scopeDecisions!.map(e => e.decision.action)
    expect(actions[0]).toBe(actions[1])
  })
})
