import { createHmac } from 'node:crypto'
import { Test } from '@nestjs/testing'
import { DomainException } from '@/common/exceptions/domain.exception'
import { EnvService } from '@/common/services/env.service'

import { LiveLlmStrategyCodegenController } from './controllers/live-llm-strategy-codegen.controller'
import { CodegenConversationService } from './services/codegen-conversation.service'

const TEST_APP_SECRET = 'engine-test-secret'
const TEST_JWT_SECRET = 'quantify-jwt-secret'

function createBearerToken(payload: Record<string, unknown>, secret = TEST_JWT_SECRET): string {
  const encodedHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signingInput = `${encodedHeader}.${encodedPayload}`
  const signature = createHmac('sha256', secret).update(signingInput).digest('base64url')
  return `Bearer ${signingInput}.${signature}`
}

function createMockEnvService() {
  return {
    getString: jest.fn((key: string) => {
      if (key === 'APP_SECRET') return TEST_APP_SECRET
      if (key === 'JWT_SECRET') return TEST_JWT_SECRET
      return undefined
    }),
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
      getSession: jest.fn(),
      testEngine: jest.fn(),
    }

    const moduleRef = await Test.createTestingModule({
      controllers: [LiveLlmStrategyCodegenController],
      providers: buildProviders(service),
    }).compile()

    const controller = moduleRef.get(LiveLlmStrategyCodegenController)

    const result = await controller.startSession(
      createBearerToken({ sub: 'caller-u1', exp: 4_102_444_800 }),
      { userId: 'request-u2' },
    )

    expect(result.status).toBe('DRAFTING')
    expect(service.startSession).toHaveBeenCalledWith({ userId: 'request-u2' }, 'caller-u1')
  })

  it('rejects startSession when authorization header is missing', async () => {
    const service = {
      startSession: jest.fn(),
      continueSession: jest.fn(),
      getSession: jest.fn(),
      testEngine: jest.fn(),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [LiveLlmStrategyCodegenController],
      providers: buildProviders(service),
    }).compile()
    const controller = moduleRef.get(LiveLlmStrategyCodegenController)

    await expect(controller.startSession(undefined, { userId: 'u1' })).rejects.toBeInstanceOf(DomainException)
    expect(service.startSession).not.toHaveBeenCalled()
  })

  it('continues session with caller identity from authorization', async () => {
    const service = {
      startSession: jest.fn(),
      continueSession: jest.fn().mockResolvedValue({ id: 's1', status: 'DRAFTING' }),
      getSession: jest.fn(),
      testEngine: jest.fn(),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [LiveLlmStrategyCodegenController],
      providers: buildProviders(service),
    }).compile()
    const controller = moduleRef.get(LiveLlmStrategyCodegenController)

    const result = await controller.continueSession(
      createBearerToken({ sub: 'caller-u1', exp: 4_102_444_800 }),
      's1',
      { userId: 'request-u2', message: '继续' },
    )

    expect(result.status).toBe('DRAFTING')
    expect(service.continueSession).toHaveBeenCalledWith('s1', { userId: 'request-u2', message: '继续' }, 'caller-u1')
  })

  it('rejects testEngine when token is missing', async () => {
    const service = {
      startSession: jest.fn(),
      continueSession: jest.fn(),
      getSession: jest.fn(),
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
      getSession: jest.fn(),
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
      getSession: jest.fn(),
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

  it('loads session snapshot by id', async () => {
    const service = {
      startSession: jest.fn(),
      continueSession: jest.fn(),
      getSession: jest.fn().mockResolvedValue({ id: 's1', status: 'PUBLISHED', scriptCode: 'strategy' }),
      testEngine: jest.fn(),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [LiveLlmStrategyCodegenController],
      providers: buildProviders(service),
    }).compile()
    const controller = moduleRef.get(LiveLlmStrategyCodegenController)

    const result = await controller.getSession('s1', createBearerToken({ sub: 'u1', exp: 4_102_444_800 }))

    expect(result.status).toBe('PUBLISHED')
    expect(service.getSession).toHaveBeenCalledWith('s1', 'u1')
  })

  it('rejects getSession when authorization header is missing', async () => {
    const service = {
      startSession: jest.fn(),
      continueSession: jest.fn(),
      getSession: jest.fn(),
      testEngine: jest.fn(),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [LiveLlmStrategyCodegenController],
      providers: buildProviders(service),
    }).compile()
    const controller = moduleRef.get(LiveLlmStrategyCodegenController)

    await expect(controller.getSession('s1', undefined)).rejects.toBeInstanceOf(DomainException)
    expect(service.getSession).not.toHaveBeenCalled()
  })

  it('rejects getSession when token signature is invalid', async () => {
    const service = {
      startSession: jest.fn(),
      continueSession: jest.fn(),
      getSession: jest.fn(),
      testEngine: jest.fn(),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [LiveLlmStrategyCodegenController],
      providers: buildProviders(service),
    }).compile()
    const controller = moduleRef.get(LiveLlmStrategyCodegenController)

    await expect(controller.getSession('s1', createBearerToken({ sub: 'u1' }, 'wrong-secret'))).rejects.toBeInstanceOf(
      DomainException,
    )
    expect(service.getSession).not.toHaveBeenCalled()
  })

  it('rejects getSession when jwt subject is missing', async () => {
    const service = {
      startSession: jest.fn(),
      continueSession: jest.fn(),
      getSession: jest.fn(),
      testEngine: jest.fn(),
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [LiveLlmStrategyCodegenController],
      providers: buildProviders(service),
    }).compile()
    const controller = moduleRef.get(LiveLlmStrategyCodegenController)

    await expect(
      controller.getSession('s1', createBearerToken({ exp: Math.floor(Date.now() / 1000) + 3600 })),
    ).rejects.toBeInstanceOf(DomainException)
    expect(service.getSession).not.toHaveBeenCalled()
  })
})
