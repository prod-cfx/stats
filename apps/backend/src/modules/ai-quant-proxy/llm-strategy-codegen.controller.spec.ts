import { LlmStrategyCodegenController } from './llm-strategy-codegen.controller'

describe('llmStrategyCodegenController', () => {
  it('forwards only semantic-era fields on startSession', async () => {
    const service = {
      startCodegen: jest.fn().mockResolvedValue({ id: 'session-1', status: 'DRAFTING' }),
    }
    const controller = new LlmStrategyCodegenController(service as never)

    await controller.startSession('user-1', 'Bearer token-1', {
      initialMessage: 'build me a strategy',
      guideConfig: { symbolExample: 'BTCUSDT' },
    })

    expect(service.startCodegen).toHaveBeenCalledWith(
      'user-1',
      'Bearer token-1',
      {
        initialMessage: 'build me a strategy',
        guideConfig: { symbolExample: 'BTCUSDT' },
      },
    )
  })

  it('forwards confirmedCanonicalDigest on continueSession', async () => {
    const service = {
      continueCodegen: jest.fn().mockResolvedValue({ id: 'session-1', status: 'CHECKLIST_GATE' }),
    }
    const controller = new LlmStrategyCodegenController(service as never)

    await controller.continueSession('user-1', 'Bearer token-1', 'session-1', {
      message: '确认逻辑图',
      confirmGenerate: true,
      confirmedCanonicalDigest: 'sha256:canonical-1',
    })

    expect(service.continueCodegen).toHaveBeenCalledWith(
      'user-1',
      'Bearer token-1',
      'session-1',
      {
        message: '确认逻辑图',
        confirmGenerate: true,
        confirmedCanonicalDigest: 'sha256:canonical-1',
      },
    )
  })

  it('forwards only semantic-era fields on continueSession', async () => {
    const service = {
      continueCodegen: jest.fn().mockResolvedValue({ id: 'session-1', status: 'DRAFTING' }),
    }
    const controller = new LlmStrategyCodegenController(service as never)

    await controller.continueSession('user-1', 'Bearer token-1', 'session-1', {
      message: '回答澄清',
      clarificationAnswers: {
        'entry.side': 'short',
        'market.marketType': 'perp',
      },
    } as never)

    expect(service.continueCodegen).toHaveBeenCalledWith(
      'user-1',
      'Bearer token-1',
      'session-1',
      {
        message: '回答澄清',
        clarificationAnswers: {
          'entry.side': 'short',
          'market.marketType': 'perp',
        },
      },
    )
  })
})
