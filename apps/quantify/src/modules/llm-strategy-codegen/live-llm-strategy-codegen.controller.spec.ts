import { Test } from '@nestjs/testing'
import { DomainException } from '@/common/exceptions/domain.exception'
import { EnvService } from '@/common/services/env.service'

import { LiveLlmStrategyCodegenController } from './controllers/live-llm-strategy-codegen.controller'
import { CallerIdentityService } from './services/caller-identity.service'
import { CodegenConversationService } from './services/codegen-conversation.service'

jest.mock('@nestjs-cls/transactional', () => ({
  Transactional: () => (_target: unknown, _propertyKey: string, descriptor: PropertyDescriptor) => descriptor,
}))

const TEST_APP_SECRET = 'engine-test-secret'

function createBearerToken(payload: Record<string, unknown>): string {
  const encodedHeader = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `Bearer ${encodedHeader}.${encodedPayload}.signature`
}

function createMockEnvService() {
  return {
    getString: jest.fn((key: string) => {
      if (key === 'APP_SECRET') return TEST_APP_SECRET
      if (key === 'BACKEND_API_BASE_URL') return 'http://backend.test/api/v1'
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
    CallerIdentityService,
  ]
}

describe('liveLlmStrategyCodegenController', () => {
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
      createBearerToken({ sub: 'caller-u1', principalType: 'user', exp: 4_102_444_800 }),
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
      createBearerToken({ sub: 'caller-u1', principalType: 'user', exp: 4_102_444_800 }),
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

    const result = await controller.getSession('s1', createBearerToken({ sub: 'u1', principalType: 'user', exp: 4_102_444_800 }))

    expect(result.status).toBe('PUBLISHED')
    expect(service.getSession).toHaveBeenCalledWith('s1', 'caller-u1')
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

  it('rejects getSession when principalType is not user', async () => {
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

    await expect(controller.getSession('s1', createBearerToken({ sub: 'u1', principalType: 'admin' }))).rejects.toBeInstanceOf(DomainException)
    expect(service.getSession).not.toHaveBeenCalled()
  })

  it('rejects getSession when backend verification fails', async () => {
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
    ;(globalThis.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({}),
    })

    await expect(controller.getSession('s1', createBearerToken({ sub: 'u1', principalType: 'user' }))).rejects.toBeInstanceOf(DomainException)
    expect(service.getSession).not.toHaveBeenCalled()
  })
})
