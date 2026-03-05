import type {
  Prisma as PrismaTypes,
  WhaleNotificationChannel,
  WhaleNotificationDeliveryStatus,
  WhaleNotificationRuleType,
} from '@prisma/client'
import type { PrismaService } from '@/prisma/prisma.service'
import { Inject, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService as PrismaServiceToken } from '@/prisma/prisma.service'

interface CreateRuleParams {
  userId: string
  type: WhaleNotificationRuleType
  address?: string
  symbol?: string
  thresholdUsd: number
  note?: string
  channels: {
    web: boolean
    email: boolean
    telegram: boolean
  }
}

interface UpdateRuleParams {
  thresholdUsd?: number
  note?: string
  isActive?: boolean
  channels?: {
    web: boolean
    email: boolean
    telegram: boolean
  }
}

interface CreateDeliveryParams {
  userId: string
  ruleId: string
  dedupKey: string
  channel: WhaleNotificationChannel
  status: WhaleNotificationDeliveryStatus
  whaleAddress: string
  symbol: string
  side: string
  tradeValueUsd: number
  tradeTime: Date
  title?: string
  content?: string
  errorMessage?: string
}

@Injectable()
export class WhaleNotificationRulesRepository {
  constructor(@Inject(PrismaServiceToken) private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async listByUser(userId: string) {
    return this.getClient().whaleNotificationRule.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }],
    })
  }

  async listActiveRulesForMatching(whaleAddress: string, symbol: string) {
    return this.getClient().whaleNotificationRule.findMany({
      where: {
        isActive: true,
        OR: [
          { type: 'ADDRESS', whaleAddress },
          { type: 'SYMBOL', symbol },
          { addressTargets: { some: { whaleAddress } } },
        ],
      },
      include: {
        addressTargets: true,
        symbolOverrides: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    })
  }

  async findRecentSentDeliveries(dedupKeys: string[], since: Date) {
    if (!dedupKeys.length) return []
    return this.getClient().whaleNotificationDelivery.findMany({
      where: {
        dedupKey: { in: dedupKeys },
        status: 'SENT',
        createdAt: { gte: since },
      },
      select: {
        dedupKey: true,
        channel: true,
      },
    })
  }

  async tryAcquireCooldownSlot(params: {
    dedupKey: string
    channel: WhaleNotificationChannel
    cooldownSeconds: number
  }): Promise<boolean> {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + params.cooldownSeconds * 1000)
    const result = await this.getClient().$queryRaw<Array<{ id: string }>>`
      INSERT INTO "whale_notification_cooldown_guards" (
        "dedup_key",
        "channel",
        "expires_at"
      )
      VALUES (
        ${params.dedupKey},
        ${params.channel},
        ${expiresAt}
      )
      ON CONFLICT ("dedup_key", "channel")
      DO UPDATE SET
        "expires_at" = EXCLUDED."expires_at",
        "updated_at" = NOW()
      WHERE "whale_notification_cooldown_guards"."expires_at" <= ${now}
      RETURNING "id"
    `
    return result.length > 0
  }

  async releaseCooldownSlot(params: {
    dedupKey: string
    channel: WhaleNotificationChannel
  }): Promise<void> {
    await this.getClient().$executeRaw`
      DELETE FROM "whale_notification_cooldown_guards"
      WHERE "dedup_key" = ${params.dedupKey}
        AND "channel" = ${params.channel}
    `
  }

  async createDelivery(params: CreateDeliveryParams) {
    return this.getClient().whaleNotificationDelivery.create({
      data: {
        userId: params.userId,
        ruleId: params.ruleId,
        dedupKey: params.dedupKey,
        channel: params.channel,
        status: params.status,
        whaleAddress: params.whaleAddress,
        symbol: params.symbol,
        side: params.side,
        tradeValueUsd: new Prisma.Decimal(params.tradeValueUsd),
        tradeTime: params.tradeTime,
        title: params.title ?? null,
        content: params.content ?? null,
        errorMessage: params.errorMessage ?? null,
      },
    })
  }

  async findById(id: string) {
    return this.getClient().whaleNotificationRule.findUnique({ where: { id } })
  }

  async create(params: CreateRuleParams) {
    const data: PrismaTypes.WhaleNotificationRuleCreateInput = {
      user: { connect: { id: params.userId } },
      type: params.type,
      whaleAddress: params.address,
      symbol: params.symbol,
      thresholdUsd: new Prisma.Decimal(params.thresholdUsd),
      note: params.note ?? null,
      channelWeb: params.channels.web,
      channelEmail: params.channels.email,
      channelTelegram: params.channels.telegram,
      isActive: true,
    }

    return this.getClient().whaleNotificationRule.create({ data })
  }

  async update(id: string, params: UpdateRuleParams) {
    const data: PrismaTypes.WhaleNotificationRuleUpdateInput = {}

    if (params.thresholdUsd !== undefined) {
      data.thresholdUsd = new Prisma.Decimal(params.thresholdUsd)
    }
    if (params.note !== undefined) {
      data.note = params.note
    }
    if (params.isActive !== undefined) {
      data.isActive = params.isActive
    }
    if (params.channels) {
      data.channelWeb = params.channels.web
      data.channelEmail = params.channels.email
      data.channelTelegram = params.channels.telegram
    }

    return this.getClient().whaleNotificationRule.update({
      where: { id },
      data,
    })
  }

  async delete(id: string) {
    await this.getClient().whaleNotificationRule.delete({ where: { id } })
  }
}
