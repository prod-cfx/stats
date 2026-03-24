import type { INestApplication } from '@nestjs/common'
import type { PrismaService } from '@/prisma/prisma.service'
import { WhaleNotificationMatcherService } from '@/modules/whale-notification/services/whale-notification-matcher.service'
import { PrismaService as PrismaServiceToken } from '@/prisma/prisma.service'
import { createTestingApp } from '../fixtures/fixtures'

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
    await prisma.whaleNotificationRule.deleteMany({ where: { userId: 'e2e-matcher-user' } })
    await prisma.user.deleteMany({ where: { id: 'e2e-matcher-user' } })

    await prisma.user.create({
      data: {
        id: 'e2e-matcher-user',
        email: 'e2e-matcher-user@example.com',
        passwordHash: 'e2e-password-hash',
        nickname: 'matcher-user',
        emailVerified: true,
        isGuest: false,
      },
    })
  })

  afterAll(async () => {
    if (prisma) {
      await prisma.whaleNotificationDelivery.deleteMany({ where: { userId: 'e2e-matcher-user' } })
      await prisma.whaleNotificationRuleSymbolOverride.deleteMany({ where: { rule: { userId: 'e2e-matcher-user' } } })
      await prisma.whaleNotificationRuleAddress.deleteMany({ where: { rule: { userId: 'e2e-matcher-user' } } })
      await prisma.whaleNotificationRule.deleteMany({ where: { userId: 'e2e-matcher-user' } })
      await prisma.user.deleteMany({ where: { id: 'e2e-matcher-user' } })
    }

    if (app) {
      await app.close()
    }
  })

  it('should apply threshold priority: address+symbol override > symbol override > default threshold', async () => {

    const rule = await prisma.whaleNotificationRule.create({
      data: {
        userId: 'e2e-matcher-user',
        type: 'ADDRESS',
        whaleAddress: '0xabc',
        thresholdUsd: 100000,
        channelWeb: true,
        channelEmail: false,
        channelTelegram: true,
      },
    })

    await prisma.whaleNotificationRuleSymbolOverride.createMany({
      data: [
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
      ],
    })

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
