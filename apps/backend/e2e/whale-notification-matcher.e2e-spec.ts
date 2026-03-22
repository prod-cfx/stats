import type { INestApplication } from '@nestjs/common'
import type { TestingModule } from '@nestjs/testing'
import type { PrismaService } from '../src/prisma/prisma.service'
import { Test } from '@nestjs/testing'
import { AppModule } from '../src/modules/app.module'
import { WhaleNotificationMatcherService } from '../src/modules/whale-notification/services/whale-notification-matcher.service'
import { PrismaService as PrismaServiceToken } from '../src/prisma/prisma.service'
import { ensureE2eEnv } from './helpers/setup-e2e-env'

describe('Whale notification matcher (service E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let matcher: WhaleNotificationMatcherService

  beforeAll(async () => {
    ensureE2eEnv()

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()

    prisma = app.get(PrismaServiceToken)
    matcher = app.get(WhaleNotificationMatcherService)

    const client = prisma.getClient()
    await client.whaleNotificationDelivery.deleteMany({ where: { userId: 'e2e-matcher-user' } })
    await client.whaleNotificationRuleSymbolOverride.deleteMany({ where: { rule: { userId: 'e2e-matcher-user' } } })
    await client.whaleNotificationRuleAddress.deleteMany({ where: { rule: { userId: 'e2e-matcher-user' } } })
    await client.whaleNotificationRule.deleteMany({ where: { userId: 'e2e-matcher-user' } })
    await client.user.deleteMany({ where: { id: 'e2e-matcher-user' } })

    await client.user.create({
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
      const client = prisma.getClient()
      await client.whaleNotificationDelivery.deleteMany({ where: { userId: 'e2e-matcher-user' } })
      await client.whaleNotificationRuleSymbolOverride.deleteMany({ where: { rule: { userId: 'e2e-matcher-user' } } })
      await client.whaleNotificationRuleAddress.deleteMany({ where: { rule: { userId: 'e2e-matcher-user' } } })
      await client.whaleNotificationRule.deleteMany({ where: { userId: 'e2e-matcher-user' } })
      await client.user.deleteMany({ where: { id: 'e2e-matcher-user' } })
    }

    if (app) {
      await app.close()
    }
  })

  it('should apply threshold priority: address+symbol override > symbol override > default threshold', async () => {
    const client = prisma.getClient()

    const rule = await client.whaleNotificationRule.create({
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

    await client.whaleNotificationRuleSymbolOverride.createMany({
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
