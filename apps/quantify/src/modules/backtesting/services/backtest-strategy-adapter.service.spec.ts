import type { CanonicalStrategyIrV1 } from '@/modules/llm-strategy-codegen/types/canonical-strategy-ir'
import type { DomainException } from '@/common/exceptions/domain.exception'
import { CanonicalStrategyAstCompilerService } from '@/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service'
import { CompiledScriptEmitterService } from '@/modules/llm-strategy-codegen/services/compiled-script-emitter.service'
import { BacktestStrategyAdapterService } from './backtest-strategy-adapter.service'

describe('backtestStrategyAdapterService', () => {
  const service = new BacktestStrategyAdapterService()

  it('builds runner strategy fn from valid StrategyAdapterV1 script', async () => {
    const strategy = await service.build({
      id: 's1',
      protocolVersion: 'v1',
      scriptCode: `const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar() {
    return { action: 'NOOP' }
  },
}
strategy`,
      params: { risk: 0.1 },
    })

    expect(strategy.id).toBe('s1')
    expect(strategy.params).toEqual({ risk: 0.1 })
    await expect(strategy.fn({} as any)).resolves.toEqual({ action: 'NOOP' })
  })

  it('builds runner strategy fn from generated compiled script', async () => {
    const strategy = await service.build({
      id: 'compiled-s1',
      protocolVersion: 'v1',
      scriptCode: createCompiledScriptFixture(),
      params: { positionPct: 25 },
    })

    await expect(strategy.fn({
      bars: [
        { time: 1, open: 100, high: 101, low: 99, close: 100 },
      ],
      currentPrice: 100,
    } as any)).resolves.toMatchObject({
      action: 'NOOP',
      reason: 'compiled.noop',
      meta: expect.objectContaining({
        compiled: true,
      }),
    })
  })

  it('fails when protocolVersion is not v1', async () => {
    await expect(service.build({
      id: 's1',
      protocolVersion: 'v2' as any,
      scriptCode: 'const strategy = { protocolVersion: "v1", onBar: () => ({ action: "NOOP" }) }\nstrategy',
      params: {},
    })).rejects.toMatchObject({
      message: 'backtest.strategy_protocol_invalid',
    } as Partial<DomainException>)
  })

  it('fails when scriptCode is empty', async () => {
    await expect(service.build({
      id: 's1',
      protocolVersion: 'v1',
      scriptCode: '   ',
      params: {},
    })).rejects.toMatchObject({
      message: 'backtest.strategy_script_invalid',
    } as Partial<DomainException>)
  })

  it('fails when script TypeScript compile fails', async () => {
    await expect(service.build({
      id: 's1',
      protocolVersion: 'v1',
      scriptCode: `const strategy: StrategyAdapterV1 = {
  protocolVersion: 'v1',
  onBar() {
    return { action: 'OPEN_LONG' }
  },
}
strategy(`,
      params: {},
    })).rejects.toMatchObject({
      message: 'backtest.strategy_compile_failed',
    } as Partial<DomainException>)
  })

  it('fails when script export is not StrategyAdapterV1', async () => {
    await expect(service.build({
      id: 's1',
      protocolVersion: 'v1',
      scriptCode: '({ invalid: true })',
      params: {},
    })).rejects.toMatchObject({
      message: 'backtest.strategy_adapter_invalid',
    } as Partial<DomainException>)
  })

  it('fails when script executes with runtime error', async () => {
    await expect(service.build({
      id: 's1',
      protocolVersion: 'v1',
      scriptCode: 'throw new Error("boom")',
      params: {},
    })).rejects.toMatchObject({
      message: 'backtest.strategy_execute_failed',
    } as Partial<DomainException>)
  })
})

function createCompiledScriptFixture(): string {
  const compiler = new CanonicalStrategyAstCompilerService()
  const emitter = new CompiledScriptEmitterService()
  const ir: CanonicalStrategyIrV1 = {
    irVersion: 'csi.v1',
    source: {
      graphVersion: 18,
      graphDigest: `sha256:${'5'.repeat(64)}`,
      specHash: `sha256:${'6'.repeat(64)}`,
    },
    market: {
      venue: 'binance',
      instrumentType: 'spot',
      symbol: 'BTCUSDT',
      timeframes: ['1h'],
      priceFeed: 'close',
    },
    portfolio: {
      positionMode: 'long_only',
      sizing: { mode: 'pct_equity', value: 25 },
      maxConcurrentPositions: 1,
      allowPyramiding: false,
      maxPyramidingLayers: 1,
    },
    dataRequirements: {
      warmupBars: 21,
      maxLookback: 21,
      requiredTimeframes: ['1h'],
    },
    signalCatalog: {
      series: [
        { id: 'close_1h', kind: 'PRICE', timeframe: '1h', field: 'close' },
        { id: 'ema_7', kind: 'EMA', inputs: ['close_1h'], params: { period: 7 } },
        { id: 'ema_21', kind: 'EMA', inputs: ['close_1h'], params: { period: 21 } },
      ],
      levelSets: [],
      predicates: [
        { id: 'entry_cross', kind: 'CROSS_OVER', args: ['ema_7', 'ema_21'] },
        { id: 'exit_cross', kind: 'CROSS_UNDER', args: ['ema_7', 'ema_21'] },
      ],
    },
    ruleBlocks: [
      {
        id: 'entry_long',
        phase: 'entry',
        when: 'entry_cross',
        priority: 200,
        actions: [
          { kind: 'OPEN_LONG', quantity: { mode: 'pct_equity', value: 25 } },
        ],
      },
      {
        id: 'exit_long',
        phase: 'exit',
        when: 'exit_cross',
        priority: 100,
        actions: [
          { kind: 'CLOSE_LONG', quantity: { mode: 'position_pct', value: 100 } },
        ],
      },
    ],
    orderPrograms: [],
    riskPolicy: {
      guards: [
        { id: 'stop_loss_4', kind: 'STOP_LOSS_PCT', scope: 'position', value: 4, onBreach: 'FORCE_EXIT' },
      ],
    },
    executionPolicy: {
      signalEvaluation: 'bar_close',
      fillPolicy: 'next_bar_open',
      timeframeAlignment: 'strict',
      orderTypeDefault: 'market',
      timeInForce: 'gtc',
      allowPartialFill: false,
    },
  }

  return emitter.emit({
    ast: compiler.compile(ir),
    executionEnvelope: {
      positionMode: 'long_only',
      marginMode: 'cash',
      tickSize: 0.01,
      pricePrecision: 2,
      quantityPrecision: 6,
      fillAssumption: 'strict',
    },
  })
}
