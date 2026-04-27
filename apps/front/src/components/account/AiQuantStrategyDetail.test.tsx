/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { AccountAiQuantStrategyDetail } from '@/lib/api'
import type { AiQuantStrategyRecord } from './ai-quant-strategy-store'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AiQuantStrategyDetail } from './AiQuantStrategyDetail'

const mockPerformAccountAiQuantStrategyAction = jest.fn()
const mockFetchAccountAiQuantStrategyDetail = jest.fn()

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    session: { userId: 'user-1' },
    isLoading: false,
  }),
}))

jest.mock('@/lib/api', () => ({
  fetchAccountAiQuantStrategyDetail: (...args: unknown[]) => mockFetchAccountAiQuantStrategyDetail(...args),
  performAccountAiQuantStrategyAction: (...args: unknown[]) => mockPerformAccountAiQuantStrategyAction(...args),
}))

function buildStrategy(overrides: Partial<AiQuantStrategyRecord> = {}): AiQuantStrategyRecord {
  return {
    id: 'inst-runtime-control',
    name: 'Runtime control strategy',
    status: 'running',
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
    publishedSnapshotId: 'snapshot-1',
    snapshotHash: 'hash-1',
    accountOverview: {
      initialBalance: 10000,
      totalEquity: 10000,
      availableBalance: 10000,
      totalPnl: 0,
      todayPnl: 0,
      baseCurrency: 'USDT',
    },
    positionOverview: {
      openPositionsCount: 0,
      closedPositionsCount: 0,
      totalRealizedPnl: 0,
      totalUnrealizedPnl: 0,
    },
    latestOrders: [],
    openOrdersCount: 0,
    updatedAt: '2026-04-25T00:00:00.000Z',
    ...overrides,
  }
}

function buildActionDetail(overrides: Partial<AccountAiQuantStrategyDetail> = {}): AccountAiQuantStrategyDetail {
  return {
    id: 'inst-runtime-control',
    name: 'Runtime control strategy',
    status: 'stopped',
    exchange: 'okx',
    symbol: 'BTC-USDT-SWAP',
    timeframe: '15m',
    positionPct: 10,
    isSubscribed: true,
    paramSchema: null,
    paramValues: null,
    schemaVersion: null,
    metrics: { returnPct: 0, maxDrawdownPct: 0, winRatePct: 0, tradeCount: 0 },
    updatedAt: '2026-04-25T00:00:00.000Z',
    totalPnl: 0,
    todayPnl: 0,
    equitySeries: [],
    snapshot: {
      exchange: 'okx',
      symbol: 'BTC-USDT-SWAP',
      timeframe: '15m',
      positionPct: 10,
      publishedSnapshotId: 'snapshot-1',
      snapshotHash: 'hash-1',
      paramSchema: null,
      paramValues: null,
      schemaVersion: null,
      strategyConfig: {
        exchange: 'okx',
        symbol: 'BTC-USDT-SWAP',
        marketType: 'perp',
        baseTimeframe: '15m',
        positionPct: 10,
      },
      compatibilityMetadata: {
        isLegacySnapshot: false,
        missingBacktestConfigDefaults: false,
        missingDeploymentExecutionDefaults: false,
        missingDeploymentExecutionConstraints: false,
        requiresRepublishForBacktest: false,
        requiresRepublishForDeploy: false,
      },
    },
    timeline: [],
    runtimeExecutionStates: [],
    accountOverview: {
      initialBalance: 10000,
      totalEquity: 10000,
      availableBalance: 10000,
      totalPnl: 0,
      todayPnl: 0,
      baseCurrency: 'USDT',
    },
    positionOverview: {
      openPositionsCount: 0,
      closedPositionsCount: 0,
      totalRealizedPnl: 0,
      totalUnrealizedPnl: 0,
    },
    latestOrders: [],
    openOrdersCount: 0,
    runtimeSemanticSummary: null,
    ...overrides,
  }
}

function findButton(label: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('button')).find(
    button => button.textContent?.trim() === label,
  ) as HTMLButtonElement | undefined
}

describe('AiQuantStrategyDetail', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    mockPerformAccountAiQuantStrategyAction.mockReset()
    mockFetchAccountAiQuantStrategyDetail.mockReset()
    mockFetchAccountAiQuantStrategyDetail.mockResolvedValue(buildActionDetail({ status: 'running' }))
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
    const statusHeading = Array.from(container.querySelectorAll('h2'))
      .find(heading => heading.textContent === '当前状态解释')
    const statusSection = statusHeading?.closest('section')
    expect(statusSection?.className).toContain('bg-[color:var(--cf-surface)]')
    expect(statusSection?.className).not.toContain('cyan')
    expect(statusSection?.querySelector('p')?.className).toContain('text-[color:var(--cf-text)]')
    expect(statusSection?.querySelector('p')?.className).not.toContain('cyan')
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

  it('shows stop control for a running strategy and calls stop action', async () => {
    mockPerformAccountAiQuantStrategyAction.mockResolvedValue(buildActionDetail())

    await act(async () => {
      root.render(
        <AiQuantStrategyDetail
          lng="zh"
          strategy={buildStrategy()}
        />,
      )
    })

    expect(container.textContent).toContain('停止策略')
    expect(container.textContent).not.toContain('平仓并停止')

    await act(async () => {
      findButton('停止策略')?.click()
    })

    expect(container.textContent).toContain('确认停止策略？')
    expect(container.textContent).toContain('确认停止')

    await act(async () => {
      container.querySelector('[data-testid="confirm-stop-strategy"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })

    expect(mockPerformAccountAiQuantStrategyAction).toHaveBeenCalledWith('inst-runtime-control', {
      userId: 'user-1',
      action: 'stop',
    })
    expect(container.textContent).toContain('策略已停止。现有持仓和挂单仍然保留，需要你单独管理。')
    expect(container.textContent).toContain('已停止')
  })

  it('shows liquidate_and_stop control when open positions exist and disables controls while pending', async () => {
    let resolveAction: ((value: AccountAiQuantStrategyDetail) => void) | null = null
    mockPerformAccountAiQuantStrategyAction.mockReturnValue(new Promise<AccountAiQuantStrategyDetail>((resolve) => {
      resolveAction = resolve
    }))
    mockFetchAccountAiQuantStrategyDetail.mockResolvedValue(buildActionDetail({
      status: 'running',
      positionOverview: {
        openPositionsCount: 2,
        closedPositionsCount: 0,
        totalRealizedPnl: 0,
        totalUnrealizedPnl: 12,
      },
    }))

    await act(async () => {
      root.render(
        <AiQuantStrategyDetail
          lng="zh"
          strategy={buildStrategy({
            positionOverview: {
              openPositionsCount: 2,
              closedPositionsCount: 0,
              totalRealizedPnl: 0,
              totalUnrealizedPnl: 12,
            },
          })}
        />,
      )
    })

    const stopButton = findButton('停止策略')
    const liquidateButton = findButton('平仓并停止')

    expect(liquidateButton).toBeDefined()
    expect(stopButton?.disabled).toBe(false)
    expect(liquidateButton?.disabled).toBe(false)

    await act(async () => {
      liquidateButton?.click()
    })

    expect(container.textContent).toContain('当前策略仍有持仓或挂单')
    expect(container.textContent).toContain('仅停止，保留持仓/挂单')

    await act(async () => {
      container.querySelector('[data-testid="liquidate-and-stop-strategy"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })

    expect(mockPerformAccountAiQuantStrategyAction).toHaveBeenCalledWith('inst-runtime-control', {
      userId: 'user-1',
      action: 'liquidate_and_stop',
    })
    expect(findButton('停止策略')?.disabled).toBe(true)
    expect(findButton('平仓并停止')?.disabled).toBe(true)

    await act(async () => {
      resolveAction?.(buildActionDetail({
        positionOverview: {
          openPositionsCount: 0,
          closedPositionsCount: 2,
          totalRealizedPnl: 15,
          totalUnrealizedPnl: 0,
        },
      }))
    })

    expect(container.textContent).toContain('策略已平仓并停止。')
    expect(container.textContent).toContain('已停止')
  })

  it('shows the liquidate failure message and keeps the strategy running when action fails', async () => {
    mockPerformAccountAiQuantStrategyAction.mockRejectedValue(new Error(''))
    mockFetchAccountAiQuantStrategyDetail.mockResolvedValue(buildActionDetail({
      status: 'running',
      positionOverview: {
        openPositionsCount: 1,
        closedPositionsCount: 0,
        totalRealizedPnl: 0,
        totalUnrealizedPnl: 9,
      },
    }))

    await act(async () => {
      root.render(
        <AiQuantStrategyDetail
          lng="zh"
          strategy={buildStrategy({
            positionOverview: {
              openPositionsCount: 1,
              closedPositionsCount: 0,
              totalRealizedPnl: 0,
              totalUnrealizedPnl: 9,
            },
          })}
        />,
      )
    })

    await act(async () => {
      findButton('平仓并停止')?.click()
    })

    await act(async () => {
      container.querySelector('[data-testid="liquidate-and-stop-strategy"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      )
    })

    expect(container.textContent).toContain('平仓并停止失败，请检查模拟盘账户状态后重试。')
    expect(container.textContent).toContain('运行中')
    expect(container.textContent).toContain('停止策略')
    expect(container.textContent).toContain('平仓并停止')
    expect(container.textContent).not.toContain('策略已平仓并停止。')
  })

  it('shows redeploy and return-to-chat entries after the strategy is stopped', async () => {
    await act(async () => {
      root.render(
        <AiQuantStrategyDetail
          lng="zh"
          strategy={buildStrategy({ status: 'stopped' })}
        />,
      )
    })

    expect(container.textContent).toContain('重新部署')
    expect(container.textContent).toContain('返回对话修改')
    expect(container.textContent).not.toContain('停止策略')
  })

  it('stores strategy edit session intent before returning to chat for stopped strategy', async () => {
    localStorage.clear()

    await act(async () => {
      root.render(
        <AiQuantStrategyDetail
          lng="zh"
          strategy={buildStrategy({ status: 'stopped', publishedSnapshotId: 'snapshot-1' })}
        />,
      )
    })

    const link = Array.from(container.querySelectorAll('a')).find(item => item.textContent?.trim() === '返回对话修改')
    expect(link).toBeTruthy()

    const preventNavigation = (event: Event) => event.preventDefault()
    link?.addEventListener('click', preventNavigation)
    try {
      await act(async () => {
        link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
    } finally {
      link?.removeEventListener('click', preventNavigation)
    }

    const raw = localStorage.getItem('ai_quant_return_intent_v1')
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!)).toMatchObject({
      type: 'strategy-edit-session',
      strategyInstanceId: 'inst-runtime-control',
      publishedSnapshotId: 'snapshot-1',
      source: 'account-detail',
    })
  })

  it('does not store edit session intent when running strategy opens edit guard', async () => {
    localStorage.clear()

    await act(async () => {
      root.render(<AiQuantStrategyDetail lng="zh" strategy={buildStrategy({ status: 'running' })} />)
    })

    const link = Array.from(container.querySelectorAll('a')).find(item => item.textContent?.trim() === '返回对话修改')

    await act(async () => {
      link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    expect(localStorage.getItem('ai_quant_return_intent_v1')).toBeNull()
    expect(container.textContent).toContain('策略正在运行，不能直接修改')
  })

  it('shows liquidate_and_stop when current open orders indicate runtime risk without open positions', async () => {
    await act(async () => {
      root.render(
        <AiQuantStrategyDetail
          lng="zh"
          strategy={buildStrategy({
            positionOverview: {
              openPositionsCount: 0,
              closedPositionsCount: 0,
              totalRealizedPnl: 0,
              totalUnrealizedPnl: 0,
            },
            latestOrders: [{
              executedAt: '2026-04-25 20:00',
              side: 'BUY',
              semanticAction: '买入',
              semanticRole: 'entry',
              symbol: 'BTCUSDT',
              price: 1,
              quantity: 1,
              fee: 0,
              feeCurrency: 'USDT',
              orderId: 'order-1',
            }],
            openOrdersCount: 1,
          })}
        />,
      )
    })

    expect(container.textContent).toContain('平仓并停止')
    expect(container.textContent).toContain('当前未成交挂单 1 条')
  })
})
