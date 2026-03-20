import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { StrategySubscriptionsController } from './strategy-subscriptions.controller'
import { StrategySubscriptionsService } from './strategy-subscriptions.service'

jest.mock('./strategy-subscriptions.service', () => ({
  StrategySubscriptionsService: class StrategySubscriptionsService {},
}))

describe('userStrategySubscriptionsController', () => {
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
      controllers: [StrategySubscriptionsController],
      providers: [
        {
          provide: StrategySubscriptionsService,
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

  it('accepts explicit userId in subscription create body without bearer token', async () => {
    service.subscribe.mockResolvedValue({ id: 'sub-1', status: 'active' })

    await request(app.getHttpServer())
      .post('/strategy-subscriptions')
      .send({
        userId: 'user-1',
        strategyInstanceId: 'instance-1',
        customParams: { price_close: 100 },
      })
      .expect(201)

    expect(service.subscribe).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        strategyInstanceId: 'instance-1',
        customParams: { price_close: 100 },
      }),
    )
  })

  it('reads explicit userId from query when listing subscriptions', async () => {
    service.listMySubscriptions.mockResolvedValue({ total: 0, page: 1, limit: 20, items: [] })

    await request(app.getHttpServer())
      .get('/strategy-subscriptions')
      .query({ userId: 'user-2', page: 1, limit: 20 })
      .expect(200)

    expect(service.listMySubscriptions).toHaveBeenCalledWith(
      'user-2',
      expect.objectContaining({ page: 1, limit: 20 }),
    )
  })

  it('accepts explicit userId in update body', async () => {
    service.updateSubscription.mockResolvedValue({ id: 'sub-2', status: 'paused' })

    await request(app.getHttpServer())
      .patch('/strategy-subscriptions/sub-2')
      .send({
        userId: 'user-3',
        status: 'paused',
      })
      .expect(200)

    expect(service.updateSubscription).toHaveBeenCalledWith(
      'user-3',
      'sub-2',
      expect.objectContaining({ status: 'paused' }),
    )
  })

  it('reads explicit userId from query when cancelling subscription', async () => {
    service.cancelSubscription.mockResolvedValue(undefined)

    await request(app.getHttpServer())
      .delete('/strategy-subscriptions/sub-9')
      .query({ userId: 'user-4' })
      .expect(200)

    expect(service.cancelSubscription).toHaveBeenCalledWith('user-4', 'sub-9')
  })
})
