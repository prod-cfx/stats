/** @jest-environment jsdom */

import { beforeEach, describe, expect, it, jest } from '@jest/globals'
import { requestAiQuantCodegen } from './ai-quant-page-codegen'
import {
  DEFAULT_PARAMS,
  DEFAULT_PARAM_SCHEMA,
  DEFAULT_PARAM_VALUES,
} from './ai-quant-page-conversation'

const mockContinueLlmCodegenSession = jest.fn()
const mockGetLlmCodegenSession = jest.fn()
const mockStartLlmCodegenSession = jest.fn()

jest.mock('@/lib/api', () => ({
  continueLlmCodegenSession: (...args: unknown[]) => mockContinueLlmCodegenSession(...args),
  getLlmCodegenSession: (...args: unknown[]) => mockGetLlmCodegenSession(...args),
  startLlmCodegenSession: (...args: unknown[]) => mockStartLlmCodegenSession(...args),
}))

describe('ai-quant-page-codegen confirm preflight reconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('continues the active session after a terminal preflight reconciliation fetch', async () => {
    const primaryConversation = {
      id: 'conv-1',
      title: 'conv-1',
      messages: [{ id: 'welcome', role: 'assistant', content: 'hello' }],
      params: DEFAULT_PARAMS,
      paramSchema: DEFAULT_PARAM_SCHEMA,
      paramValues: DEFAULT_PARAM_VALUES,
      backtestResult: null,
      logicGraph: {
        version: 1,
        status: 'confirmed',
        trigger: [],
        actions: [],
        risk: [],
        meta: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          timeframe: '15m',
          positionPct: 10,
        },
      },
      codegenSpecDesc: {
        canonicalDigest: 'sha256:canonical-1',
      },
      semanticGraph: null,
      validationReport: null,
      clarificationGate: null,
      publicationGate: null,
      pendingCanonicalDigest: 'sha256:canonical-1',
      llmCodegenSessionId: 'session-1',
      publishedStrategyInstanceId: null,
      publishedSnapshotId: null,
      publishedScriptCode: null,
      publishedScriptGraphVersion: null,
      latestSignalMessage: null,
      backtestExecutionState: 'idle',
      updatedAt: 1,
    }

    mockGetLlmCodegenSession.mockResolvedValueOnce({
      id: 'session-1',
      status: 'PUBLISHED',
      strategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-1',
      canonicalDigest: 'sha256:canonical-1',
      scriptCode: 'return { ok: true }',
      semanticGraph: null,
      validationReport: null,
      specDesc: {
        canonicalDigest: 'sha256:canonical-1',
      },
    })
    mockContinueLlmCodegenSession.mockResolvedValueOnce({
      id: 'session-1',
      status: 'PUBLISHED',
      strategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-1',
      canonicalDigest: 'sha256:canonical-1',
      scriptCode: 'return { ok: true }',
      semanticGraph: null,
      validationReport: null,
      specDesc: {
        canonicalDigest: 'sha256:canonical-1',
      },
    })

    await requestAiQuantCodegen({
      backtestCapabilities: null,
      callingMessage: () => 'loading',
      codegenRequestMutexRef: { current: new Set<string>() },
      confirmGenerate: true,
      confirmedCanonicalDigest: 'sha256:canonical-1',
      conversationId: 'conv-1',
      conversations: [primaryConversation] as any,
      message: '确认',
      params: DEFAULT_PARAMS,
      sessionId: 'session-1',
      sessionUserId: 'u-1',
      setCodegenBusyConversationIds: jest.fn() as any,
      setConversations: jest.fn() as any,
      t: (key: string) => key,
    })

    expect(mockGetLlmCodegenSession.mock.calls).toEqual([['session-1']])
    expect(mockContinueLlmCodegenSession).toHaveBeenCalled()
  })
})
