/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { StrategyDetailPageClient } from './StrategyDetailPageClient'

const mockFetchDetail = jest.fn()
const mockMapDetailToRecord = jest.fn()
const mockOpenAuth = jest.fn()
const mockDetailProps: Array<Record<string, unknown>> = []
const stableSession = { userId: 'user-1' }
let mockSession: { userId: string } | null = stableSession

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    session: mockSession,
    isLoading: false,
  }),
}))

jest.mock('@/features/auth/AuthSheetProvider', () => ({
  useAuthSheet: () => ({ openAuth: mockOpenAuth }),
}))

jest.mock('@/features/auth/auth-gate-suppression', () => ({
  shouldSuppressAuthGate: jest.fn(() => false),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

jest.mock('@/components/account/AiQuantStrategyDetail', () => ({
  AiQuantStrategyDetail: (props: Record<string, unknown>) => {
    mockDetailProps.push(props)
    return (
      <div>
        <div data-testid="strategy-id">
          {(props.strategy as { id?: string } | null)?.id ?? ''}
        </div>
        {'onRunBacktest' in props && (
          <button data-testid="run-backtest" type="button">
            run
          </button>
        )}
      </div>
    )
  },
}))

jest.mock('@/lib/api', () => ({
  fetchAccountAiQuantStrategyDetail: (...args: unknown[]) => mockFetchDetail(...args),
}))

jest.mock('@/components/account/ai-quant-strategy-api-adapter', () => ({
  mapAccountStrategyDetailToRecord: (...args: unknown[]) => mockMapDetailToRecord(...args),
}))

describe('StrategyDetailPageClient', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mockDetailProps.length = 0
    mockSession = stableSession
    mockFetchDetail.mockReset()
    mockOpenAuth.mockReset()
    mockMapDetailToRecord.mockReset()
    mockFetchDetail.mockResolvedValue({ id: 'detail-1' })
    mockMapDetailToRecord.mockReturnValue({
      id: 'inst-1',
      name: 'Snapshot strategy',
      status: 'running',
      exchange: 'okx',
      symbol: 'DOGEUSDT',
      timeframe: '1h',
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
      updatedAt: '2026-04-24T00:00:00.000Z',
    })
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    jest.restoreAllMocks()
  })

  it('renders deployment detail without any backtest entry point or backtest props', async () => {
    await act(async () => {
      root.render(<StrategyDetailPageClient lng="zh" id="inst-1" />)
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(mockFetchDetail).toHaveBeenCalledWith('inst-1', 'user-1')
    expect(container.querySelector('[data-testid="strategy-id"]')?.textContent).toBe('inst-1')
    expect(container.querySelector('[data-testid="run-backtest"]')).toBeNull()
    expect(mockDetailProps.at(-1)).not.toHaveProperty('onRunBacktest')
    expect(mockDetailProps.at(-1)).not.toHaveProperty('isBacktestRunning')
    expect(mockDetailProps.at(-1)).not.toHaveProperty('backtestError')
    expect(mockDetailProps.at(-1)).not.toHaveProperty('onUpdateLeverage')
    expect(mockDetailProps.at(-1)).not.toHaveProperty('isUpdatingLeverage')
    expect(mockDetailProps.at(-1)).not.toHaveProperty('leverageUpdateError')
  })

  it('opens the auth sheet and skips detail fetch when unauthenticated', async () => {
    mockSession = null

    await act(async () => {
      root.render(<StrategyDetailPageClient lng="zh" id="inst-1" />)
    })

    expect(mockOpenAuth).toHaveBeenCalledWith({
      lng: 'zh',
      redirect: '/zh/account/ai-quant/strategy/inst-1',
      closeRedirect: '/zh/account?tab=ai-quant',
    })
    expect(mockFetchDetail).not.toHaveBeenCalled()
  })

  it('suppresses auth sheet after logout on the strategy detail page', async () => {
    const { shouldSuppressAuthGate } = await import('@/features/auth/auth-gate-suppression')
    ;(shouldSuppressAuthGate as jest.Mock).mockReturnValueOnce(true)
    mockSession = null

    await act(async () => {
      root.render(<StrategyDetailPageClient lng="zh" id="inst-1" />)
    })

    expect(mockOpenAuth).not.toHaveBeenCalled()
    expect(mockFetchDetail).not.toHaveBeenCalled()
  })
})
