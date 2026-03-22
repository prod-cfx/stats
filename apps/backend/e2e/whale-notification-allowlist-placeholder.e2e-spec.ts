import type { INestApplication, ExecutionContext } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { WhaleAlertService } from '../src/modules/whale-alert/whale-alert.service'
import type { PrismaService } from '../src/prisma/prisma.service'
import { BadRequestException, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { AppModule } from '../src/modules/app.module'
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard'
import { WhaleAlertService as WhaleAlertServiceToken } from '../src/modules/whale-alert/whale-alert.service'
import { WhaleNotificationDeduplicatorService } from '../src/modules/whale-notification/services/whale-notification-deduplicator.service'
import { PrismaService as PrismaServiceToken } from '../src/prisma/prisma.service'
import { ensureE2eEnv } from './helpers/setup-e2e-env'

describe('Whale notification gray release allowlist placeholder (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let whaleAlertService: WhaleAlertService

  const userId = 'e2e-allowlist-placeholder-user'
  const originalCwd = process.cwd()
  const originalAllowlist = process.env.WHALE_NOTIFICATION_ALLOWED_USER_IDS

  beforeAll(async () => {
    ensureE2eEnv()
    process.env.WHALE_NOTIFICATION_ALLOWED_USER_IDS = '__SET_IN_env.local__'

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest()
          req.user = {
            id: userId,
            email: 'e2e-allowlist@example.com',
            roles: ['USER'],
            principalType: 'user',
          }
          return true
        },
      })
      .overrideProvider(WhaleNotificationDeduplicatorService)
      .useValue({
        filterByCooldown: async (candidates: Array<{
          userId: string
          whaleAddress: string
          symbol: string
          side: string
          channel: string
        }>) => ({
          allowed: candidates.map(item => ({
            ...item,
            dedupKey: `${item.userId}:${item.whaleAddress}:${item.symbol}:${item.side}:${item.channel}`,
          })),
          skipped: [],
        }),
      })
      .compile()

    app = moduleFixture.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: false,
        transformOptions: { enableImplicitConversion: true },
        exceptionFactory: errors => {
          const errorMessages = errors.map(err => ({
            property: err.property,
            constraints: err.constraints,
            value: err.value,
          }))
          return new BadRequestException(errorMessages)
        },
      }),
    )

    app.setGlobalPrefix('api/v1')
    await app.init()

    prisma = app.get(PrismaServiceToken)
    whaleAlertService = app.get(WhaleAlertServiceToken)
    const client = prisma.getClient()

    await client.whaleNotificationDelivery.deleteMany({ where: { userId } })
    await client.whaleNotificationRule.deleteMany({ where: { userId } })
    await client.user.deleteMany({ where: { id: userId } })

    await client.user.create({
      data: {
        id: userId,
        email: 'e2e-allowlist@example.com',
        passwordHash: 'e2e-password-hash',
        nickname: 'allowlist-user',
        emailVerified: true,
        isGuest: false,
      },
    })

    await client.whaleNotificationRule.create({
      data: {
        userId,
        type: 'SYMBOL',
        symbol: 'BTC',
        thresholdUsd: 5_000,
        channelWeb: true,
        channelEmail: false,
        channelTelegram: false,
        isActive: true,
      },
    })
  })

  afterAll(async () => {
    if (prisma) {
      const client = prisma.getClient()
      await client.whaleNotificationDelivery.deleteMany({ where: { userId } })
      await client.whaleNotificationRule.deleteMany({ where: { userId } })
      await client.hyperliquidWhaleTrade.deleteMany({ where: { userAddress: '0xabc' } })
      await client.user.deleteMany({ where: { id: userId } })
    }

    if (originalAllowlist === undefined) {
      delete process.env.WHALE_NOTIFICATION_ALLOWED_USER_IDS
    } else {
      process.env.WHALE_NOTIFICATION_ALLOWED_USER_IDS = originalAllowlist
    }
    process.chdir(originalCwd)
    if (app) await app.close()
  })

  it('should not treat placeholder allowlist as a real whitelist', async () => {
    await whaleAlertService.recordWhaleTrade({
      whaleAddress: '0xabc',
      coin: 'BTC',
      side: 'Long',
      tradeSize: 0.1,
      price: 100000,
      tradeValueUsd: 10000,
      tradeTime: new Date(Date.now() - 1000),
    })

    const deliveries = await prisma.getClient().whaleNotificationDelivery.findMany({
      where: { userId },
    })

    expect(deliveries.length).toBeGreaterThan(0)
    expect(deliveries.some(item => item.channel === 'WEB' && item.status === 'SENT')).toBe(true)
  })
})
