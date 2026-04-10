import { AccountAiQuantConversationsController } from './account-ai-quant-conversations.controller'

describe('accountAiQuantConversationsController', () => {
  it('forwards AI Quant conversation list through the proxy service', async () => {
    const service = {
      listAiQuantConversations: jest.fn().mockResolvedValue([{ id: 'conv-1', activeCodegenSessionId: 'session-1' }]),
    }
    const controller = new AccountAiQuantConversationsController(service as never)

    const result = await controller.list('user-1', 'Bearer token-1')

    expect(result).toEqual([{ id: 'conv-1', activeCodegenSessionId: 'session-1' }])
    expect(service.listAiQuantConversations).toHaveBeenCalledWith('user-1', 'Bearer token-1')
  })
})
