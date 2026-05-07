import { describe, expect, it, beforeEach } from '@jest/globals'

const mockToastSuccess = jest.fn()
const mockToastError = jest.fn()

jest.mock('@/lib/toast', () => ({
  toast: {
    success: (opts: unknown) => mockToastSuccess(opts),
    error: (opts: unknown) => mockToastError(opts),
    warning: jest.fn(),
    info: jest.fn(),
  },
}))

const mockDeploy = jest.fn()
const mockFetchAccounts = jest.fn()
const mockFetchDeployResult = jest.fn()

jest.mock('@/lib/api', () => ({
  deployAccountAiQuantStrategy: (...args: unknown[]) => mockDeploy(...args),
  fetchAccountAiQuantDeployResult: (...args: unknown[]) => mockFetchDeployResult(...args),
  fetchUserExchangeAccountStatuses: (...args: unknown[]) => mockFetchAccounts(...args),
}))

import { confirmAiQuantDeploy } from './ai-quant-page-deploy'

const t = (key: string, options?: Record<string, unknown>) => {
  if (key === 'aiQuant.messages.deploySuccess') {
    return `部署成功：${options?.exchange} / ${options?.account}。可在个人中心查看运行状态。`
  }
  if (key === 'aiQuant.messages.deployFailedWithReason') {
    return `部署失败：${options?.reason}`
  }
  if (key === 'aiQuant.messages.deployFailedFallback') {
    return '部署失败，请稍后再试。'
  }
  return key
}

function makeArgs() {
  const updateActiveConversation = jest.fn()
  return {
    args: {
      activeConversation: {
        id: 'conv-1',
        title: 'My Strategy',
        messages: [],
        backtestResult: { drawdownPct: 5 },
        publishedSnapshotId: 'snap-1',
        publishedSnapshotCompatibilityMetadata: null,
      } as never,
      apiConfigHref: '/api-config',
      deployRequestId: null,
      selectedDeployAccountId: 'acct-1',
      selectedDeployExchange: 'okx' as const,
      selectedDeployMarketType: 'perp' as const,
      selectedDeployLeverage: 3,
      sessionUserId: 'user-1',
      setDeployOpen: jest.fn(),
      setDeployRequestId: jest.fn(),
      setDeploySubmitting: jest.fn(),
      setExchangeAccounts: jest.fn(),
      setSelectedDeployAccountId: jest.fn(),
      t,
      updateActiveConversation,
      push: jest.fn(),
    },
    updateActiveConversation,
  }
}

describe('confirmAiQuantDeploy', () => {
  beforeEach(() => {
    mockToastSuccess.mockReset()
    mockToastError.mockReset()
    mockDeploy.mockReset()
    mockFetchAccounts.mockReset()
    mockFetchDeployResult.mockReset()

    mockFetchAccounts.mockResolvedValue([
      {
        id: 'acct-1',
        exchangeId: 'okx',
        isBound: true,
        name: 'okx-test-api',
        maskedCredential: 'OKX****01',
        isTestnet: true,
        lastValidatedAt: null,
        createdAt: null,
      },
    ])
  })

  it('on success: fires toast.success and does NOT mutate conversation messages', async () => {
    mockDeploy.mockResolvedValue(undefined)

    const { args, updateActiveConversation } = makeArgs()
    await confirmAiQuantDeploy(args)

    expect(mockToastSuccess).toHaveBeenCalledTimes(1)
    expect(mockToastSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('部署成功'),
      }),
    )
    expect(updateActiveConversation).not.toHaveBeenCalled()
    expect(args.setDeployOpen).toHaveBeenCalledWith(false)
  })

  it('on failure: fires toast.error and does NOT mutate conversation messages', async () => {
    mockDeploy.mockRejectedValue(Object.assign(new Error('boom'), { code: 'AI_QUANT_DEPLOY_FAILED' }))

    const { args, updateActiveConversation } = makeArgs()
    await expect(confirmAiQuantDeploy(args)).rejects.toThrow()

    expect(mockToastError).toHaveBeenCalledTimes(1)
    expect(mockToastError).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('部署失败'),
      }),
    )
    expect(updateActiveConversation).not.toHaveBeenCalled()
  })
})
