import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'

import { SignalGeneratorService } from '@/modules/strategy-signals/services/signal-generator.service'

import { LiveStrategyInstancesController } from './controllers/live-strategy-instances.controller'
import { OpsStrategyInstancesController } from './controllers/ops-strategy-instances.controller'
import { StrategyInstancesService } from './services/strategy-instances.service'

jest.mock('@/prisma/prisma.types', () => ({
  StrategyInstanceMode: {
    BACKTEST: 'BACKTEST',
    PAPER: 'PAPER',
    TESTNET: 'TESTNET',
    LIVE: 'LIVE',
  },
  StrategyInstanceStatus: {
    DRAFT: 'DRAFT',
    RUNNING: 'RUNNING',
    PAUSED: 'PAUSED',
    STOPPED: 'STOPPED',
  },
}))

jest.mock('./services/strategy-instances.service', () => ({
  StrategyInstancesService: class StrategyInstancesService {},
}))

jest.mock('@/modules/strategy-signals/services/signal-generator.service', () => ({
  SignalGeneratorService: class SignalGeneratorService {},
}))

describe('strategyInstancesControllers', () => {
  let app: INestApplication

  const instancesService = {
    createInstance: jest.fn(),
    updateInstance: jest.fn(),
    listRunningInstances: jest.fn(),
    getRunningInstanceDetail: jest.fn(),
    getRunningInstanceSignals: jest.fn(),
  }

  const signalGenerator = {
    validateManualTriggerTarget: jest.fn(),
    generateSignalForInstance: jest.fn(),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OpsStrategyInstancesController, LiveStrategyInstancesController],
      providers: [
        {
          provide: StrategyInstancesService,
          useValue: instancesService,
        },
        {
          provide: SignalGeneratorService,
          useValue: signalGenerator,
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

  it('accepts explicit createdBy when creating strategy instances', async () => {
    instancesService.createInstance.mockResolvedValue({ id: 'instance-1' })

    await request(app.getHttpServer())
      .post('/ops/strategy-instances')
      .send({
        strategyTemplateId: 'template-1',
        name: 'mean-reversion',
        llmModel: 'gpt-4',
        createdBy: 'operator-1',
      })
      .expect(201)

    expect(instancesService.createInstance).toHaveBeenCalledWith(
      expect.objectContaining({ strategyTemplateId: 'template-1', createdBy: 'operator-1' }),
      'operator-1',
    )
  })

  it('reads explicit userId from query when listing running strategy instances', async () => {
    instancesService.listRunningInstances.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })

    await request(app.getHttpServer())
      .get('/strategy-instances')
      .query({ userId: 'user-1', page: 1, limit: 20 })
      .expect(200)

    expect(instancesService.listRunningInstances).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', page: 1, limit: 20 }),
      'user-1',
    )
  })

  it('requires explicit userId when listing strategy instance signals', async () => {
    await request(app.getHttpServer())
      .get('/strategy-instances/instance-1/signals')
      .query({ page: 1, limit: 20 })
      .expect(400)
  })

  it('passes explicit userId when listing strategy instance signals', async () => {
    instancesService.getRunningInstanceSignals.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })

    await request(app.getHttpServer())
      .get('/strategy-instances/instance-1/signals')
      .query({ userId: 'user-2', page: 1, limit: 20 })
      .expect(200)

    expect(instancesService.getRunningInstanceSignals).toHaveBeenCalledWith(
      'instance-1',
      expect.objectContaining({ userId: 'user-2', page: 1, limit: 20 }),
      'user-2',
    )
  })

  it('post /ops/strategy-instances/:id/generate-signal validates then triggers async generation', async () => {
    signalGenerator.validateManualTriggerTarget.mockResolvedValue(undefined)
    signalGenerator.generateSignalForInstance.mockResolvedValue(undefined)

    await request(app.getHttpServer())
      .post('/ops/strategy-instances/instance-1/generate-signal')
      .expect(200)
      .expect((res) => {
        expect(res.body.instanceId).toBe('instance-1')
      })

    expect(signalGenerator.validateManualTriggerTarget).toHaveBeenCalledWith('instance-1')

    await new Promise(resolve => setImmediate(resolve))

    expect(signalGenerator.generateSignalForInstance).toHaveBeenCalledWith('instance-1', { skipCooldown: true })
  })

  it('post /ops/strategy-instances/:id/generate-signal maps missing instance to 404', async () => {
    signalGenerator.validateManualTriggerTarget.mockRejectedValue(new Error('Strategy instance instance-404 not found'))

    await request(app.getHttpServer())
      .post('/ops/strategy-instances/instance-404/generate-signal')
      .expect(404)
  })
})
