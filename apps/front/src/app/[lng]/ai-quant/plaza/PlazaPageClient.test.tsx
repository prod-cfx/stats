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
const mockGetIntent = jest.fn()
const mockClearIntent = jest.fn()
const mockTranslations: Record<string, string> = {
  'aiQuant.guestLanding.plazaSubtitle': '精选策略模板',
  'aiQuant.plaza': '策略广场',
  'aiQuant.plazaPage.back': '返回',
  'aiQuant.plazaPage.editSessionFailed': '创建策略广场编辑会话失败',
  'aiQuant.plazaPage.guestHint': '登录后可以一键运行或编辑策略模板，未登录也可以先浏览策略广场。',
  'aiQuant.plazaPage.loadFailed': '获取策略广场模板失败',
  'aiQuant.plazaPage.runFailed': '运行策略广场模板失败',
  'aiQuant.strategyPlazaSubtitle': '精选策略模板',
}
const mockT = (key: string) => mockTranslations[key] ?? key

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
    t: mockT,
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
  clearIntent: (...args: Parameters<typeof mockClearIntent>) => mockClearIntent(...args),
  getIntent: (...args: Parameters<typeof mockGetIntent>) => mockGetIntent(...args),
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
    mockGetIntent.mockReset()
    mockClearIntent.mockReset()
    mockFetchStrategyPlazaTemplates.mockReset()
    mockRunStrategyPlazaTemplate.mockReset()
    mockStartStrategyPlazaEditSession.mockReset()
    mockCreateStrategyPlazaRunRequestId.mockReset()
    mockFetchStrategyPlazaTemplates.mockResolvedValue([template])
    mockCreateStrategyPlazaRunRequestId.mockReturnValue('plaza-run-1')
    mockGetIntent.mockReturnValue(null)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('renders a page-level back link to account AI Quant when there is no source page', async () => {
    await act(async () => {
      root.render(<AiQuantPlazaPageClient />)
    })
    await flushPromises()

    const backLink = Array.from(container.querySelectorAll('a')).find(link => link.textContent?.includes('返回'))

    expect(backLink?.getAttribute('href')).toBe('/zh/account?tab=ai-quant')
  })

  it('renders a page-level back link to the same-origin source page', async () => {
    Object.defineProperty(document, 'referrer', {
      configurable: true,
      value: 'http://localhost/zh/ai-quant',
    })

    await act(async () => {
      root.render(<AiQuantPlazaPageClient />)
    })
    await flushPromises()

    const backLink = Array.from(container.querySelectorAll('a')).find(link => link.textContent?.includes('返回'))

    expect(backLink?.getAttribute('href')).toBe('/zh/ai-quant')
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
    expect(mockPush).toHaveBeenCalledWith('/zh/account?tab=settings&redirect=%2Fzh%2Fai-quant%2Fplaza#exchange-api')
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

  it('starts an authenticated edit session and opens its AI Quant conversation', async () => {
    mockStartStrategyPlazaEditSession.mockResolvedValue({ sessionId: 'session-1', initialMessage: 'Edit MA Cross' })

    await act(async () => {
      root.render(<AiQuantPlazaPageClient />)
    })
    await flushPromises()

    await act(async () => {
      await plazaProps?.onEditStrategy('ma-cross')
    })

    expect(mockStartStrategyPlazaEditSession).toHaveBeenCalledWith('ma-cross', 'zh')
    expect(mockSetIntent).toHaveBeenCalledWith({ type: 'plaza-chat-session', sessionId: 'session-1' })
    expect(mockPush).toHaveBeenCalledWith('/zh/ai-quant')
  })

  it('resumes plaza-edit intent after login and opens the created AI Quant conversation', async () => {
    mockGetIntent.mockReturnValue({ type: 'plaza-edit', templateId: 'ma-cross', ts: Date.now() })
    mockStartStrategyPlazaEditSession.mockResolvedValue({ sessionId: 'session-resume-1', initialMessage: 'Resume MA Cross edit' })

    await act(async () => {
      root.render(<AiQuantPlazaPageClient />)
    })
    await flushPromises()

    expect(mockGetIntent).toHaveBeenCalledWith(10 * 60 * 1000)
    expect(mockClearIntent).toHaveBeenCalledTimes(1)
    expect(mockStartStrategyPlazaEditSession).toHaveBeenCalledTimes(1)
    expect(mockStartStrategyPlazaEditSession).toHaveBeenCalledWith('ma-cross', 'zh')
    expect(mockSetIntent).toHaveBeenCalledWith({ type: 'plaza-chat-session', sessionId: 'session-resume-1' })
    expect(mockPush).toHaveBeenCalledWith('/zh/ai-quant')
  })

  it('resumes plaza-run intent after login and navigates to strategy detail', async () => {
    mockGetIntent.mockReturnValue({ type: 'plaza-run', templateId: 'ma-cross', ts: Date.now() })
    mockRunStrategyPlazaTemplate.mockResolvedValue({ id: 'strategy-1' })

    await act(async () => {
      root.render(<AiQuantPlazaPageClient />)
    })
    await flushPromises()

    expect(mockClearIntent).toHaveBeenCalledTimes(1)
    expect(mockRunStrategyPlazaTemplate).toHaveBeenCalledTimes(1)
    expect(mockRunStrategyPlazaTemplate).toHaveBeenCalledWith('ma-cross', 'plaza-run-1')
    expect(mockPush).toHaveBeenCalledWith('/zh/account/ai-quant/strategy/strategy-1')
  })

  it('re-stores plaza-run intent and routes to OKX binding when resumed run needs OKX demo key', async () => {
    mockGetIntent.mockReturnValue({ type: 'plaza-run', templateId: 'ma-cross', ts: Date.now() })
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

    expect(mockClearIntent).toHaveBeenCalledTimes(1)
    expect(mockSetIntent).toHaveBeenCalledWith({ type: 'plaza-run', templateId: 'ma-cross' })
    expect(mockPush).toHaveBeenCalledWith('/zh/account?tab=settings&redirect=%2Fzh%2Fai-quant%2Fplaza#exchange-api')
  })
})
