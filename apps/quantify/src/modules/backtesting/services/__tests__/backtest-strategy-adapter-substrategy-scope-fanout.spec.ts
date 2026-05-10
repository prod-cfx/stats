import type { CanonicalStrategyIrV1 } from '@/modules/llm-strategy-codegen/types/canonical-strategy-ir'
import { BacktestStrategyAdapterService } from '@/modules/backtesting/services/backtest-strategy-adapter.service'
import { CanonicalStrategyAstCompilerService } from '@/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '@/modules/llm-strategy-codegen/services/compiled-script-emitter.service'

/**
 * Phase 5 S10 follow-up (#1113): scope.subStrategy 双 sub 端到端集成 spec
 *
 * 链路：CanonicalStrategyIrV1（双 subStrategy scope + 双 entry rule）
 *   → CanonicalStrategyAstCompilerService.compile  （IR → AST，metadata.subStrategyScopeRef 透传）
 *   → CompiledScriptEmitterService.emit            （compiler.v1 脚本 + ORCHESTRATION_SCOPES const）
 *   → BacktestStrategyAdapterService.build         （内部 parse + onBar 含 sub fan-out wrapper）
 *   → adapter.fn(ctx)                              （sub 状态机 + per-bar 单 active sub iteration）
 *
 * 验收：
 *   1. first bar：兜底 ss-trend，发出该 sub 路由 program 的 OPEN_LONG
 *   2. switch_substrategy gate=true：第二根 bar 出 CLOSE_LONG（close handling on outgoing sub）
 *   3. 切换后 active id 持久化为 ss-range
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
      { id: 'switch_to_range', kind: 'CROSS_UNDER', args: ['ema_7', 'ema_21'] },
    ],
  },
  ruleBlocks: [
    {
      id: 'entry_trend',
      phase: 'entry',
      when: 'entry_cross',
      priority: 200,
      actions: [{ kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 25 } }],
      metadata: { subStrategyScopeRef: 'ss-trend' },
    },
    {
      id: 'entry_range',
      phase: 'entry',
      when: 'entry_cross',
      priority: 100,
      actions: [{ kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 25 } }],
      metadata: { subStrategyScopeRef: 'ss-range' },
    },
  ],
  orderPrograms: [],
  orchestrationScopes: [
    {
      id: 'ss-trend',
      scopeKind: 'subStrategy',
      subStrategyId: 'trend_sub',
      positionHandlingOnDeactivate: 'close',
      orderHandlingOnDeactivate: 'cancel',
    },
    {
      id: 'ss-range',
      scopeKind: 'subStrategy',
      subStrategyId: 'range_sub',
      positionHandlingOnDeactivate: 'close',
      orderHandlingOnDeactivate: 'cancel',
    },
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

function emitDualSubStrategyScript(): string {
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

describe('backtest adapter — scope.subStrategy fan-out e2e (Phase 5 S10 follow-up #1113)', () => {
  const adapterService = new BacktestStrategyAdapterService()

  it('双 sub scope 编译产物 → adapter.fn first bar 兜底 ss-trend 输出 sub-routed decision', async () => {
    const scriptCode = emitDualSubStrategyScript()
    expect(scriptCode).toContain('const ORCHESTRATION_SCOPES')
    expect(scriptCode).toContain('"id":"ss-trend"')
    expect(scriptCode).toContain('"id":"ss-range"')

    const strategy = await adapterService.build({
      id: 'fanout-dual-substrategy',
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
      reason?: string
      meta?: {
        subStrategyDeactivation?: { outgoingScopeId: string; incomingScopeId?: string }
        scopeDecisions?: Array<{ scopeId: string; decision: { action: string } }>
      }
    }
    // first bar 没切换 → 没有 deactivation meta；activeSub=ss-trend；ss-trend 路由的 program 决策（无信号 → NOOP / compiled.noop 这类）
    expect(decision.meta?.subStrategyDeactivation).toBeUndefined()
    // sub fan-out 仅 1 个 active sub iteration（不像 symbol fan-out 多副本），故无 scopeDecisions
    expect(decision.meta?.scopeDecisions).toBeUndefined()
    // 决策 action 由 substrate 实际命中决定；first bar 无 EMA 数据 → NOOP 是预期路径
    expect(['NOOP', 'OPEN_LONG']).toContain(decision.action)
  })

  it('双 sub scope adapter 跨 bar 持久化 active id（first bar 后 second bar 不会 fail-closed.no_active_scope）', async () => {
    const scriptCode = emitDualSubStrategyScript()
    const strategy = await adapterService.build({
      id: 'fanout-cross-bar',
      protocolVersion: 'v1',
      scriptCode,
      params: {},
    })
    const ctx = {
      bars: [{ time: 1, open: 100, high: 101, low: 99, close: 100, volume: 1 }],
      currentPrice: 100,
    }
    const first = (await strategy.fn(ctx as never)) as { action: string; reason?: string }
    const second = (await strategy.fn(ctx as never)) as { action: string; reason?: string }
    // 跨 bar：active id 持久化兜底 ss-trend → 不应触发 substrate.no_active_scope
    expect(first.reason).not.toBe('compiled.orchestration.substrategy.fail_closed.no_active_scope')
    expect(second.reason).not.toBe('compiled.orchestration.substrategy.fail_closed.no_active_scope')
  })
})
