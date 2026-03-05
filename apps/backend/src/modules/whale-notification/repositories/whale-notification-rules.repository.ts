import type { Prisma as PrismaTypes, WhaleNotificationRuleType } from '@prisma/client'
import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '@/prisma/prisma.service'

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

@Injectable()
export class WhaleNotificationRulesRepository {
  constructor(private readonly prisma: PrismaService) {}

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
