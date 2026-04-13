/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'

const originalFetch = globalThis.fetch

jest.mock('@ai/shared', () => ({
  buildBearerAuthHeaders: (token: string) => ({
    Authorization: `Bearer ${token}`,
  }),
  getErrorHttpStatus: jest.fn(),
  unwrapTransportResponse: (value: unknown) => {
    if (value && typeof value === 'object' && 'data' in value) {
      return (value as { data: unknown }).data
    }
    return value
  },
}), { virtual: true })

jest.mock('@/components/account/ai-quant-strategy-store', () => ({
  deleteStrategyById: jest.fn(),
  getStrategyById: jest.fn(),
  listStrategies: jest.fn(() => []),
  updateStrategyStatus: jest.fn(),
}))

jest.mock('@/components/ai-quant/ai-quant-error-stage', () => ({
  buildAiQuantStageFallbackMessage: jest.fn((_fallback: string) => 'fallback'),
  parseAiQuantErrorMeta: jest.fn(() => ({})),
}))

jest.mock('./api-cache', () => ({
  cachedRequest: jest.fn(),
  CacheTTL: {
    SHORT: 30,
    MEDIUM: 60,
    LONG: 300,
  },
}))

jest.mock('./api-client', () => ({
  API_BASE_URL: 'http://localhost:3000/api/v1',
  client: {},
  safeApiCall: jest.fn(),
  unwrapApiResponse: (value: unknown) => value,
  validateId: (id: string, label?: string) => {
    if (!id?.trim()) {
      throw new Error(`${label ?? 'id'} is required`)
    }
  },
}))

jest.mock('./auth-storage', () => ({
  getToken: () => 'a.b.c',
}))

jest.mock('./hyperliquid-api', () => ({
  fetchTraderFullData: jest.fn(),
  fetchTraderOpenOrdersFromHyperliquid: jest.fn(),
  fetchUserFillsFromHyperliquid: jest.fn(),
  fetchUserPortfolioFromHyperliquid: jest.fn(),
}))

const sessionPayload = {
  id: 'session-1',
  status: 'CLARIFICATION_REQUIRED',
  conversationId: null,
  conversationTitle: 'BTC breakout',
  conversationMessages: [
    { role: 'user' as const, content: 'Buy BTC when breakout confirms' },
    { role: 'assistant' as const, content: 'Need clarification first' },
  ],
  scriptCode: null,
  publishedSnapshotId: null,
  publishedSnapshotParamValues: null,
  publishedSnapshotStrategyConfig: null,
  publishedSnapshotBacktestConfigDefaults: null,
  publishedSnapshotDeploymentExecutionDefaults: null,
  publishedSnapshotDeploymentExecutionConstraints: null,
  publishedSnapshotCompatibilityMetadata: null,
  canonicalDigest: null,
  consistencyReport: null,
  specDesc: null,
  semanticGraph: null,
  validationReport: null,
  strategyInstanceId: null,
  rejectReason: null,
  clarificationGate: null,
  publicationGate: null,
}

describe('llm codegen session transport handling', () => {
  beforeEach(() => {
    jest.resetModules()
  })

  afterEach(() => {
    jest.clearAllMocks()
    jest.restoreAllMocks()
    if (originalFetch) {
      globalThis.fetch = originalFetch
    } else {
      delete (globalThis as { fetch?: typeof fetch }).fetch
    }
  })

  it('unwraps transport envelopes for get/start/continue codegen session APIs', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: sessionPayload }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: sessionPayload }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: sessionPayload }),
      } as Response)
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const {
      continueLlmCodegenSession,
      getLlmCodegenSession,
      startLlmCodegenSession,
    } = await import('./api')

    await expect(getLlmCodegenSession('session-1')).resolves.toEqual(sessionPayload)
    await expect(
      startLlmCodegenSession({ initialMessage: 'Breakout setup' }),
    ).resolves.toEqual(sessionPayload)
    await expect(
      continueLlmCodegenSession('session-1', { message: 'Use isolated margin' }),
    ).resolves.toEqual(sessionPayload)

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'http://localhost:3000/api/v1/llm-strategy-codegen/sessions/session-1',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer a.b.c',
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/v1/llm-strategy-codegen/sessions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer a.b.c',
          'Content-Type': 'application/json',
        }),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3000/api/v1/llm-strategy-codegen/sessions/session-1/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer a.b.c',
          'Content-Type': 'application/json',
        }),
      }),
    )
  })

  it('keeps raw session payload compatibility for nullable codegen fields', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => sessionPayload,
    } as Response)
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const { getLlmCodegenSession } = await import('./api')
    const result = await getLlmCodegenSession('session-1')

    expect(result.id).toBe('session-1')
    expect(result.conversationId).toBeNull()
    expect(result.scriptCode).toBeNull()
    expect(result.publishedSnapshotId).toBeNull()
    expect(result.publishedSnapshotStrategyConfig).toBeNull()
    expect(result.publishedSnapshotBacktestConfigDefaults).toBeNull()
    expect(result.publishedSnapshotDeploymentExecutionDefaults).toBeNull()
    expect(result.publishedSnapshotDeploymentExecutionConstraints).toBeNull()
    expect(result.publishedSnapshotCompatibilityMetadata).toBeNull()
    expect(result.clarificationGate).toBeNull()
    expect(result.publicationGate).toBeNull()
    expect(result.conversationMessages).toEqual(sessionPayload.conversationMessages)
  })
})
