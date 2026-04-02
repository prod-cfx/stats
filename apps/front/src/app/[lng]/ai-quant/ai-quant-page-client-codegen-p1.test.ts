import { describe, expect, it, jest } from '@jest/globals'

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
  continueLlmCodegenSession: jest.fn(),
  fetchUserExchangeAccountStatuses: jest.fn(),
  getLlmCodegenSession: jest.fn(),
  startLlmCodegenSession: jest.fn(),
}))

import {
  buildCodegenReplyContent,
  resolvePublishedStrategyInstanceId,
} from './AiQuantPageClient'

describe('AiQuantPageClient codegen P1 guards', () => {
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
})
