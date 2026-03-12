import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { LiveLlmStrategyInstancesController } from './controllers/live-llm-strategy-instances.controller'
import { OpsLlmStrategiesController } from './controllers/ops-llm-strategies.controller'
import { LiveLlmStrategyInstancesService } from './services/live-llm-strategy-instances.service'
import { LlmStrategiesService } from './services/llm-strategies.service'

jest.mock('@prisma/client', () => ({
  LlmStrategyStatus: {
    draft: 'draft',
    live: 'live',
    archived: 'archived',
  },
  LlmStrategyInstanceMode: {
    LIVE: 'LIVE',
    PAPER: 'PAPER',
    BACKTEST: 'BACKTEST',
  },
  LlmStrategyInstanceStatus: {
    running: 'running',
    paused: 'paused',
    stopped: 'stopped',
  },
}))

jest.mock('./services/llm-strategies.service', () => ({
  LlmStrategiesService: class LlmStrategiesService {},
}))

jest.mock('./services/live-llm-strategy-instances.service', () => ({
  LiveLlmStrategyInstancesService: class LiveLlmStrategyInstancesService {},
}))

describe('llmStrategyControllers', () => {
  let app: INestApplication

  const llmStrategiesService = {
    list: jest.fn(),
    getDetail: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }

  const userInstancesService = {
    listRunningInstances: jest.fn(),
    getRunningInstanceDetail: jest.fn(),
    getRunningInstanceSignals: jest.fn(),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OpsLlmStrategiesController, LiveLlmStrategyInstancesController],
      providers: [
        {
          provide: LlmStrategiesService,
          useValue: llmStrategiesService,
        },
        {
          provide: LiveLlmStrategyInstancesService,
          useValue: userInstancesService,
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

  it('accepts explicit createdBy when creating llm strategies', async () => {
    llmStrategiesService.create.mockResolvedValue({ id: 'strategy-1' })

    await request(app.getHttpServer())
      .post('/ops/llm-strategies')
      .send({
        name: 'alpha-scout',
        description: 'scan market structure',
        createdBy: 'operator-1',
      })
      .expect(201)

    expect(llmStrategiesService.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'alpha-scout', createdBy: 'operator-1' }),
      'operator-1',
    )
  })

  it('reads explicit userId from query when listing llm strategy instances', async () => {
    userInstancesService.listRunningInstances.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })

    await request(app.getHttpServer())
      .get('/llm-strategy-instances')
      .query({ userId: 'user-1', page: 1, limit: 20 })
      .expect(200)

    expect(userInstancesService.listRunningInstances).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', page: 1, limit: 20 }),
      'user-1',
    )
  })

  it('requires explicit userId when listing llm strategy signals', async () => {
    await request(app.getHttpServer())
      .get('/llm-strategy-instances/instance-1/signals')
      .query({ page: 1, limit: 20 })
      .expect(400)
  })
})
