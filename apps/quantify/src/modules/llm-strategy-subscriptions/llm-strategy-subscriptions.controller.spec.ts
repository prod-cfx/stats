import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { LlmStrategySubscriptionsController } from './llm-strategy-subscriptions.controller'
import { LlmStrategySubscriptionsService } from './llm-strategy-subscriptions.service'

jest.mock('./llm-strategy-subscriptions.service', () => ({
  LlmStrategySubscriptionsService: class LlmStrategySubscriptionsService {},
}))

describe('userLlmStrategySubscriptionsController', () => {
  let app: INestApplication
  const service = {
    subscribe: jest.fn(),
    listMySubscriptions: jest.fn(),
    getSubscriptionDetail: jest.fn(),
    updateSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [LlmStrategySubscriptionsController],
      providers: [
        {
          provide: LlmStrategySubscriptionsService,
          useValue: service,
        },
      ],
    }).compile()

    app = moduleRef.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
        transformOptions: {
          enableImplicitConversion: true,
        },
      }),
    )
    await app.init()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterAll(async () => {
    await app.close()
  })

  it('accepts explicit userId in llm subscription create body without bearer token', async () => {
    service.subscribe.mockResolvedValue({ id: 'llm-sub-1', status: 'active' })

    await request(app.getHttpServer())
      .post('/llm-strategy-subscriptions')
      .send({
        userId: 'user-1',
        llmStrategyInstanceId: 'llm-instance-1',
        exchangeAccountId: 'account-1',
      })
      .expect(201)

    expect(service.subscribe).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        llmStrategyInstanceId: 'llm-instance-1',
        exchangeAccountId: 'account-1',
      }),
    )
  })

  it('reads explicit userId from query when listing llm subscriptions', async () => {
    service.listMySubscriptions.mockResolvedValue({ total: 0, page: 1, limit: 20, items: [] })

    await request(app.getHttpServer())
      .get('/llm-strategy-subscriptions')
      .query({ userId: 'user-2', page: 1, limit: 20 })
      .expect(200)

    expect(service.listMySubscriptions).toHaveBeenCalledWith(
      'user-2',
      expect.objectContaining({ page: 1, limit: 20 }),
    )
  })

  it('accepts explicit userId in llm subscription update body', async () => {
    service.updateSubscription.mockResolvedValue({ id: 'llm-sub-2', status: 'paused' })

    await request(app.getHttpServer())
      .patch('/llm-strategy-subscriptions/llm-sub-2')
      .send({
        userId: 'user-3',
        status: 'paused',
      })
      .expect(200)

    expect(service.updateSubscription).toHaveBeenCalledWith(
      'user-3',
      'llm-sub-2',
      expect.objectContaining({ status: 'paused' }),
    )
  })

  it('reads explicit userId from query when cancelling llm subscription', async () => {
    service.cancelSubscription.mockResolvedValue(undefined)

    await request(app.getHttpServer())
      .delete('/llm-strategy-subscriptions/llm-sub-9')
      .query({ userId: 'user-4' })
      .expect(200)

    expect(service.cancelSubscription).toHaveBeenCalledWith('user-4', 'llm-sub-9')
  })
})
