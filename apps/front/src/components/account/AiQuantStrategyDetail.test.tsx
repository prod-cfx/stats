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
})
