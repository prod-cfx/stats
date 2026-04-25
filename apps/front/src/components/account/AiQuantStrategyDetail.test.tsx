/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AiQuantStrategyDetail } from './AiQuantStrategyDetail'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

describe('AiQuantStrategyDetail', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('shows truthful source, audit, rule summary, and OKX fee currency on detail page', async () => {
    await act(async () => {
      root.render(
        <AiQuantStrategyDetail
          lng="zh"
          strategy={{
            id: 'inst-okx-1',
            name: '在 OKX 现货 DOGEUSD',
            status: 'running',
            exchange: 'okx',
            symbol: 'DOGEUSDT',
            marketType: 'spot',
            timeframe: '1h',
            positionPct: 10,
            initialCapital: 10000,
            metrics: { returnPct: -0.03, maxDrawdownPct: 0.03, winRatePct: 0, tradeCount: 1 },
            equitySeries: [],
            timeline: [],
            runtimeExecutionStates: [{
              executionSemanticKey: 'on_start.entry.primary',
              status: 'consumed',
              failureFamily: null,
              failureReason: null,
              failureCode: null,
              lastAttemptAt: '2026-04-24T14:45:01.824Z',
              consumedAt: '2026-04-24T14:45:01.824Z',
              cooldownUntil: null,
              publishedSnapshotId: 'snapshot-okx-1',
              snapshotHash: 'hash-okx-1',
            }],
            paramSchema: null,
            paramValues: null,
            schemaVersion: null,
            supportsDynamicParams: false,
            publishedSnapshotId: 'snapshot-okx-1',
            snapshotHash: 'hash-okx-1',
            snapshotBacktestConfigDefaults: {
              initialCash: 10000,
              leverage: 1,
              slippageBps: 8,
              feeBps: 4,
              priceSource: 'close',
              allowPartial: false,
              stateTimeframes: ['1h'],
            },
            accountOverview: {
              initialBalance: 50615.55,
              totalEquity: 50600.11,
              availableBalance: 45571.38,
              totalPnl: -15.44,
              todayPnl: -15.44,
              baseCurrency: 'USDT',
            },
            positionOverview: {
              openPositionsCount: 0,
              closedPositionsCount: 1,
              totalRealizedPnl: 0,
              totalUnrealizedPnl: 0,
            },
            latestOrders: [
              {
                executedAt: '2026-04-24 15:00',
                side: 'SELL',
                semanticAction: '卖出',
                semanticRole: 'exit',
                symbol: 'DOGEUSDT',
                price: 0.0979498171758591,
                quantity: 51497.435487,
                fee: 0,
                feeCurrency: null,
                orderId: 'sync-close-1777042803366',
              },
              {
                executedAt: '2026-04-24 14:45',
                side: 'BUY',
                semanticAction: '买入',
                semanticRole: 'entry',
                symbol: 'DOGEUSDT',
                price: 0.0979498171758591,
                quantity: 51497.435487,
                fee: 51.737672883,
                feeCurrency: 'DOGE',
                orderId: '3507763615427895296',
              },
            ],
            runtimeSemanticSummary: {
              serviceStatusLabel: '运行中',
              positionStatusLabel: '空仓',
              cycleStatusLabel: '本轮已完成',
              headline: '运行中 · 空仓 · 本轮已完成',
              explanation: '本轮现货交易已完成，当前未持有 DOGEUSDT。策略服务仍在运行，等待下一次入场条件。',
              nextExpectedAction: '等待下一次入场条件',
              marketType: 'spot',
              positionState: 'flat',
              cycleState: 'completed',
              evidence: {
                openPositionsCount: 0,
                latestEntryOrderId: '3507763615427895296',
                latestExitOrderId: 'sync-close-1777042803366',
                latestSyncOrderId: 'sync-close-1777042803366',
                entryOrders: [{ orderId: '3507763615427895296', executedAt: '2026-04-24 14:45' }],
                exitOrders: [{ orderId: 'sync-close-1777042803366', executedAt: '2026-04-24 15:00' }],
                syncOrders: [{ orderId: 'sync-close-1777042803366', executedAt: '2026-04-24 15:00' }],
                latestEntryAt: '2026-04-24 14:45',
                latestExitAt: '2026-04-24 15:00',
                latestSemanticAction: '卖出',
              },
            },
            ruleSummary: {
              rules: [{
                id: 'entry',
                phase: 'entry',
                conditionKey: 'execution.on_start',
                operator: null,
                value: null,
                actions: ['OPEN_LONG'],
              }, {
                id: 'exit',
                phase: 'exit',
                conditionKey: 'price.change_pct',
                operator: 'GTE',
                value: 0.05,
                actions: ['CLOSE_LONG'],
              }],
            },
            updatedAt: '2026-04-24T14:45:00.000Z',
          }}
        />,
      )
    })

    expect(container.textContent).toContain('在 OKX 现货 DOGEUSD')
    expect(container.textContent).toContain('OKX / DOGEUSDT / 1h')
    expect(container.textContent).toContain('运行中 · 空仓 · 本轮已完成')
    expect(container.textContent).toContain('本轮现货交易已完成，当前未持有 DOGEUSDT')
    expect(container.textContent).toContain('当前状态解释')
    expect(container.textContent).toContain('最近入场：2026-04-24 14:45 / 3507763615427895296')
    expect(container.textContent).toContain('最近出场：2026-04-24 15:00 / sync-close-1777042803366')
    expect(container.textContent).toContain('发布快照规则摘要')
    expect(container.textContent).toContain('启动时执行：OPEN_LONG')
    expect(container.textContent).toContain('价格变化 GTE 5%：CLOSE_LONG')
    expect(container.textContent).toContain('本地账户台账 + 最新行情估值')
    expect(container.textContent).toContain('手续费优先展示 OKX 原始 fee / feeCcy')
    expect(container.textContent).toContain('0.09794982')
    expect(container.textContent).not.toContain('0.10')
    expect(container.textContent).toContain('51.73767288 DOGE')
    expect(container.textContent).toContain('--（同步记录未含手续费）')
    expect(container.textContent).not.toContain('运行回测')
    expect(container.textContent).not.toContain('回测中')
    expect(container.textContent).not.toContain('回测杠杆')
    expect(container.textContent).toContain('当前持币')
    expect(container.textContent).toContain('已完成买卖轮次')
    expect(container.textContent).not.toContain('当前持仓数')
    expect(container.textContent).not.toContain('已平仓数')
    expect(container.textContent).toContain('真实性审计')
    expect(container.textContent).toContain('3507763615427895296')
    expect(container.textContent).toContain('出场订单证据')
    expect(container.textContent).toContain('sync-close-1777042803366')
    expect(container.textContent).toContain('高级运行诊断')
    expect(container.textContent).toContain('已执行 1 个运行诊断项，待执行/冷却/失败 0 个')
  })

  it('shows compatibility warning, leverage drift, and leverage-only update controls from truthful execution data', async () => {
    await act(async () => {
      root.render(
        <AiQuantStrategyDetail
          lng="zh"
        strategy={{
          id: 'inst-1',
          name: 'Execution truth strategy',
          status: 'running',
          exchange: 'okx',
          symbol: 'BTC-USDT-SWAP',
          timeframe: '15m',
          positionPct: 10,
          initialCapital: 10000,
          metrics: { returnPct: 12, maxDrawdownPct: 6, winRatePct: 51, tradeCount: 22 },
          equitySeries: [],
          timeline: [],
          paramSchema: null,
          paramValues: null,
          schemaVersion: null,
          supportsDynamicParams: false,
          publishedSnapshotId: 'snapshot-1',
          snapshotHash: 'hash-1',
          snapshotBacktestConfigDefaults: {
            initialCash: 10000,
            leverage: 2,
            slippageBps: 8,
            feeBps: 4,
            priceSource: 'close',
            allowPartial: false,
          },
          deploymentExecutionBaseline: {
            leverage: 2,
            priceSource: 'mark',
            orderType: 'market',
            timeInForce: 'IOC',
          },
          deploymentExecutionCurrent: {
            leverage: 4,
            priceSource: 'mark',
            orderType: 'market',
            timeInForce: 'IOC',
          },
          executionConfigVersion: 2,
          deploymentLeverageRange: {
            min: 1,
            max: 5,
          },
          deploymentConstraintExplanation: '交易所支持 10x，但平台风控和策略区间最终只允许 1-5x。',
          compatibilityMetadata: {
            isLegacySnapshot: true,
            missingBacktestConfigDefaults: true,
            missingDeploymentExecutionDefaults: false,
            missingDeploymentExecutionConstraints: false,
            requiresRepublishForBacktest: true,
            requiresRepublishForDeploy: false,
          },
          consistencySummary: {
            isConsistent: false,
            driftReasons: ['leverage drift'],
          },
          canEditDeploymentLeverage: true,
        }}
        onUpdateLeverage={() => {}}
      />,
      )
    })

    expect(container.textContent).toContain('需要重新发布')
    expect(container.textContent).toContain('当前执行杠杆')
    expect(container.textContent).toContain('4x')
    expect(container.textContent).toContain('基线执行杠杆')
    expect(container.textContent).toContain('允许杠杆范围')
    expect(container.textContent).toContain('1x - 5x')
    expect(container.textContent).toContain('leverage drift')
    expect(container.textContent).not.toContain('运行回测')
    expect(Array.from(container.querySelectorAll('button')).some(button => button.textContent?.includes('更新杠杆'))).toBe(true)
  })

  it('hides deployment leverage semantics for spot strategies', async () => {
    await act(async () => {
      root.render(
        <AiQuantStrategyDetail
          lng="zh"
          strategy={{
            id: 'inst-spot-1',
            name: 'Spot execution truth strategy',
            status: 'running',
            exchange: 'okx',
            symbol: 'ETHUSDT',
            timeframe: '15m',
            positionPct: 10,
            initialCapital: 10000,
            metrics: { returnPct: 12, maxDrawdownPct: 6, winRatePct: 51, tradeCount: 22 },
            equitySeries: [],
            timeline: [],
            paramSchema: null,
            paramValues: null,
            schemaVersion: null,
            supportsDynamicParams: false,
            publishedSnapshotId: 'snapshot-spot-1',
            snapshotHash: 'hash-spot-1',
            deploymentExecutionBaseline: {
              leverage: null,
              priceSource: 'close',
              orderType: 'market',
              timeInForce: 'gtc',
            },
            deploymentExecutionCurrent: {
              leverage: null,
              priceSource: 'close',
              orderType: 'market',
              timeInForce: 'gtc',
            },
            deploymentLeverageRange: null,
            deploymentConstraintExplanation: null,
            compatibilityMetadata: {
              isLegacySnapshot: false,
              missingBacktestConfigDefaults: false,
              missingDeploymentExecutionDefaults: false,
              missingDeploymentExecutionConstraints: false,
              requiresRepublishForBacktest: false,
              requiresRepublishForDeploy: false,
            },
            consistencySummary: {
              isConsistent: true,
              driftReasons: [],
            },
            canEditDeploymentLeverage: false,
          }}
        />,
      )
    })

    expect(container.textContent).not.toContain('基线执行杠杆')
    expect(container.textContent).not.toContain('当前执行杠杆')
    expect(container.textContent).not.toContain('允许杠杆范围')
    expect(Array.from(container.querySelectorAll('button')).some(button => button.textContent?.includes('更新杠杆'))).toBe(false)
    expect(container.textContent).toContain('价格来源')
  })

  it('renders runtime execution states with user-visible status, reason, and attempt timestamps', async () => {
    await act(async () => {
      root.render(
        <AiQuantStrategyDetail
          lng="zh"
          strategy={{
            id: 'inst-runtime-1',
            name: 'Runtime state strategy',
            status: 'running',
            exchange: 'okx',
            symbol: 'BTC-USDT-SWAP',
            timeframe: '15m',
            positionPct: 10,
            initialCapital: 10000,
            metrics: { returnPct: 12, maxDrawdownPct: 6, winRatePct: 51, tradeCount: 22 },
            equitySeries: [],
            timeline: [],
            paramSchema: null,
            paramValues: null,
            schemaVersion: null,
            supportsDynamicParams: false,
            runtimeExecutionStates: [
              {
                executionSemanticKey: 'on_start.entry.primary',
                status: 'failed',
                failureFamily: 'execution',
                failureReason: 'SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL',
                failureCode: 'SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL',
                lastAttemptAt: '2026-03-20 10:03',
                consumedAt: null,
                cooldownUntil: null,
                publishedSnapshotId: 'snapshot-1',
                snapshotHash: 'hash-1',
              },
              {
                executionSemanticKey: 'on_start.exit.primary',
                status: 'consumed',
                failureFamily: null,
                failureReason: null,
                failureCode: null,
                lastAttemptAt: '2026-03-20 10:08',
                consumedAt: '2026-03-20 10:08',
                cooldownUntil: null,
                publishedSnapshotId: 'snapshot-1',
                snapshotHash: 'hash-1',
              },
            ],
          }}
        />,
      )
    })

    expect(container.textContent).toContain('高级运行诊断')
    expect(container.textContent).toContain('on_start.entry.primary')
    expect(container.textContent).toContain('失败')
    expect(container.textContent).toContain('最近尝试')
    expect(container.textContent).toContain('2026-03-20 10:03')
    expect(container.textContent).toContain('失败分类')
    expect(container.textContent).toContain('执行')
    expect(container.textContent).toContain('未生成可执行信号')
    expect(container.textContent).toContain('on_start.exit.primary')
    expect(container.textContent).toContain('已执行')
    expect(container.textContent).toContain('已执行时间')
    expect(container.textContent).toContain('2026-03-20 10:08')
  })

  it('renders binding and activation runtime failures with precise user-facing labels', async () => {
    await act(async () => {
      root.render(
        <AiQuantStrategyDetail
          lng="zh"
          strategy={{
            id: 'inst-runtime-2',
            name: 'Runtime state strategy',
            status: 'running',
            exchange: 'okx',
            symbol: 'BTC-USDT-SWAP',
            timeframe: '15m',
            positionPct: 10,
            initialCapital: 10000,
            metrics: { returnPct: 12, maxDrawdownPct: 6, winRatePct: 51, tradeCount: 22 },
            equitySeries: [],
            timeline: [],
            paramSchema: null,
            paramValues: null,
            schemaVersion: null,
            supportsDynamicParams: false,
            runtimeExecutionStates: [
              {
                executionSemanticKey: 'on_start.entry.binding',
                status: 'failed',
                failureFamily: 'binding',
                failureReason: 'SYMBOL_NOT_FOUND',
                failureCode: 'SYMBOL_NOT_FOUND',
                lastAttemptAt: null,
                consumedAt: null,
                cooldownUntil: null,
                publishedSnapshotId: 'snapshot-1',
                snapshotHash: 'hash-1',
              },
              {
                executionSemanticKey: 'on_start.entry.activation',
                status: 'cooldown',
                failureFamily: 'activation',
                failureReason: 'SNAPSHOT_REFERENCE_BAR_MISSING',
                failureCode: 'SNAPSHOT_REFERENCE_BAR_MISSING',
                lastAttemptAt: null,
                consumedAt: null,
                cooldownUntil: null,
                publishedSnapshotId: 'snapshot-1',
                snapshotHash: 'hash-1',
              },
            ],
          }}
        />,
      )
    })

    expect(container.textContent).toContain('部署绑定异常，请重新发布并重新部署')
    expect(container.textContent).toContain('绑定')
    expect(container.textContent).toContain('当前执行条件未满足（缺少参考K线）')
    expect(container.textContent).toContain('激活')
  })

  it('keeps runtime execution state section hidden for legacy or unbound strategies with no states', async () => {
    await act(async () => {
      root.render(
        <AiQuantStrategyDetail
          lng="zh"
          strategy={{
            id: 'inst-runtime-empty',
            name: 'Legacy strategy',
            status: 'stopped',
            exchange: 'okx',
            symbol: 'BTC-USDT-SWAP',
            timeframe: '15m',
            positionPct: 10,
            initialCapital: 10000,
            metrics: { returnPct: 0, maxDrawdownPct: 0, winRatePct: 0, tradeCount: 0 },
            equitySeries: [],
            timeline: [],
            paramSchema: null,
            paramValues: null,
            schemaVersion: null,
            supportsDynamicParams: false,
            publishedSnapshotId: null,
            snapshotHash: null,
            runtimeExecutionStates: [],
            compatibilityMetadata: {
              isLegacySnapshot: true,
              missingBacktestConfigDefaults: true,
              missingDeploymentExecutionDefaults: true,
              missingDeploymentExecutionConstraints: true,
              requiresRepublishForBacktest: true,
              requiresRepublishForDeploy: true,
            },
          }}
        />,
      )
    })

    expect(container.textContent).not.toContain('高级运行诊断')
    expect(container.textContent).toContain('需要重新发布')
  })

  it('shows an explicit invalid binding warning when runtime truth is suppressed', async () => {
    await act(async () => {
      root.render(
        <AiQuantStrategyDetail
          lng="zh"
          strategy={{
            id: 'inst-invalid-binding',
            name: 'Invalid binding strategy',
            status: 'stopped',
            exchange: 'okx',
            symbol: 'BTC-USDT-SWAP',
            timeframe: '15m',
            positionPct: 10,
            initialCapital: 10000,
            metrics: { returnPct: 0, maxDrawdownPct: 0, winRatePct: 0, tradeCount: 0 },
            equitySeries: [],
            timeline: [],
            paramSchema: null,
            paramValues: null,
            schemaVersion: null,
            supportsDynamicParams: false,
            publishedSnapshotId: 'snapshot-invalid-binding',
            snapshotHash: 'hash-invalid-binding',
            runtimeExecutionStates: [],
            compatibilityMetadata: {
              isLegacySnapshot: false,
              missingBacktestConfigDefaults: false,
              missingDeploymentExecutionDefaults: false,
              missingDeploymentExecutionConstraints: false,
              requiresRepublishForBacktest: false,
              requiresRepublishForDeploy: false,
              invalidBinding: true,
            },
          }}
        />,
      )
    })

    expect(container.textContent).toContain('快照绑定已失效')
    expect(container.textContent).toContain('请重新发布并重新部署')
    expect(container.textContent).not.toContain('运行回测')
  })

  it('keeps flat account equity curves visible instead of clipping them against the chart edge', async () => {
    await act(async () => {
      root.render(
        <AiQuantStrategyDetail
          lng="zh"
          strategy={{
            id: 'inst-flat-equity',
            name: 'Flat equity strategy',
            status: 'running',
            exchange: 'okx',
            symbol: 'DOGEUSDT',
            marketType: 'spot',
            timeframe: '1h',
            positionPct: 10,
            initialCapital: 50615.549094,
            metrics: { returnPct: 0, maxDrawdownPct: 0, winRatePct: 0, tradeCount: 2 },
            equitySeries: [
              { ts: '2026-04-24 14:43', value: 50615.549094 },
              { ts: '2026-04-24 15:00', value: 50615.549094 },
              { ts: '2026-04-25 06:19', value: 50615.549094 },
            ],
            timeline: [],
            paramSchema: null,
            paramValues: null,
            schemaVersion: null,
            supportsDynamicParams: false,
            updatedAt: '2026-04-25T06:19:00.000Z',
          }}
        />,
      )
    })

    expect(container.textContent).toContain('策略收益曲线')
    expect(container.textContent).toContain('来源：策略现货账户权益台账')
    const points = container.querySelector('polyline')?.getAttribute('points') ?? ''
    expect(points).not.toContain(',220')
    expect(points).toContain(',110')
  })
})
