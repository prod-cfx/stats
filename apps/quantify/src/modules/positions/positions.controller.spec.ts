import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { PositionSyncService } from './position-sync.service'
import { PositionsValuationService } from './positions-valuation.service'
import { PositionsController } from './positions.controller'
import { PositionsService } from './positions.service'

jest.mock('./positions.service', () => ({
  PositionsService: class PositionsService {},
}))

jest.mock('./positions-valuation.service', () => ({
  PositionsValuationService: class PositionsValuationService {},
}))

jest.mock('./position-sync.service', () => ({
  PositionSyncService: class PositionSyncService {},
}))

describe('positionsController', () => {
  let app: INestApplication

  const positionsService = {
    listPositions: jest.fn(),
    recordTrade: jest.fn(),
    closePosition: jest.fn(),
    findUserStrategyAccountById: jest.fn(),
  }

  const valuationService = {
    applyQuotes: jest.fn(),
  }

  const syncService = {
    syncUserPositions: jest.fn(),
    syncAllActivePositions: jest.fn(),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PositionsController],
      providers: [
        {
          provide: PositionsService,
          useValue: positionsService,
        },
        {
          provide: PositionsValuationService,
          useValue: valuationService,
        },
        {
          provide: PositionSyncService,
          useValue: syncService,
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

  it('reads explicit userId from query when listing open positions', async () => {
    positionsService.listPositions.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })

    await request(app.getHttpServer())
      .get('/positions/open')
      .query({ userId: 'user-1', page: 1, limit: 20 })
      .expect(200)

    expect(positionsService.listPositions).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1' }),
      'user-1',
    )
  })

  it('reads explicit userId from query when listing historical positions', async () => {
    positionsService.listPositions.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 })

    await request(app.getHttpServer())
      .get('/positions/history')
      .query({ userId: 'user-2', page: 1, limit: 20 })
      .expect(200)

    expect(positionsService.listPositions).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-2' }),
      'user-2',
    )
  })

  it('accepts explicit userId when triggering manual sync', async () => {
    positionsService.findUserStrategyAccountById.mockResolvedValue({
      id: 'account-1',
      userId: 'user-3',
    })
    syncService.syncUserPositions.mockResolvedValue({ success: true })

    await request(app.getHttpServer())
      .post('/positions/sync')
      .send({
        userId: 'user-3',
        userStrategyAccountId: 'account-1',
        exchangeId: 'binance',
        marketType: 'spot',
      })
      .expect(201)

    expect(syncService.syncUserPositions).toHaveBeenCalledWith(
      'user-3',
      'account-1',
      'binance',
      'spot',
      'manual',
      'user-3',
    )
  })

  it('accepts explicit userId when closing position', async () => {
    positionsService.findUserStrategyAccountById.mockResolvedValue({
      id: 'account-2',
      userId: 'user-4',
    })
    positionsService.closePosition.mockResolvedValue({ success: true })

    await request(app.getHttpServer())
      .post('/positions/close')
      .send({
        userId: 'user-4',
        userStrategyAccountId: 'account-2',
        positionId: 'position-1',
        quantity: '1',
        exchangeId: 'binance',
        marketType: 'spot',
      })
      .expect(201)

    expect(positionsService.closePosition).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-4',
        userStrategyAccountId: 'account-2',
        positionId: 'position-1',
      }),
    )
  })
})
