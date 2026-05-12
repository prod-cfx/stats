import type { INestApplication } from '@nestjs/common'
import type { PrismaService } from '@/prisma/prisma.service'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ClsConfigModule } from '@/common/modules/cls.module'
import { EnvModule } from '@/common/modules/env.module'
import { SignalExecutionRepository } from '@/modules/strategy-signals/repositories/signal-execution.repository'
import { PrismaModule } from '@/prisma/prisma.module'
import { createTestingApp } from '../fixtures/fixtures'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EnvModule,
    ClsConfigModule,
    PrismaModule,
  ],
  providers: [SignalExecutionRepository],
})
class OkxPrivateWsExecutionTestModule {}

describe('OKX private WS execution matching (E2E, DB)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let repository: SignalExecutionRepository

  const userId = 'e2e-okx-ws-user'
  const accountId = 'e2e-okx-ws-account'
  const exchangeAccountId = 'e2e-okx-ws-exchange-account'
  const otherAccountId = 'e2e-okx-ws-other-account'
  const otherExchangeAccountId = 'e2e-okx-ws-other-exchange-account'
  const symbolId = 'e2e-okx-ws-symbol'
  const signalIds = [
    'e2e-okx-ws-signal-order',
    'e2e-okx-ws-signal-client',
    'e2e-okx-ws-signal-executed',
    'e2e-okx-ws-signal-failed',
    'e2e-okx-ws-signal-skipped',
    'e2e-okx-ws-signal-other-account',
  ]

  beforeAll(async () => {
    const context = await createTestingApp({
      imports: [OkxPrivateWsExecutionTestModule],
    })
    app = context.app
    if (!context.prisma) {
      throw new Error('PrismaService unavailable for OKX private WS execution e2e')
    }
    prisma = context.prisma
    repository = context.moduleFixture.get(SignalExecutionRepository, { strict: false })

    await prisma.user.create({
      data: {
        id: userId,
        email: 'e2e-okx-ws@test.local',
        nickname: 'E2E OKX WS',
      },
    })
    await prisma.symbol.create({
      data: {
        id: symbolId,
        code: 'E2E-OKX-WS-BTC-USDT-SWAP',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        exchange: 'OKX',
        type: 'CRYPTO',
        instrumentType: 'PERPETUAL',
        status: 'ACTIVE',
        precisionPrice: 2,
        precisionQuantity: 6,
      },
    })
    await prisma.userStrategyAccount.create({
      data: {
        id: accountId,
        userId,
        strategyId: 'e2e-okx-ws-strategy',
        strategyName: 'E2E OKX private WS',
        strategyVersion: 'v1',
        baseCurrency: 'USDT',
        initialBalance: '1000',
        balance: '1000',
        equity: '1000',
      },
    })
    await prisma.userStrategyAccount.create({
      data: {
        id: otherAccountId,
        userId,
        strategyId: 'e2e-okx-ws-other-strategy',
        strategyName: 'E2E OKX private WS other account',
        strategyVersion: 'v1',
        baseCurrency: 'USDT',
        initialBalance: '1000',
        balance: '1000',
        equity: '1000',
      },
    })

    for (const signalId of signalIds) {
      await prisma.tradingSignal.create({
        data: {
          id: signalId,
          symbolId,
          sourceType: 'AI_GENERATED',
          signalType: 'ENTRY',
          direction: 'BUY',
          status: 'PENDING',
          confidence: '80',
          entryPrice: '50000',
        },
      })
    }

    await prisma.userSignalExecution.createMany({
      data: [
        {
          id: 'e2e-okx-ws-exec-order',
          signalId: signalIds[0],
          userId,
          userStrategyAccountId: accountId,
          status: 'PENDING',
          orderSide: 'BUY',
          positionSide: 'LONG',
          metadata: {
            orderResponse: { id: 'okx-order-1' },
            orderRequest: { clientOrderId: 'okx-client-1' },
            exchangeAccountId,
          },
          createdAt: new Date('2026-05-12T00:00:01.000Z'),
        },
        {
          id: 'e2e-okx-ws-exec-other-account',
          signalId: signalIds[5],
          userId,
          userStrategyAccountId: otherAccountId,
          status: 'PENDING',
          orderSide: 'BUY',
          positionSide: 'LONG',
          metadata: {
            providerOrderId: 'okx-order-1',
            exchangeAccountId: otherExchangeAccountId,
          },
          createdAt: new Date('2026-05-12T00:00:06.000Z'),
        },
        {
          id: 'e2e-okx-ws-exec-client',
          signalId: signalIds[1],
          userId,
          userStrategyAccountId: accountId,
          status: 'PENDING',
          orderSide: 'BUY',
          positionSide: 'LONG',
          metadata: {
            tradingExecution: {
              exchangeAccountId,
              normalizedRequest: { clientOrderId: 'okx-client-nested' },
            },
          },
          createdAt: new Date('2026-05-12T00:00:02.000Z'),
        },
        {
          id: 'e2e-okx-ws-exec-executed',
          signalId: signalIds[2],
          userId,
          userStrategyAccountId: accountId,
          status: 'EXECUTED',
          orderSide: 'BUY',
          positionSide: 'LONG',
          metadata: {
            providerOrderId: 'okx-order-executed',
          },
          createdAt: new Date('2026-05-12T00:00:03.000Z'),
        },
        {
          id: 'e2e-okx-ws-exec-failed',
          signalId: signalIds[3],
          userId,
          userStrategyAccountId: accountId,
          status: 'FAILED',
          orderSide: 'BUY',
          positionSide: 'LONG',
          metadata: {
            providerOrderId: 'okx-order-failed',
          },
          createdAt: new Date('2026-05-12T00:00:04.000Z'),
        },
        {
          id: 'e2e-okx-ws-exec-skipped',
          signalId: signalIds[4],
          userId,
          userStrategyAccountId: accountId,
          status: 'SKIPPED',
          orderSide: 'BUY',
          positionSide: 'LONG',
          metadata: {
            providerOrderId: 'okx-order-skipped',
          },
          createdAt: new Date('2026-05-12T00:00:05.000Z'),
        },
      ],
    })
  })

  afterAll(async () => {
    if (!prisma) return
    await prisma.userSignalExecution.deleteMany({ where: { userStrategyAccountId: { in: [accountId, otherAccountId] } } })
    await prisma.tradingSignal.deleteMany({ where: { id: { in: signalIds } } })
    await prisma.userStrategyAccount.deleteMany({ where: { id: { in: [accountId, otherAccountId] } } })
    await prisma.symbol.deleteMany({ where: { id: symbolId } })
    await prisma.user.deleteMany({ where: { id: userId } })
    await app?.close()
  })

  it('finds pending executions by OKX order id JSON path', async () => {
    const execution = await repository.findPendingByOkxOrderIds({ orderId: 'okx-order-1', exchangeAccountId })

    expect(execution?.id).toBe('e2e-okx-ws-exec-order')
  })

  it('does not match a pending OKX order from another exchange account', async () => {
    const execution = await repository.findPendingByOkxOrderIds({
      orderId: 'okx-order-1',
      exchangeAccountId: otherExchangeAccountId,
    })

    expect(execution?.id).toBe('e2e-okx-ws-exec-other-account')
  })

  it('finds pending executions by nested OKX client order id JSON path', async () => {
    const execution = await repository.findPendingByOkxOrderIds({
      orderId: 'missing-order',
      clientOrderId: 'okx-client-nested',
      exchangeAccountId,
    })

    expect(execution?.id).toBe('e2e-okx-ws-exec-client')
  })

  it.each([
    ['executed', 'okx-order-executed'],
    ['failed', 'okx-order-failed'],
    ['skipped', 'okx-order-skipped'],
  ])('does not return %s executions that are already terminal', async (_status, orderId) => {
    const execution = await repository.findPendingByOkxOrderIds({ orderId })

    expect(execution).toBeNull()
  })

  it('does not overwrite terminal executions through pending-only OKX transitions', async () => {
    const changed = await repository.markPendingStage('e2e-okx-ws-exec-executed', 'ORDER_ACKED', {
      providerStatus: 'late_live',
    })

    const execution = await prisma.userSignalExecution.findUniqueOrThrow({
      where: { id: 'e2e-okx-ws-exec-executed' },
    })
    const metadata = execution.metadata as Record<string, unknown>
    expect(changed).toBe(false)
    expect(execution.status).toBe('EXECUTED')
    expect(metadata.providerStatus).toBeUndefined()
  })
})
