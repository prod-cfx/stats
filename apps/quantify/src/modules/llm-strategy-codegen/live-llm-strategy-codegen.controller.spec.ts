import { Test } from '@nestjs/testing'
import { DomainException } from '@/common/exceptions/domain.exception'

import { LiveLlmStrategyCodegenController } from './controllers/live-llm-strategy-codegen.controller'
import { CodegenConversationService } from './services/codegen-conversation.service'

describe('liveLlmStrategyCodegenController', () => {
  it('creates session in drafting status', async () => {
    const service = {
      startSession: jest.fn().mockResolvedValue({ id: 's1', status: 'DRAFTING' }),
      continueSession: jest.fn(),
      testEngine: jest.fn(),
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

  it('rejects testEngine when caller identity header is missing', async () => {
    const service = {
      startSession: jest.fn(),
      continueSession: jest.fn(),
      testEngine: jest.fn(),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [LiveLlmStrategyCodegenController],
      providers: [{ provide: CodegenConversationService, useValue: service }],
    }).compile()
    const controller = moduleRef.get(LiveLlmStrategyCodegenController)

    await expect(controller.testEngine(undefined, { userId: 'u1', message: 'test' })).rejects.toBeInstanceOf(DomainException)
    expect(service.testEngine).not.toHaveBeenCalled()
  })

  it('rejects testEngine when caller identity does not match dto.userId', async () => {
    const service = {
      startSession: jest.fn(),
      continueSession: jest.fn(),
      testEngine: jest.fn(),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [LiveLlmStrategyCodegenController],
      providers: [{ provide: CodegenConversationService, useValue: service }],
    }).compile()
    const controller = moduleRef.get(LiveLlmStrategyCodegenController)

    await expect(controller.testEngine('u2', { userId: 'u1', message: 'test' })).rejects.toBeInstanceOf(DomainException)
    expect(service.testEngine).not.toHaveBeenCalled()
  })
})
