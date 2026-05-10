/* eslint-disable ts/no-unsafe-argument */
import type { CompiledScriptProjection } from '@/modules/llm-strategy-codegen/types/compiled-script-projection'
import type { StrategySignalsRuntimeConfig } from '../../types/strategy-signals-config.type'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Logger } from '@nestjs/common'
import { CompiledScriptParserService } from '@/modules/llm-strategy-codegen/services/compiled-script-parser.service'
import { SignalGenerationDecisionStage } from '../signal-generation-decision.stage'
import { SignalGeneratorService } from '../signal-generator.service'

/**
 * Issue #1081 — live programLifecycleState 持久化 + cleanup hook 跨 onBar 集成断言。
 *
 * PR #1077 (S0a) 落地 substrate 时 descope 了 live signal 维护与 cleanup；
 * PR #1105 (S5) 在 signal-generator 落地了：
 *   1) `programLifecycleStateByStrategyInstanceId: Map` 跨 onBar 持续 dynamic_grid /
 *      adaptive_volatility_grid 等 program 的 lifecycle state；
 *   2) `cleanupProgramLifecycleState(strategyInstanceId)` 清理单个实例 entry；
 *   3) constructor 上挂载 `strategy-instance.{stopped,deleted}` 事件监听调用 cleanup；
 *   4) live ctx.bars 由 caller (`signal-generation-decision.stage.ts` 多腿路径 +
 *      `signal-generator.service.ts` snapshot 单腿路径) 从 `multiLegData[primaryLeg.id]
 *      ?.[execution.timeframe]?.bars` populate 后传入 `adapter.onBar(scriptContext)`。
 *
 * 既有 spec（`signal-generator-orchestration-program.spec.ts`）只做源码 regex 断言，未执行
 * 二次 onBar 验证 in-memory map 真实跨调用持续。本 spec 直接驱动 dynamic_grid program 跨两次
 * onBar 调度：
 *   - 首次：anchor=110，map 无 prev → 走 path 7 rebuild，写入 state；
 *   - 第二次：anchor=130 漂移 ≥ threshold + (now-lastBuildAt)<rebuildMinIntervalSec → 命中
 *     `rebuild_throttled` 保留旧 ladder（如果 map 没持续，第二次 prev=undefined 会重新 rebuild
 *     成 130 的新 ladder，断言会立即失败）。这一对断言闭环验证 #1081 验收第 1/3/4 项。
 *
 * 此外覆盖：
 *   - `cleanupProgramLifecycleState` 直接清单条目；
 *   - 真实 `EventEmitter2` 触发 `strategy-instance.{stopped,deleted}` 走 listener 清理路径；
 *   - `SignalGenerationDecisionStage.buildResolvedStrategyContextForMultiLeg` 把
 *     `multiLegData[primaryLeg.id]?.[execution.timeframe]?.bars` 拷到 `scriptContext.bars`
 *     的 caller 端真实路径（issue #1081 验收第 3 项的反向断言）。
 */

const PROGRAM_ID = 'orch_dyn_lifecycle'
const GATE_EXPR_ID = 'expr-gate-long'

const config: StrategySignalsRuntimeConfig = {
  enabled: true,
  cronExpression: '*/5 * * * *',
  cooldownMinutes: 15,
  batchSize: 1,
  maxSymbolsPerStrategy: 1,
  debug: { enabled: false, maxScriptLength: 1000, maxValueLength: 200 },
  ai: {
    maxAttempts: 1,
    temperature: 0.2,
    maxTokens: 100,
    maxFailuresBeforeCooldown: 3,
    failureCooldownMinutes: 30,
    maxRawResponseLength: 1000,
  },
  execution: {
    enabled: false,
    dryRun: true,
    maxAccountsPerSignal: 1,
    defaultQuoteAmount: 10,
    minBalanceThreshold: 10,
    maxRiskFraction: 0.1,
  },
}

function buildDynamicGridProjection(): CompiledScriptProjection {
  // AND-with-empty-deps → values[GATE_EXPR_ID] === true（[].every(...) 为 true）
  // 见 packages/shared/.../evaluate-expr-pool.ts 'AND' 分支。
  return {
    compiledManifest: {
      irVersion: 'csi.v1',
      astVersion: 'csa.v1',
      compileVersion: 'compiler.v1',
      irHash: `sha256:${'0'.repeat(64)}`,
      specHash: `sha256:${'0'.repeat(64)}`,
      astDigest: `sha256:${'0'.repeat(64)}`,
      structuralDigest: `sha256:${'0'.repeat(64)}`,
    },
    executionModel: {} as CompiledScriptProjection['executionModel'],
    dataRequirements: {
      warmupBars: 1,
      maxLookback: 1,
      requiredTimeframes: ['15m'],
    } as CompiledScriptProjection['dataRequirements'],
    exprPool: [
      {
        id: GATE_EXPR_ID,
        nodeType: 'predicate',
        deps: [],
        payload: { kind: 'AND' },
      },
    ] as unknown as CompiledScriptProjection['exprPool'],
    guards: [] as unknown as CompiledScriptProjection['guards'],
    decisionPrograms: [] as unknown as CompiledScriptProjection['decisionPrograms'],
    orderPrograms: [] as unknown as CompiledScriptProjection['orderPrograms'],
    orchestrationPrograms: [
      {
        id: PROGRAM_ID,
        programKind: 'dynamic_grid',
        activeWhenExprId: GATE_EXPR_ID,
        onDeactivate: 'cancel',
        rebuildPolicy: 'anchor_on_state_change',
        dynamicGridParams: {
          anchorLookbackBars: 10,
          anchorSide: 'high',
          anchorDriftPct: 1,
          rebuildMinIntervalSec: 60,
          levelCount: 2,
          step: { mode: 'pct', value: 5 },
        },
        sizing: { mode: 'fixed_quote', value: 100 },
      },
    ] as unknown as CompiledScriptProjection['orchestrationPrograms'],
    topology: {
      exprOrder: [GATE_EXPR_ID],
      guardOrder: [],
      riskPredicateOrder: [],
      decisionOrder: [],
      orderProgramOrder: [],
    } as unknown as CompiledScriptProjection['topology'],
  }
}

function buildBars(
  count: number,
  recipe: (i: number) => { high: number; low: number },
  startTs: number,
): Array<{ open: number; high: number; low: number; close: number; volume: number; timestamp: number }> {
  const bars = []
  for (let i = 0; i < count; i += 1) {
    const r = recipe(i)
    bars.push({
      open: r.high,
      high: r.high,
      low: r.low,
      close: (r.high + r.low) / 2,
      volume: 1,
      timestamp: startTs + i * 60_000,
    })
  }
  return bars
}

describe('signalGeneratorService — program lifecycle 跨 onBar 持续 + cleanup (issue #1081)', () => {
  function createService(eventEmitter: EventEmitter2 = new EventEmitter2()) {
    jest.spyOn(SignalGeneratorService.prototype as any, 'registerCronJob').mockImplementation(() => {})

    const generatorRepository = {
      findRunningInstances: jest.fn().mockResolvedValue([]),
      findSymbolByCode: jest.fn(),
      findSymbolByCodeForMarket: jest.fn(),
      findOpenPositionForRuntimeContext: jest.fn().mockResolvedValue(null),
    }

    const service = new SignalGeneratorService(
      generatorRepository as any,
      { get: jest.fn().mockReturnValue(config) } as any,
      { addCronJob: jest.fn(), deleteCronJob: jest.fn() } as any,
      { chat: jest.fn() } as any,
      { create: jest.fn() } as any,
      { findByStrategyInstanceId: jest.fn(), reset: jest.fn(), incrementFailure: jest.fn() } as any,
      eventEmitter as any,
      { recordGeneration: jest.fn() } as any,
      { getLatestBarBySymbolId: jest.fn(), getRecentBarsBySymbolId: jest.fn() } as any,
      { isProd: jest.fn().mockReturnValue(false) } as any,
      { withTransaction: jest.fn() } as any,
      undefined,
      undefined,
      undefined,
    )
    return { service, eventEmitter }
  }

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('15.D: 第二次 onBar 复用 map 中 prev state，命中 rebuild_throttled 保留旧 ladder', () => {
    jest.spyOn(CompiledScriptParserService.prototype, 'parse').mockReturnValue(buildDynamicGridProjection())

    const { service } = createService()
    const result = (service as any).buildCompiledRuntimeAdapter('compiled-stub', 'instance-1') as {
      adapter: { onBar: (ctx: unknown) => any } | null
      parseError?: unknown
    }
    expect(result.parseError).toBeUndefined()
    expect(result.adapter).not.toBeNull()
    const adapter = result.adapter!

    // 首次 onBar：bars 端点时间戳 = T0 + 9*60s。anchor=110, 无 prev → rebuild。
    const T0 = 1_700_000_000_000
    const firstBars = buildBars(10, () => ({ high: 110, low: 100 }), T0)
    const firstDecision = adapter.onBar({ bars: firstBars } as any)
    const firstOrderState = firstDecision.meta.orderState
    expect(firstOrderState.workingOrders).toHaveLength(1)
    expect(firstOrderState.workingOrders[0].id).toBe(PROGRAM_ID)
    expect(firstOrderState.workingOrders[0].levels).toEqual([104.5, 99.28])
    const firstLifecycle = firstOrderState.programLifecycleStateNext[PROGRAM_ID]
    expect(firstLifecycle).toMatchObject({
      kind: 'dynamic_grid',
      lastBuildAnchor: 110,
      lastBuildAt: T0 + 9 * 60_000,
    })

    // 验证 service-level map 真实写入 instance-1 entry。
    const stateMap = (service as any).programLifecycleStateByStrategyInstanceId as Map<string, unknown>
    expect(stateMap.has('instance-1')).toBe(true)
    expect(stateMap.get('instance-1')).toBe(firstOrderState.programLifecycleStateNext)

    // 第二次 onBar：bars 端点 ts = lastBuildAt + 30s，anchor=130 漂移 18%。
    // 若 map 没持续 prev → runtime 视作首次，会 rebuild 成 [123.5, 117.32]。
    // 当前 map 持续 prev → 漂移达标但 (now - lastBuildAt)<60s → throttled 保留 [104.5, 99.28]。
    const secondStart = T0 + 30_000
    const secondBars = buildBars(10, () => ({ high: 130, low: 100 }), secondStart)
    const secondDecision = adapter.onBar({ bars: secondBars } as any)
    const secondOrderState = secondDecision.meta.orderState
    expect(secondOrderState.workingOrders).toHaveLength(1)
    expect(secondOrderState.workingOrders[0].levels).toEqual([104.5, 99.28])
    // 透传 prev：lastBuildAnchor / lastBuildAt 不变。
    expect(secondOrderState.programLifecycleStateNext[PROGRAM_ID]).toMatchObject({
      kind: 'dynamic_grid',
      lastBuildAnchor: 110,
      lastBuildAt: T0 + 9 * 60_000,
    })
  })

  it('15.E: cleanupProgramLifecycleState 直接清除指定实例 entry，独立于其它实例', () => {
    jest.spyOn(CompiledScriptParserService.prototype, 'parse').mockReturnValue(buildDynamicGridProjection())

    const { service } = createService()
    const adapterA = (service as any).buildCompiledRuntimeAdapter('compiled-stub', 'instance-A').adapter
    const adapterB = (service as any).buildCompiledRuntimeAdapter('compiled-stub', 'instance-B').adapter

    const T0 = 1_700_000_000_000
    const bars = buildBars(10, () => ({ high: 110, low: 100 }), T0)
    adapterA.onBar({ bars } as any)
    adapterB.onBar({ bars } as any)

    const stateMap = (service as any).programLifecycleStateByStrategyInstanceId as Map<string, unknown>
    expect(stateMap.has('instance-A')).toBe(true)
    expect(stateMap.has('instance-B')).toBe(true)

    service.cleanupProgramLifecycleState('instance-A')
    expect(stateMap.has('instance-A')).toBe(false)
    expect(stateMap.has('instance-B')).toBe(true)
  })

  it('15.F: EventEmitter2 触发 strategy-instance.{stopped,deleted} 走 listener 清理路径', () => {
    jest.spyOn(CompiledScriptParserService.prototype, 'parse').mockReturnValue(buildDynamicGridProjection())

    const eventEmitter = new EventEmitter2()
    const { service } = createService(eventEmitter)
    const adapterStop = (service as any).buildCompiledRuntimeAdapter('compiled-stub', 'instance-stop').adapter
    const adapterDel = (service as any).buildCompiledRuntimeAdapter('compiled-stub', 'instance-del').adapter

    const T0 = 1_700_000_000_000
    const bars = buildBars(10, () => ({ high: 110, low: 100 }), T0)
    adapterStop.onBar({ bars } as any)
    adapterDel.onBar({ bars } as any)

    const stateMap = (service as any).programLifecycleStateByStrategyInstanceId as Map<string, unknown>
    expect(stateMap.has('instance-stop')).toBe(true)
    expect(stateMap.has('instance-del')).toBe(true)

    eventEmitter.emit('strategy-instance.stopped', { strategyInstanceId: 'instance-stop' })
    expect(stateMap.has('instance-stop')).toBe(false)
    expect(stateMap.has('instance-del')).toBe(true)

    eventEmitter.emit('strategy-instance.deleted', { strategyInstanceId: 'instance-del' })
    expect(stateMap.has('instance-del')).toBe(false)
  })

  it('15.G: dynamic_grid evaluator 端 ctx.bars 消费 smoke — 缺 bars → cancel；有 bars → workingOrders 反映 anchor', () => {
    // evaluator 端 smoke：直接给 adapter 喂 ctx.bars，验证 dynamic_grid 真在读 ctx.bars。
    // 注意：本 case 不覆盖 caller (signal-generation-decision.stage.ts) 的 multiLegData → scriptContext.bars
    // 拷贝路径 — 那一段由 15.H 闭环。
    jest.spyOn(CompiledScriptParserService.prototype, 'parse').mockReturnValue(buildDynamicGridProjection())

    const { service } = createService()
    const adapter = (service as any).buildCompiledRuntimeAdapter('compiled-stub', 'instance-bars').adapter

    // 缺 bars → cancel
    const decisionEmpty = adapter.onBar({ bars: [] } as any)
    expect(decisionEmpty.meta.orderState.cancelledProgramIds).toContain(PROGRAM_ID)
    expect(decisionEmpty.meta.orderState.workingOrders).toHaveLength(0)

    // 有 bars → rebuild
    const T0 = 1_700_000_000_000
    const decisionWith = adapter.onBar({ bars: buildBars(10, () => ({ high: 200, low: 180 }), T0) } as any)
    expect(decisionWith.meta.orderState.workingOrders).toHaveLength(1)
    expect(decisionWith.meta.orderState.workingOrders[0].levels[0]).toBeCloseTo(190, 2) // 200*0.95
  })

  it('15.H: caller (SignalGenerationDecisionStage) 把 multiLegData[primaryLeg.id]?.[execution.timeframe]?.bars 拷到 scriptContext.bars', () => {
    // 直接驱动 SignalGenerationDecisionStage.buildResolvedStrategyContextForMultiLeg —
    // 这是 live 多腿路径上 signal-generator.service.ts:2472 调用前真正构建 ctx.bars 的入口。
    // 若有人在该方法里删了 multiLegData → bars 拷贝（issue #1081 验收第 3 项的 caller 端），
    // 本 case 立刻断言失败。
    const stage = new SignalGenerationDecisionStage(
      { chat: jest.fn() } as any,
      new Logger('test'),
    )

    const T0 = 1_700_000_000_000
    const primaryBars = buildBars(5, () => ({ high: 110, low: 100 }), T0)
    const multiLegData = {
      'leg-primary': {
        '15m': {
          bars: primaryBars,
          indicators: { rsi: 50 },
          currentPrice: 105,
        },
      },
    }
    const scriptContext = {
      symbol: 'BTCUSDT',
      timeframe: '15m',
      indicators: {},
      currentPrice: 0,
      timestamp: T0 + 5 * 60_000,
      params: { foo: 'bar' },
      bars: [], // caller 入参可能是空，buildResolvedStrategyContextForMultiLeg 需用 multiLegData 覆盖
    }

    const resolved = stage.buildResolvedStrategyContextForMultiLeg(
      { promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE' } as any,
      { timeframe: '15m' } as any,
      { id: 'leg-primary', symbol: 'BTCUSDT' } as any,
      multiLegData as any,
      scriptContext as any,
    )

    // 闭环断言：scriptContext.bars 取自 multiLegData[primaryLeg.id][execution.timeframe].bars
    expect((resolved as any).bars).toBe(primaryBars)
    expect((resolved as any).symbol).toBe('BTCUSDT')
    expect((resolved as any).timeframe).toBe('15m')
    expect((resolved as any).currentPrice).toBe(105)

    // 反向：缺 multiLegData primary 数据 → 不覆盖，返回原 scriptContext（fallback 路径）
    const fallback = stage.buildResolvedStrategyContextForMultiLeg(
      { promptTemplate: 'AI_CODEGEN_PUBLISHED_TEMPLATE' } as any,
      { timeframe: '15m' } as any,
      { id: 'leg-primary', symbol: 'BTCUSDT' } as any,
      {} as any,
      scriptContext as any,
    )
    expect(fallback).toBe(scriptContext)
  })
})
