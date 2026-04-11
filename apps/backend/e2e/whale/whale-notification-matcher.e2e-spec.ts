import type { INestApplication } from '@nestjs/common'
import type { Prisma as PrismaTypes } from '@/prisma/prisma.types'
import type { PrismaService } from '@/prisma/prisma.service'
import { WhaleNotificationMatcherService } from '@/modules/whale-notification/services/whale-notification-matcher.service'
import { PrismaService as PrismaServiceToken } from '@/prisma/prisma.service'
import { createTestingApp } from '../fixtures/fixtures'
import {
  cleanupWhaleNotificationUser,
  createWhaleNotificationRuleRecord,
  createWhaleNotificationTestUser,
} from './whale-notification.helpers'
type WhaleNotificationRuleOverrideSeedData = PrismaTypes.WhaleNotificationRuleSymbolOverrideCreateManyInput[]

const createWhaleNotificationRuleOverrideRecords = async (prisma: PrismaService, data: WhaleNotificationRuleOverrideSeedData) => {
  await prisma.whaleNotificationRuleSymbolOverride.createMany({ data })
}

describe('Whale notification matcher (service E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let matcher: WhaleNotificationMatcherService

  beforeAll(async () => {
    const ctx = await createTestingApp()
    app = ctx.app

    prisma = app.get(PrismaServiceToken)
    matcher = app.get(WhaleNotificationMatcherService)

    await prisma.whaleNotificationDelivery.deleteMany({ where: { userId: 'e2e-matcher-user' } })
    await prisma.whaleNotificationRuleSymbolOverride.deleteMany({ where: { rule: { userId: 'e2e-matcher-user' } } })
    await prisma.whaleNotificationRuleAddress.deleteMany({ where: { rule: { userId: 'e2e-matcher-user' } } })
    await cleanupWhaleNotificationUser(prisma, 'e2e-matcher-user')

    await createWhaleNotificationTestUser(prisma, {
      userId: 'e2e-matcher-user',
      email: 'e2e-matcher-user@example.com',
      nickname: 'matcher-user',
    })
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.whaleNotificationDelivery.deleteMany({ where: { userId: 'e2e-matcher-user' } })
      await prisma.whaleNotificationRuleSymbolOverride.deleteMany({ where: { rule: { userId: 'e2e-matcher-user' } } })
      await prisma.whaleNotificationRuleAddress.deleteMany({ where: { rule: { userId: 'e2e-matcher-user' } } })
      await cleanupWhaleNotificationUser(prisma, 'e2e-matcher-user')
    }

    if (app) {
      await app.close()
    }
  })

  it('should apply threshold priority: address+symbol override > symbol override > default threshold', async () => {

    const rule = await createWhaleNotificationRuleRecord(prisma, {
      userId: 'e2e-matcher-user',
      type: 'ADDRESS',
      whaleAddress: '0xabc',
      thresholdUsd: 100000,
      channelWeb: true,
      channelEmail: false,
      channelTelegram: true,
    })

    await createWhaleNotificationRuleOverrideRecords(prisma, [
        {
          ruleId: rule.id,
          whaleAddress: null,
          symbol: 'BTC',
          minTradeValueUsd: 150000,
        },
        {
          ruleId: rule.id,
          whaleAddress: '0xabc',
          symbol: 'BTC',
          minTradeValueUsd: 200000,
        },
      ])

    const belowAddressSymbol = await matcher.matchTradeEvent({
      whaleAddress: '0xabc',
      symbol: 'BTC',
      side: 'Long',
      tradeValueUsd: 180000,
      tradeTime: new Date(),
    })

    expect(belowAddressSymbol).toHaveLength(0)

    const aboveAddressSymbol = await matcher.matchTradeEvent({
      whaleAddress: '0xabc',
      symbol: 'BTC',
      side: 'Long',
      tradeValueUsd: 220000,
      tradeTime: new Date(),
    })

    expect(aboveAddressSymbol).toHaveLength(1)
    expect(aboveAddressSymbol[0].effectiveThresholdUsd).toBe(200000)

    const usesDefaultForEth = await matcher.matchTradeEvent({
      whaleAddress: '0xabc',
      symbol: 'ETH',
      side: 'Long',
      tradeValueUsd: 120000,
      tradeTime: new Date(),
    })

    expect(usesDefaultForEth).toHaveLength(1)
    expect(usesDefaultForEth[0].effectiveThresholdUsd).toBe(100000)
  })
})
