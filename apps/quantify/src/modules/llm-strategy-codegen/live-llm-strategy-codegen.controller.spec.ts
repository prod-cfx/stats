import { Test } from '@nestjs/testing'
import { DomainException } from '@/common/exceptions/domain.exception'
import { EnvService } from '@/common/services/env.service'

import { LiveLlmStrategyCodegenController } from './controllers/live-llm-strategy-codegen.controller'
import { CodegenConversationService } from './services/codegen-conversation.service'

const TEST_APP_SECRET = 'engine-test-secret'

function createMockEnvService() {
  return {
    getString: jest.fn((key: string) => (key === 'APP_SECRET' ? TEST_APP_SECRET : undefined)),
    isDev: jest.fn().mockReturnValue(false),
    isProd: jest.fn().mockReturnValue(false),
    isTest: jest.fn().mockReturnValue(true),
  }
}

function buildProviders(service: Record<string, jest.Mock>, envService = createMockEnvService()) {
  return [
    { provide: CodegenConversationService, useValue: service },
    { provide: EnvService, useValue: envService },
  ]
}

describe('liveLlmStrategyCodegenController', () => {
  it('creates session in drafting status', async () => {
    const service = {
      startSession: jest.fn().mockResolvedValue({ id: 's1', status: 'DRAFTING' }),
      continueSession: jest.fn(),
      testEngine: jest.fn(),
    }

    const moduleRef = await Test.createTestingModule({
      controllers: [LiveLlmStrategyCodegenController],
      providers: buildProviders(service),
    }).compile()

    const controller = moduleRef.get(LiveLlmStrategyCodegenController)

    const result = await controller.startSession({ userId: 'u1' })

    expect(result.status).toBe('DRAFTING')
    expect(service.startSession).toHaveBeenCalled()
  })

  it('rejects testEngine when token is missing', async () => {
    const service = {
      startSession: jest.fn(),
      continueSession: jest.fn(),
      testEngine: jest.fn(),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [LiveLlmStrategyCodegenController],
      providers: buildProviders(service),
    }).compile()
    const controller = moduleRef.get(LiveLlmStrategyCodegenController)

    await expect(controller.testEngine(undefined, 'u1', { userId: 'u1', message: 'test' })).rejects.toBeInstanceOf(
      DomainException,
    )
    expect(service.testEngine).not.toHaveBeenCalled()
  })

  it('rejects testEngine when caller identity header is missing', async () => {
    const service = {
      startSession: jest.fn(),
      continueSession: jest.fn(),
      testEngine: jest.fn(),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [LiveLlmStrategyCodegenController],
      providers: buildProviders(service),
    }).compile()
    const controller = moduleRef.get(LiveLlmStrategyCodegenController)

    await expect(
      controller.testEngine(TEST_APP_SECRET, undefined, { userId: 'u1', message: 'test' }),
    ).rejects.toBeInstanceOf(DomainException)
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
      providers: buildProviders(service),
    }).compile()
    const controller = moduleRef.get(LiveLlmStrategyCodegenController)

    await expect(
      controller.testEngine(TEST_APP_SECRET, 'u2', { userId: 'u1', message: 'test' }),
    ).rejects.toBeInstanceOf(DomainException)
    expect(service.testEngine).not.toHaveBeenCalled()
  })
})
