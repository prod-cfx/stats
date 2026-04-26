import { DECORATORS } from '@nestjs/swagger/dist/constants'
import { AccountAiQuantConversationsController } from './account-ai-quant-conversations.controller'

describe('accountAiQuantConversationsController', () => {
  it('forwards AI Quant conversation list through the proxy service', async () => {
    const service = {
      listAiQuantConversations: jest.fn().mockResolvedValue([{
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
    const controller = new AccountAiQuantConversationsController(service as never)

    const result = await controller.list('user-1', 'Bearer token-1')

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
    expect(service.listAiQuantConversations).toHaveBeenCalledWith('user-1', 'Bearer token-1')
  })

  it('declares swagger metadata for the conversation list contract', () => {
    const operation = Reflect.getMetadata(DECORATORS.API_OPERATION, AccountAiQuantConversationsController.prototype.list)
    const response = Reflect.getMetadata(DECORATORS.API_RESPONSE, AccountAiQuantConversationsController.prototype.list)

    expect(operation).toMatchObject({
      summary: 'List AI Quant conversations from the backend proxy facade',
    })
    expect(response).toBeDefined()
  })

  it('forwards AI Quant conversation deletion through the proxy service', async () => {
    const service = {
      deleteAiQuantConversation: jest.fn().mockResolvedValue(undefined),
    }
    const controller = new AccountAiQuantConversationsController(service as never)

    await controller.remove('user-1', 'Bearer token-1', 'conv-1', undefined)

    expect(service.deleteAiQuantConversation).toHaveBeenCalledWith('user-1', 'Bearer token-1', 'conv-1', {
      deleteStoppedStrategy: false,
    })
  })

  it('forwards AI Quant backtest draft updates through the proxy service', async () => {
    const service = {
      updateAiQuantConversationBacktestDraft: jest.fn().mockResolvedValue(undefined),
    }
    const controller = new AccountAiQuantConversationsController(service as never)

    await controller.updateBacktestDraft('user-1', 'Bearer token-1', 'conv-1', {
      backtestDraftConfig: {
        range: { preset: '7D' },
        execution: {
          initialCash: 10000,
          leverage: null,
          slippageBps: 10,
          feeBps: 5,
          priceSource: 'close',
          allowPartial: false,
        },
      },
    } as never)

    expect(service.updateAiQuantConversationBacktestDraft).toHaveBeenCalledWith(
      'user-1',
      'Bearer token-1',
      'conv-1',
      {
        backtestDraftConfig: {
          range: { preset: '7D' },
          execution: {
            initialCash: 10000,
            leverage: null,
            slippageBps: 10,
            feeBps: 5,
            priceSource: 'close',
            allowPartial: false,
          },
        },
      },
    )
  })
})
