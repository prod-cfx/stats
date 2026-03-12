import type { INestApplication } from '@nestjs/common'
import { ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { ExchangeAccountsController } from './exchange-accounts.controller'
import { ExchangeAccountsService } from './exchange-accounts.service'

jest.mock('./exchange-accounts.service', () => ({
  ExchangeAccountsService: class ExchangeAccountsService {},
}))

describe('userExchangeAccountsController', () => {
  let app: INestApplication
  const service = {
    create: jest.fn(),
    list: jest.fn(),
    delete: jest.fn(),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ExchangeAccountsController],
      providers: [
        {
          provide: ExchangeAccountsService,
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

  it('accepts explicit userId in create body without bearer token', async () => {
    service.create.mockResolvedValue({
      id: 'account-1',
      exchangeId: 'binance',
      name: 'Primary',
      isTestnet: false,
      lastValidatedAt: null,
      createdAt: new Date('2026-03-09T00:00:00.000Z'),
    })

    await request(app.getHttpServer())
      .post('/exchange-accounts')
      .send({
        userId: 'user-1',
        exchangeId: 'binance',
        apiKey: 'valid_key',
        apiSecret: 'valid_secret',
        marketType: 'spot',
        name: 'Primary',
      })
      .expect(201)

    expect(service.create).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        exchangeId: 'binance',
        apiKey: 'valid_key',
        apiSecret: 'valid_secret',
        marketType: 'spot',
        name: 'Primary',
      }),
    )
  })

  it('reads explicit userId from query when listing accounts', async () => {
    service.list.mockResolvedValue([])

    await request(app.getHttpServer())
      .get('/exchange-accounts')
      .query({ userId: 'user-2' })
      .expect(200)

    expect(service.list).toHaveBeenCalledWith('user-2')
  })

  it('reads explicit userId from query when deleting account', async () => {
    service.delete.mockResolvedValue(undefined)

    await request(app.getHttpServer())
      .delete('/exchange-accounts/account-9')
      .query({ userId: 'user-3' })
      .expect(200)

    expect(service.delete).toHaveBeenCalledWith('user-3', 'account-9')
  })
})
