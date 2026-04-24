import { StrategyPlazaEditSessionService } from './strategy-plaza-edit-session.service'

describe('StrategyPlazaEditSessionService', () => {
  it('starts a codegen session from the official template edit seed', async () => {
    const template = {
      id: 'ma-cross',
      editSeed: {
        initialMessage: 'Build a MA cross strategy',
        guideConfig: { symbolExample: 'BTC-USDT-SWAP', timeframeExample: '15m' },
      },
    }
    const templates = {
      getRequired: jest.fn().mockReturnValue(template),
    }
    const codegenConversationService = {
      startSession: jest.fn().mockResolvedValue({ id: 'session-1' }),
    }
    const service = new StrategyPlazaEditSessionService(
      templates as never,
      codegenConversationService as never,
    )

    const result = await service.startEditSession({
      userId: 'user-1',
      templateId: 'ma-cross',
    })

    expect(templates.getRequired).toHaveBeenCalledWith('ma-cross')
    expect(codegenConversationService.startSession).toHaveBeenCalledWith({
      initialMessage: 'Build a MA cross strategy',
      guideConfig: { symbolExample: 'BTC-USDT-SWAP', timeframeExample: '15m' },
    }, 'user-1')
    expect(result).toEqual({
      sessionId: 'session-1',
      templateId: 'ma-cross',
      initialMessage: 'Build a MA cross strategy',
    })
  })
})
