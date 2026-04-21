/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React from 'react'
import { act } from 'react'
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

    expect(container.textContent).toContain('运行时执行语义状态')
    expect(container.textContent).toContain('on_start.entry.primary')
    expect(container.textContent).toContain('失败')
    expect(container.textContent).toContain('最近尝试')
    expect(container.textContent).toContain('2026-03-20 10:03')
    expect(container.textContent).toContain('失败分类')
    expect(container.textContent).toContain('execution')
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
    expect(container.textContent).toContain('当前执行条件未满足（缺少参考K线）')
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

    expect(container.textContent).not.toContain('运行时执行语义状态')
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
  })
})
