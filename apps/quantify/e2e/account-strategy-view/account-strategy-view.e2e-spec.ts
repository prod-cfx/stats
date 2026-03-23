import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { PrismaService } from '@/prisma/prisma.service'
import type { PrismaClient, User } from '@/prisma/prisma.types'
import { createApiClient, createTestingApp } from '../fixtures/fixtures'

describe('account-strategy-view (E2E)', () => {
  let app: INestApplication
  let _moduleFixture: TestingModule
  let prismaService: PrismaService
  let prisma: PrismaClient

  let owner: User
  let subscriber: User
  let templateId: string
  let strategyRunningId: string
  let strategyPausedId: string

  beforeAll(async () => {
    const testing = await createTestingApp()
    app = testing.app
    _moduleFixture = testing.moduleFixture
    prismaService = testing.prisma
    prisma = prismaService.getClient() as PrismaClient

    owner = await prisma.user.create({
      data: {
        email: `account-strategy-owner-${Date.now()}@e2e.test`,
        nickname: 'owner',
      },
    })
    subscriber = await prisma.user.create({
      data: {
        email: `account-strategy-subscriber-${Date.now()}@e2e.test`,
        nickname: 'subscriber',
      },
    })

    const template = await prisma.strategyTemplate.create({
      data: {
        name: `E2E-Account-Strategy-Template-${Date.now()}`,
        description: 'Account strategy view e2e template',
        llmModel: 'gpt-4',
        promptTemplate: 'test prompt',
        paramsSchema: { type: 'object', properties: {} },
        defaultParams: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          timeframe: '15m',
          positionPct: 10,
        },
        status: 'live',
      },
    })
    templateId = template.id

    const running = await prisma.strategyInstance.create({
      data: {
        strategyTemplateId: templateId,
        name: `E2E-Account-Strategy-Running-${Date.now()}`,
        description: 'running strategy',
        llmModel: 'gpt-4',
        status: 'running',
        mode: 'LIVE',
        startedAt: new Date('2026-03-18T00:00:00.000Z'),
        createdBy: owner.id,
        updatedBy: owner.id,
      },
    })
    strategyRunningId = running.id

    const paused = await prisma.strategyInstance.create({
      data: {
        strategyTemplateId: templateId,
        name: `E2E-Account-Strategy-Paused-${Date.now()}`,
        description: 'paused strategy',
        llmModel: 'gpt-4',
        status: 'paused',
        mode: 'LIVE',
        startedAt: new Date('2026-03-18T00:00:00.000Z'),
        createdBy: owner.id,
        updatedBy: owner.id,
      },
    })
    strategyPausedId = paused.id

    await prisma.userStrategySubscription.createMany({
      data: [
        { userId: owner.id, strategyInstanceId: strategyRunningId, status: 'active' },
        { userId: owner.id, strategyInstanceId: strategyPausedId, status: 'active' },
      ],
    })

    const account = await prisma.userStrategyAccount.create({
      data: {
        userId: owner.id,
        strategyId: templateId,
        strategyName: 'account view strategy',
        baseCurrency: 'USDT',
        initialBalance: 10000,
        balance: 10320.12,
        equity: 10320.12,
        totalRealizedPnl: 300,
        totalUnrealizedPnl: 20.12,
      },
    })

    await prisma.strategyPnlDaily.createMany({
      data: [
        {
          userStrategyAccountId: account.id,
          date: new Date('2026-03-19T00:00:00.000Z'),
          equityStart: 10000,
          equityEnd: 10000,
          realizedPnl: 0,
          unrealizedPnl: 0,
          maxDrawdown: 0,
        },
        {
          userStrategyAccountId: account.id,
          date: new Date('2026-03-20T00:00:00.000Z'),
          equityStart: 10000,
          equityEnd: 9450,
          realizedPnl: 0,
          unrealizedPnl: -550,
          maxDrawdown: 5.5,
        },
      ],
    })
  })

  afterAll(async () => {
    await prisma.strategyPnlDaily.deleteMany({
      where: {
        account: {
          userId: owner.id,
          strategyId: templateId,
        },
      },
    })
    await prisma.userStrategyAccount.deleteMany({
      where: {
        userId: owner.id,
        strategyId: templateId,
      },
    })
    await prisma.userStrategySubscription.deleteMany({
      where: {
        userId: {
          in: [owner.id, subscriber.id],
        },
      },
    })
    await prisma.strategyInstance.deleteMany({
      where: {
        id: {
          in: [strategyRunningId, strategyPausedId],
        },
      },
    })
    await prisma.strategyTemplate.deleteMany({
      where: {
        id: templateId,
      },
    })
    await prisma.user.deleteMany({
      where: {
        id: {
          in: [owner.id, subscriber.id],
        },
      },
    })
    await app.close()
  })

  it('returns list data and maps paused to stopped in account view', async () => {
    const request = createApiClient(app)
    const response = await request
      .get(`account/ai-quant/strategies?userId=${owner.id}&page=1&limit=20`)
      .set('x-user-id', owner.id)
      .expect(200)

    const payload = response.body?.data ?? response.body
    expect(payload?.items?.length).toBeGreaterThanOrEqual(2)

    const pausedItem = payload.items.find((item: any) => item.id === strategyPausedId)
    expect(pausedItem).toBeDefined()
    expect(pausedItem.status).toBe('stopped')
  })

  it('returns detail payload with backend pnl metrics', async () => {
    const request = createApiClient(app)
    const response = await request
      .get(`account/ai-quant/strategies/${strategyRunningId}?userId=${owner.id}`)
      .set('x-user-id', owner.id)
      .expect(200)

    const payload = response.body?.data
    expect(payload.id).toBe(strategyRunningId)
    expect(payload.totalPnl).toBe(320.12)
    // todayPnl = realizedToday(no closed positions today) + totalUnrealizedPnl(20.12)
    expect(payload.todayPnl).toBe(20.12)
    expect(payload.metrics.maxDrawdownPct).toBe(5.5)
  })

  it('applies stop action and returns updated detail status', async () => {
    const request = createApiClient(app)
    const response = await request
      .post(`account/ai-quant/strategies/${strategyRunningId}/actions`)
      .set('x-user-id', owner.id)
      .send({
        userId: owner.id,
        action: 'stop',
      })
      .expect(201)

    const payload = response.body?.data
    expect(payload.id).toBe(strategyRunningId)
    expect(payload.status).toBe('stopped')
  })
})
