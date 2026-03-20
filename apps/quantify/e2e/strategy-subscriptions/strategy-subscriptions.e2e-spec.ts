import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { PrismaService } from '@/prisma/prisma.service'

import type { PrismaClient, User } from '@/prisma/prisma.types'
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

    // 创建测试用户
    testUser = await seedUser('e2e-subscriber@test.com', 'Test123!')

    // 创建一个可订阅的 live 策略模板，带 requiredFields
    const strategyTemplate = await prismaClient.strategyTemplate.create({
      data: {
        name: 'E2E-Test-Subscribable-Strategy',
        description: 'E2E 测试用可订阅策略',
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

    // 创建一个运行中的策略实例
    const strategyInstance = await prismaClient.strategyInstance.create({
      data: {
        strategyTemplateId: liveStrategyTemplateId,
        name: 'E2E-Test-Running-Instance',
        description: 'E2E 测试用运行实例',
        llmModel: 'gpt-4',
        status: 'running',
        mode: 'LIVE',
      },
    })

    runningStrategyInstanceId = strategyInstance.id
  })

  afterAll(async () => {
    // 清理订阅、策略和用户
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

    // 第一次订阅（如果不存在则创建）
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

    // 第二次订阅同一策略实例，应返回 409 + SUBSCRIPTION_ALREADY_EXISTS
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
          // 缺少 ma_20
        },
      })
      .expect(400)

    expect(response.body.error.code).toBe(ErrorCode.SUBSCRIPTION_INVALID_PARAMS)
    expect(response.body.error.args?.reason).toBe('MISSING_REQUIRED_FIELDS')
    expect(response.body.error.args?.missingFields).toContain('ma_20')
  })

  it('should return SUBSCRIPTION_INVALID_PARAMS when updating with invalid params', async () => {
    const request = createApiClient(app)

    // 先保证存在一个合法订阅
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
          // 缺少 ma_20
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
