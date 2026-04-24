/** @jest-environment jsdom */

import type { StrategyPlazaTemplate } from '@/lib/api'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ApiError } from '@/lib/errors'
import { AiQuantPlazaPageClient } from './PlazaPageClient'

const mockPush = jest.fn()
const mockFetchStrategyPlazaTemplates = jest.fn<() => Promise<StrategyPlazaTemplate[]>>()
const mockRunStrategyPlazaTemplate = jest.fn()
const mockStartStrategyPlazaEditSession = jest.fn()
const mockCreateStrategyPlazaRunRequestId = jest.fn()
const mockSetIntent = jest.fn()

let mockSession: { userId: string } | null = { userId: 'u-1' }
let mockIsLoading = false
let plazaProps: {
  templates: StrategyPlazaTemplate[]
  loading: boolean
  error?: string | null
  actionError?: string | null
  pendingTemplateId?: string | null
  pendingAction?: 'run' | 'edit' | null
  onRunStrategy: (templateId: string) => void
  onEditStrategy: (templateId: string) => void
} | null = null

const template: StrategyPlazaTemplate = {
  id: 'ma-cross',
  name: 'MA Cross Demo',
  description: 'Use moving averages.',
  logicDescription: 'Fast MA crosses slow MA.',
  tags: ['trend'],
  riskLevel: 'medium',
  scenario: 'trend_following',
  exchange: 'okx',
  environment: 'demo',
  marketType: 'perp',
  symbol: 'BTC-USDT-SWAP',
  timeframe: '15m',
  positionPct: 0.25,
  leverage: 3,
  status: 'live',
  displayOrder: 1,
  displayMetrics: {
    label: 'official_sample_backtest',
    returnPct: null,
    winRatePct: null,
    maxDrawdownPct: null,
  },
}

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

jest.mock('next/navigation', () => ({
  useParams: () => ({ lng: 'zh' }),
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string, children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    session: mockSession,
    isLoading: mockIsLoading,
  }),
}))

jest.mock('@/components/ai-quant/intent-storage', () => ({
  setIntent: (...args: Parameters<typeof mockSetIntent>) => mockSetIntent(...args),
}))

jest.mock('@/components/ai-quant/GuestAiQuantLanding', () => ({
  GuestAiQuantLanding: () => <div data-testid="guest-landing" />,
}))

jest.mock('@/components/ai-quant/StrategyPlaza', () => ({
  StrategyPlaza: (props: typeof plazaProps) => {
    plazaProps = props
    return <div data-testid="strategy-plaza">{props?.templates.map(item => item.name).join('|')}</div>
  },
}))

jest.mock('@/lib/api', () => ({
  fetchStrategyPlazaTemplates: (...args: Parameters<typeof mockFetchStrategyPlazaTemplates>) =>
    mockFetchStrategyPlazaTemplates(...args),
  runStrategyPlazaTemplate: (...args: Parameters<typeof mockRunStrategyPlazaTemplate>) =>
    mockRunStrategyPlazaTemplate(...args),
  startStrategyPlazaEditSession: (...args: Parameters<typeof mockStartStrategyPlazaEditSession>) =>
    mockStartStrategyPlazaEditSession(...args),
  createStrategyPlazaRunRequestId: (...args: Parameters<typeof mockCreateStrategyPlazaRunRequestId>) =>
    mockCreateStrategyPlazaRunRequestId(...args),
}))

async function flushPromises() {
  await act(async () => {
    await Promise.resolve()
  })
}

describe('AiQuantPlazaPageClient', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    mockSession = { userId: 'u-1' }
    mockIsLoading = false
    plazaProps = null
    mockPush.mockReset()
    mockSetIntent.mockReset()
    mockFetchStrategyPlazaTemplates.mockReset()
    mockRunStrategyPlazaTemplate.mockReset()
    mockStartStrategyPlazaEditSession.mockReset()
    mockCreateStrategyPlazaRunRequestId.mockReset()
    mockFetchStrategyPlazaTemplates.mockResolvedValue([template])
    mockCreateStrategyPlazaRunRequestId.mockReturnValue('plaza-run-1')
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('lets guests browse plaza templates and stores plaza-run intent before login', async () => {
    mockSession = null

    await act(async () => {
      root.render(<AiQuantPlazaPageClient />)
    })
    await flushPromises()

    expect(container.textContent).toContain('MA Cross Demo')

    await act(async () => {
      plazaProps?.onRunStrategy('ma-cross')
    })

    expect(mockSetIntent).toHaveBeenCalledWith({ type: 'plaza-run', templateId: 'ma-cross' })
    expect(mockPush).toHaveBeenCalledWith('/zh/auth/login?redirect=%2Fzh%2Fai-quant%2Fplaza')
  })

  it('stores plaza-edit intent before login and redirects back to plaza', async () => {
    mockSession = null

    await act(async () => {
      root.render(<AiQuantPlazaPageClient />)
    })
    await flushPromises()

    await act(async () => {
      plazaProps?.onEditStrategy('ma-cross')
    })

    expect(mockSetIntent).toHaveBeenCalledWith({ type: 'plaza-edit', templateId: 'ma-cross' })
    expect(mockPush).toHaveBeenCalledWith('/zh/auth/login?redirect=%2Fzh%2Fai-quant%2Fplaza')
  })

  it('runs an authenticated plaza template and navigates to strategy detail', async () => {
    mockRunStrategyPlazaTemplate.mockResolvedValue({ id: 'strategy-1' })

    await act(async () => {
      root.render(<AiQuantPlazaPageClient />)
    })
    await flushPromises()

    await act(async () => {
      await plazaProps?.onRunStrategy('ma-cross')
    })

    expect(mockRunStrategyPlazaTemplate).toHaveBeenCalledWith('ma-cross', 'plaza-run-1')
    expect(mockPush).toHaveBeenCalledWith('/zh/account/ai-quant/strategy/strategy-1')
  })

  it('stores plaza-run intent and routes to exchange API binding when OKX demo key is missing', async () => {
    mockRunStrategyPlazaTemplate.mockRejectedValue(
      new ApiError(
        '请先绑定 OKX 模拟盘 API Key',
        'strategy_plaza.okx_demo_api_key_required',
        400,
      ),
    )

    await act(async () => {
      root.render(<AiQuantPlazaPageClient />)
    })
    await flushPromises()

    await act(async () => {
      await plazaProps?.onRunStrategy('ma-cross')
    })

    expect(mockSetIntent).toHaveBeenCalledWith({ type: 'plaza-run', templateId: 'ma-cross' })
    expect(mockPush).toHaveBeenCalledWith('/zh/account?tab=ai-quant#exchange-api')
  })

  it('keeps loaded templates visible and passes action error when run fails', async () => {
    mockRunStrategyPlazaTemplate.mockRejectedValue(new ApiError('运行失败', 'API_ERROR', 500))

    await act(async () => {
      root.render(<AiQuantPlazaPageClient />)
    })
    await flushPromises()

    await act(async () => {
      await plazaProps?.onRunStrategy('ma-cross')
    })

    expect(plazaProps?.templates).toEqual([template])
    expect(plazaProps?.error).toBeNull()
    expect(plazaProps?.actionError).toBe('运行失败')
  })

  it('starts an authenticated edit session and opens AI Quant chat draft', async () => {
    mockStartStrategyPlazaEditSession.mockResolvedValue({ initialMessage: 'Edit MA Cross' })

    await act(async () => {
      root.render(<AiQuantPlazaPageClient />)
    })
    await flushPromises()

    await act(async () => {
      await plazaProps?.onEditStrategy('ma-cross')
    })

    expect(mockStartStrategyPlazaEditSession).toHaveBeenCalledWith('ma-cross')
    expect(mockSetIntent).toHaveBeenCalledWith({ type: 'chat', draft: 'Edit MA Cross' })
    expect(mockPush).toHaveBeenCalledWith('/zh/ai-quant')
  })
})
