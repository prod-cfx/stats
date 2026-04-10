import { beforeEach, describe, expect, it, jest } from '@jest/globals'

const mockContinueLlmCodegenSession = jest.fn()
const mockGetLlmCodegenSession = jest.fn()

jest.mock('p-limit', () => ({
  __esModule: true,
  default: () => async <T>(task: () => Promise<T> | T) => await task(),
}))

jest.mock('lucide-react', () => {
  const Icon = () => null
  return new Proxy({}, { get: () => Icon })
})

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => children,
}))

jest.mock('remark-gfm', () => ({
  __esModule: true,
  default: () => {},
}))

jest.mock('next/navigation', () => ({
  useParams: () => ({ lng: 'zh' }),
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string, children: unknown }) => ({ href, children }),
}))

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    session: { userId: 'u-1' },
    isLoading: false,
  }),
}))

jest.mock('@/components/account/ai-quant-strategy-store', () => ({
  upsertStrategyDeployment: jest.fn(),
}))

jest.mock('@/components/ai-quant/ConversationSidebar', () => ({
  ConversationSidebar: () => null,
}))

jest.mock('@/components/ai-quant/DeployDialog', () => ({
  DeployDialog: () => null,
}))

jest.mock('@/components/ai-quant/GuestAiQuantLanding', () => ({
  GuestAiQuantLanding: () => null,
}))

jest.mock('@/components/ai-quant/LogicGraphPreview', () => ({
  LogicGraphPreview: () => null,
}))

jest.mock('@/components/ai-quant/QuantChatPanel', () => ({
  QuantChatPanel: () => null,
}))

jest.mock('@/components/ai-quant/BacktestSummaryCard', () => ({
  BacktestSummaryCard: () => null,
}))

jest.mock('@/components/ai-quant/backtest-payload-builder', () => ({
  buildBacktestPayload: jest.fn(),
  isBacktestPayloadBuilderError: jest.fn(() => false),
}))

jest.mock('@/components/ai-quant/backtest-capability-client', () => ({
  fetchBacktestCapabilities: jest.fn(),
}))

jest.mock('@/components/ai-quant/backtest-symbol-support-client', () => ({
  checkBacktestSymbolSupport: jest.fn(),
}))

jest.mock('@/components/ai-quant/backtest-job-client', () => ({
  createBacktestJob: jest.fn(),
  getBacktestJob: jest.fn(),
  getBacktestJobResult: jest.fn(),
}))

jest.mock('@/lib/api', () => ({
  deployAccountAiQuantStrategy: jest.fn(),
  continueLlmCodegenSession: (...args: unknown[]) => mockContinueLlmCodegenSession(...args),
  fetchUserExchangeAccountStatuses: jest.fn(),
  getLlmCodegenSession: (...args: unknown[]) => mockGetLlmCodegenSession(...args),
  startLlmCodegenSession: jest.fn(),
}))

import {
  buildCodegenReplyContent,
  resolvePublishedStrategyInstanceId,
} from './ai-quant-page-codegen'
import { requestAiQuantCodegen } from './ai-quant-page-codegen'
import {
  DEFAULT_PARAMS,
  DEFAULT_PARAM_SCHEMA,
  DEFAULT_PARAM_VALUES,
} from './ai-quant-page-conversation'

describe('AiQuantPageClient codegen P1 guards', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('clears publishedStrategyInstanceId on fallback status or new session start', () => {
    const rejected = resolvePublishedStrategyInstanceId({
      response: {
        id: 's1',
        status: 'REJECTED',
        rejectReason: 'runtime error',
      },
      isStartingNewSession: false,
    })
    const newSessionStart = resolvePublishedStrategyInstanceId({
      response: {
        id: 's2',
        status: 'DRAFTING',
      },
      isStartingNewSession: true,
    })

    expect(rejected).toBeNull()
    expect(newSessionStart).toBeNull()
  })

  it('shows failure message when published carries rejectReason', () => {
    const content = buildCodegenReplyContent({
      response: {
        id: 's3',
        status: 'PUBLISHED',
        rejectReason: 'create instance failed',
      },
      confirmGenerate: true,
      publishedReply: '发布成功',
      graphGeneratedMessage: '已生成',
      graphReviseMessage: '请继续补充',
      checklistContinuedMessage: '继续检查',
      checklistUpdatedMessage: '已更新逻辑图',
      stillGeneratingPrefix: '生成中',
      rejectedPrefix: '生成失败',
      rejectedWithoutReason: '失败（无原因）',
    })

    expect(content).toContain('生成失败')
    expect(content).toContain('create instance failed')
    expect(content).not.toBe('发布成功')
  })

  it('prefers rejectReason when publication gate blocks publish', () => {
    const content = buildCodegenReplyContent({
      response: {
        id: 's4',
        status: 'REJECTED',
        rejectReason: 'positionMode mismatch',
        publicationGate: {
          passed: false,
          blockingMismatches: [
            {
              field: 'positionMode',
              expected: 'long_only',
              actual: 'long_short',
              reason: 'confirmed positionMode and compiled artifact mismatch',
            },
          ],
        },
      },
      confirmGenerate: true,
      publishedReply: '发布成功',
      graphGeneratedMessage: '已生成',
      graphReviseMessage: '请继续补充',
      checklistContinuedMessage: '继续检查',
      checklistUpdatedMessage: '已更新逻辑图',
      stillGeneratingPrefix: '生成中',
      rejectedPrefix: '生成失败',
      rejectedWithoutReason: '失败（无原因）',
    })

    expect(content).toContain('生成失败')
    expect(content).toContain('positionMode mismatch')
    expect(content).not.toBe('失败（无原因）')
  })

  it('reconciles only the active session before confirmGenerate and does not fan out to unrelated sessions', async () => {
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
    const secondaryConversation = {
      ...primaryConversation,
      id: 'conv-2',
      title: 'conv-2',
      llmCodegenSessionId: 'session-2',
      pendingCanonicalDigest: 'sha256:canonical-2',
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
      conversations: [primaryConversation, secondaryConversation] as any,
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
