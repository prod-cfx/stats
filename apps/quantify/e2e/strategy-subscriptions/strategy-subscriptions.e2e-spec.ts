import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { PrismaClient, User } from '@prisma/client'

import type { PrismaService } from '@/prisma/prisma.service'
import { ErrorCode } from '@ai/shared'
import {
  createApiClient,
  createTestingApp,
} from '../fixtures/fixtures'

describe('UserStrategySubscriptionsController (E2E)', () => {
  let app: INestApplication
  let _moduleFixture: TestingModule
  let prismaService: PrismaService
  let prismaClient: PrismaClient

  let testUser: User
  let liveStrategyTemplateId: string
  let runningStrategyInstanceId: string

  beforeAll(async () => {
    const testing = await createTestingApp()
    app = testing.app
    _moduleFixture = testing.moduleFixture
    prismaService = testing.prisma
    prismaClient = prismaService.getClient() as PrismaClient

    // 鍒涘缓娴嬭瘯鐢ㄦ埛
    testUser = await seedUser('e2e-subscriber@test.com', 'Test123!')

    // 鍒涘缓涓€涓彲璁㈤槄鐨?live 绛栫暐妯℃澘锛屽甫 requiredFields
    const strategyTemplate = await prismaClient.strategyTemplate.create({
      data: {
        name: 'E2E-Test-Subscribable-Strategy',
        description: 'E2E 娴嬭瘯鐢ㄥ彲璁㈤槄绛栫暐',
        legs: [{ id: 'leg_main', role: 'primary' }],
        llmModel: 'gpt-4',
        promptTemplate: 'test prompt',
        paramsSchema: {
          type: 'object',
          properties: {
            price_close: { type: 'number' },
            ma_20: { type: 'number' },
          },
        },
        requiredFields: ['price_close', 'ma_20'],
        status: 'live',
      },
    })

    liveStrategyTemplateId = strategyTemplate.id

    // 鍒涘缓涓€涓繍琛屼腑鐨勭瓥鐣ュ疄渚?
    const strategyInstance = await prismaClient.strategyInstance.create({
      data: {
        strategyTemplateId: liveStrategyTemplateId,
        name: 'E2E-Test-Running-Instance',
        description: 'E2E test running instance',
        llmModel: 'gpt-4',
        status: 'running',
      },
    })

    runningStrategyInstanceId = strategyInstance.id
  })

  afterAll(async () => {
    // 娓呯悊璁㈤槄鍜岀瓥鐣ャ€佺敤鎴?
    await prismaClient.userStrategySubscription.deleteMany({
      where: {
        userId: testUser.id,
      },
    })

    await prismaClient.strategyInstance.deleteMany({
      where: {
        name: 'E2E-Test-Running-Instance',
      },
    })

    await prismaClient.strategyTemplate.deleteMany({
      where: {
        name: 'E2E-Test-Subscribable-Strategy',
      },
    })

    await prismaClient.user.deleteMany({
      where: {
        id: testUser.id,
      },
    })

    await app.close()
  })

  it('should create subscription successfully with running instance and valid params', async () => {
    const request = createApiClient(app)

    const response = await request
      .post('strategy-subscriptions')
      .send({
        userId: testUser.id,
        strategyInstanceId: runningStrategyInstanceId,
        customParams: {
          price_close: 100,
          ma_20: 95,
        },
      })
      .expect(201)

    const payload = response.body.data
    expect(payload).toBeDefined()
    expect(payload.strategyInstanceId).toBe(runningStrategyInstanceId)
    expect(payload.status).toBe('active')

    const dbRecord = await prismaClient.userStrategySubscription.findFirst({
      where: {
        userId: testUser.id,
        strategyInstanceId: runningStrategyInstanceId,
      },
    })
    expect(dbRecord).not.toBeNull()
  })

  it('should return SUBSCRIPTION_ALREADY_EXISTS when subscribing to same instance twice', async () => {
    const request = createApiClient(app)

    // 绗竴娆¤闃咃紙濡傛灉涓嶅瓨鍦ㄥ垯鍒涘缓锛?
    await request
      .post('strategy-subscriptions')
      .send({
        userId: testUser.id,
        strategyInstanceId: runningStrategyInstanceId,
        customParams: {
          price_close: 101,
          ma_20: 96,
        },
      })
      .expect(res => {
        expect([201, 409]).toContain(res.status)
      })

    // 绗簩娆¤闃呭悓涓€绛栫暐瀹炰緥锛屽簲杩斿洖 409 + SUBSCRIPTION_ALREADY_EXISTS
    const response = await request
      .post('strategy-subscriptions')
      .send({
        userId: testUser.id,
        strategyInstanceId: runningStrategyInstanceId,
        customParams: {
          price_close: 102,
          ma_20: 97,
        },
      })
      .expect(409)

    expect(response.body.error.code).toBe(ErrorCode.SUBSCRIPTION_ALREADY_EXISTS)
  })

  it('should return SUBSCRIPTION_INVALID_PARAMS when missing required fields', async () => {
    const request = createApiClient(app)

    const response = await request
      .post('strategy-subscriptions')
      .send({
        userId: testUser.id,
        strategyInstanceId: runningStrategyInstanceId,
        customParams: {
          price_close: 100,
          // 缂哄皯 ma_20
        },
      })
      .expect(400)

    expect(response.body.error.code).toBe(ErrorCode.SUBSCRIPTION_INVALID_PARAMS)
    expect(response.body.error.args?.reason).toBe('MISSING_REQUIRED_FIELDS')
    expect(response.body.error.args?.missingFields).toContain('ma_20')
  })

  it('should return SUBSCRIPTION_INVALID_PARAMS when updating with invalid params', async () => {
    const request = createApiClient(app)

    // 鍏堜繚璇佸瓨鍦ㄤ竴涓悎娉曡闃?
    const createResp = await request
      .post('strategy-subscriptions')
      .send({
        userId: testUser.id,
        strategyInstanceId: runningStrategyInstanceId,
        customParams: {
          price_close: 120,
          ma_20: 110,
        },
      })
      .expect(res => {
        expect([201, 409]).toContain(res.status)
      })

    const subId: string | undefined = createResp.body?.data?.id
      ?? (
        await prismaClient.userStrategySubscription.findFirstOrThrow({
          where: {
            userId: testUser.id,
            strategyInstanceId: runningStrategyInstanceId,
          },
        })
      ).id

    const response = await request
      .patch(`strategy-subscriptions/${subId}`)
      .send({
        userId: testUser.id,
        customParams: {
          price_close: 130,
          // 缂哄皯 ma_20
        },
      })
      .expect(400)

    expect(response.body.error.code).toBe(ErrorCode.SUBSCRIPTION_INVALID_PARAMS)
  })

  async function seedUser(email: string, password: string): Promise<User> {
    return prismaClient.user.create({
      data: {
        email,
        nickname: password ? 'seeded-user' : null,
      },
    })
  }
})
