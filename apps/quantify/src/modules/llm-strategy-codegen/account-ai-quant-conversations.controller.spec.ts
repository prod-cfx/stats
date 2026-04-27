import { Test } from '@nestjs/testing'
import { EnvService } from '@/common/services/env.service'
import { AccountAiQuantConversationsController } from './controllers/account-ai-quant-conversations.controller'
import { CallerIdentityService } from './services/caller-identity.service'
import { CodegenConversationService } from './services/codegen-conversation.service'

function createBearerToken(payload: Record<string, unknown>): string {
  const encodedHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `Bearer ${encodedHeader}.${encodedPayload}.signature`
}

describe('accountAiQuantConversationsController', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'caller-u1' }),
    }) as unknown as typeof fetch
  })

  afterAll(() => {
    globalThis.fetch = originalFetch
  })

  it('lists AI Quant conversations for the resolved caller identity', async () => {
    const service = {
      listConversations: jest.fn().mockResolvedValue([{
        id: 'conv-1',
        activeCodegenSessionId: 'session-1',
        lastBacktestRef: {
          jobId: 'btjob-1',
          publishedSnapshotId: 'snapshot-1',
          summary: { maxDrawdownPct: 8, totalReturnPct: 12, winRatePct: 60, tradeCount: 5 },
          completedAt: '2026-04-23T00:04:00.000Z',
        },
      }]),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [AccountAiQuantConversationsController],
      providers: [
        { provide: CodegenConversationService, useValue: service },
        {
          provide: EnvService,
          useValue: {
            getString: jest.fn((key: string) => {
              if (key === 'BACKEND_API_BASE_URL') return 'http://backend.test/api/v1'
              return undefined
            }),
            getBoolean: jest.fn().mockReturnValue(false),
            isDev: jest.fn().mockReturnValue(false),
          },
        },
        CallerIdentityService,
      ],
    }).compile()
    const controller = moduleRef.get(AccountAiQuantConversationsController)

    const result = await controller.list(
      createBearerToken({ sub: 'caller-u1', principalType: 'user', exp: 4_102_444_800 }),
      'caller-u1',
    )

    expect(result).toEqual([{
      id: 'conv-1',
      activeCodegenSessionId: 'session-1',
      lastBacktestRef: {
        jobId: 'btjob-1',
        publishedSnapshotId: 'snapshot-1',
        summary: { maxDrawdownPct: 8, totalReturnPct: 12, winRatePct: 60, tradeCount: 5 },
        completedAt: '2026-04-23T00:04:00.000Z',
      },
    }])
    expect(service.listConversations).toHaveBeenCalledWith('caller-u1')
  })

  it('deletes AI Quant conversations for the resolved caller identity', async () => {
    const service = {
      deleteConversation: jest.fn().mockResolvedValue(undefined),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [AccountAiQuantConversationsController],
      providers: [
        { provide: CodegenConversationService, useValue: service },
        {
          provide: EnvService,
          useValue: {
            getString: jest.fn((key: string) => {
              if (key === 'BACKEND_API_BASE_URL') return 'http://backend.test/api/v1'
              return undefined
            }),
            getBoolean: jest.fn().mockReturnValue(false),
            isDev: jest.fn().mockReturnValue(false),
          },
        },
        CallerIdentityService,
      ],
    }).compile()
    const controller = moduleRef.get(AccountAiQuantConversationsController)

    await controller.remove(
      createBearerToken({ sub: 'caller-u1', principalType: 'user', exp: 4_102_444_800 }),
      'caller-u1',
      'conv-1',
      undefined,
    )

    expect(service.deleteConversation).toHaveBeenCalledWith('conv-1', 'caller-u1', {
      deleteStoppedStrategy: false,
    })
  })

  it('recovers an edit conversation for the resolved caller identity', async () => {
    const service = {
      recoverEditConversation: jest.fn().mockResolvedValue({ id: 'conversation-1' }),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [AccountAiQuantConversationsController],
      providers: [
        { provide: CodegenConversationService, useValue: service },
        {
          provide: EnvService,
          useValue: {
            getString: jest.fn((key: string) => {
              if (key === 'BACKEND_API_BASE_URL') return 'http://backend.test/api/v1'
              return undefined
            }),
            getBoolean: jest.fn().mockReturnValue(false),
            isDev: jest.fn().mockReturnValue(false),
          },
        },
        CallerIdentityService,
      ],
    }).compile()
    const controller = moduleRef.get(AccountAiQuantConversationsController)

    await expect(controller.recoverEditSession(
      createBearerToken({ sub: 'caller-u1', principalType: 'user', exp: 4_102_444_800 }),
      'caller-u1',
      {
        strategyInstanceId: 'strategy-1',
        publishedSnapshotId: 'snapshot-1',
        source: 'account-detail',
      },
    )).resolves.toEqual({ id: 'conversation-1' })

    expect(service.recoverEditConversation).toHaveBeenCalledWith('caller-u1', {
      strategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-1',
      source: 'account-detail',
    })
  })
})
