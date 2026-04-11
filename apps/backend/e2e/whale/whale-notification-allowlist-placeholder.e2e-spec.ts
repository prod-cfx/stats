import type { INestApplication, ExecutionContext } from '@nestjs/common'
import type { WhaleAlertService } from '@/modules/whale-alert/whale-alert.service'
import type { WhaleNotificationDelivery } from '@/prisma/prisma.types'
import type { PrismaService } from '@/prisma/prisma.service'
import { JwtAuthGuard } from '@/modules/auth/guards/jwt-auth.guard'
import { WhaleAlertService as WhaleAlertServiceToken } from '@/modules/whale-alert/whale-alert.service'
import { WhaleNotificationDeduplicatorService } from '@/modules/whale-notification/services/whale-notification-deduplicator.service'
import { PrismaService as PrismaServiceToken } from '@/prisma/prisma.service'
import { createTestingApp } from '../fixtures/fixtures'
import { restoreE2eEnv, setE2eEnvValue, snapshotE2eEnv } from '../helpers/setup-e2e-env'
import {
  cleanupWhaleNotificationUser,
  createWhaleNotificationRuleRecord,
  createWhaleNotificationTestUser,
} from './whale-notification.helpers'

describe('Whale notification gray release allowlist placeholder (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let whaleAlertService: WhaleAlertService

  const userId = 'e2e-allowlist-placeholder-user'
  const envSnapshot = snapshotE2eEnv(['WHALE_NOTIFICATION_ALLOWED_USER_IDS'])

  beforeAll(async () => {
    setE2eEnvValue('WHALE_NOTIFICATION_ALLOWED_USER_IDS', '__SET_IN_env.local__')

    const ctx = await createTestingApp({
      onBeforeInit: builder =>
        builder
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
          }),
    })
    app = ctx.app

    prisma = app.get(PrismaServiceToken)
    whaleAlertService = app.get(WhaleAlertServiceToken)

    await cleanupWhaleNotificationUser(prisma, userId)

    await createWhaleNotificationTestUser(prisma, {
      userId,
      email: 'e2e-allowlist@example.com',
      nickname: 'allowlist-user',
    })

    await createWhaleNotificationRuleRecord(prisma, {
      userId,
      type: 'SYMBOL',
      symbol: 'BTC',
      thresholdUsd: 5_000,
      channelWeb: true,
      channelEmail: false,
      channelTelegram: false,
      isActive: true,
    })
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.hyperliquidWhaleTrade.deleteMany({ where: { userAddress: '0xabc' } })
      await cleanupWhaleNotificationUser(prisma, userId)
    }

    restoreE2eEnv(envSnapshot)
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

    const deliveries = await prisma.whaleNotificationDelivery.findMany({
      where: { userId },
    })

    expect(deliveries.length).toBeGreaterThan(0)
    expect(deliveries.some((item: WhaleNotificationDelivery) => item.channel === 'WEB' && item.status === 'SENT')).toBe(true)
  })
})
