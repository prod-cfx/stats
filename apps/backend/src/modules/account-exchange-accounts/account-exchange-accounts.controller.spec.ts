import { ClsPluginTransactional } from '@nestjs-cls/transactional'
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import { Global, Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { ClsModule, ClsService } from 'nestjs-cls'
import { PrismaService } from '@/prisma/prisma.service'
import { AccountExchangeAccountsController } from './account-exchange-accounts.controller'
import { AccountExchangeAccountsService } from './account-exchange-accounts.service'

describe('accountExchangeAccountsController', () => {
  async function createTestbed() {
    const service = {
      list: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue({
        id: 'account-1',
        exchangeId: 'binance',
        isBound: true,
        name: 'Primary Binance',
        maskedCredential: 'abcd****wxyz',
        isTestnet: false,
        lastValidatedAt: new Date('2026-03-20T00:00:00.000Z'),
        createdAt: new Date('2026-03-20T00:00:00.000Z'),
      }),
      delete: jest.fn().mockResolvedValue(undefined),
    }

    const prismaStub = {
      $transaction: <T>(work: (tx: unknown) => Promise<T>) => work(prismaStub),
    }

    @Global()
    @Module({
      providers: [{ provide: PrismaService, useValue: prismaStub }],
      exports: [PrismaService],
    })
    class FakePrismaModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        FakePrismaModule,
        ClsModule.forRoot({
          global: true,
          middleware: { mount: false },
          plugins: [
            new ClsPluginTransactional({
              imports: [FakePrismaModule],
              adapter: new TransactionalAdapterPrisma({
                prismaInjectionToken: PrismaService,
              }),
            }),
          ],
        }),
      ],
      controllers: [AccountExchangeAccountsController],
      providers: [
        { provide: AccountExchangeAccountsService, useValue: service },
      ],
    }).compile()

    await moduleRef.init()

    const controller = moduleRef.get(AccountExchangeAccountsController)
    const cls = moduleRef.get(ClsService)
    return { controller, service, cls }
  }

  it('uses authenticated user id when listing bindings', async () => {
    const { controller, service, cls } = await createTestbed()

    await cls.run(() => controller.list('user-1'))

    expect(service.list).toHaveBeenCalledWith('user-1', { degradeOnTransientFailure: true })
  })

  it('uses authenticated user id when upserting bindings', async () => {
    const { controller, service, cls } = await createTestbed()

    await cls.run(() => controller.upsert({
      id: 'user-1',
      email: 'user-1@example.com',
      roles: [],
      principalType: 'user',
    }, {
      exchangeId: 'binance',
      apiKey: 'key',
      apiSecret: 'secret',
    }))

    expect(service.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1',
        email: 'user-1@example.com',
      }),
      expect.objectContaining({
        exchangeId: 'binance',
        apiKey: 'key',
        apiSecret: 'secret',
      }),
    )
  })

  it('deletes by exchangeId for the authenticated user', async () => {
    const { controller, service, cls } = await createTestbed()

    await cls.run(() => controller.delete('user-1', 'binance'))

    expect(service.delete).toHaveBeenCalledWith('user-1', 'binance')
  })
})
