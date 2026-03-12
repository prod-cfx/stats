import { Test } from '@nestjs/testing'

import { LiveLlmStrategyCodegenController } from './controllers/live-llm-strategy-codegen.controller'
import { CodegenConversationService } from './services/codegen-conversation.service'

describe('liveLlmStrategyCodegenController', () => {
  it('creates session in drafting status', async () => {
    const service = {
      startSession: jest.fn().mockResolvedValue({ id: 's1', status: 'DRAFTING' }),
      continueSession: jest.fn(),
    }

    const moduleRef = await Test.createTestingModule({
      controllers: [LiveLlmStrategyCodegenController],
      providers: [{ provide: CodegenConversationService, useValue: service }],
    }).compile()

    const controller = moduleRef.get(LiveLlmStrategyCodegenController)

    const result = await controller.startSession({ userId: 'u1' })

    expect(result.status).toBe('DRAFTING')
    expect(service.startSession).toHaveBeenCalled()
  })
})
