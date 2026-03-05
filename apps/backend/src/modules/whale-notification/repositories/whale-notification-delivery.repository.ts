import type { PrismaService } from '@/prisma/prisma.service'
import { Injectable } from '@nestjs/common'

@Injectable()
export class WhaleNotificationDeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getClient() {
    return this.prisma.getClient()
  }

  async listInboxByUser(userId: string, limit = 100) {
    return this.getClient().whaleNotificationDelivery.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }],
      take: limit,
    })
  }

  async findById(id: string) {
    return this.getClient().whaleNotificationDelivery.findUnique({ where: { id } })
  }

  async markRead(userId: string, id: string) {
    return this.getClient().whaleNotificationDelivery.updateMany({
      where: { id, userId },
      data: { isRead: true },
    })
  }

  async markAllRead(userId: string) {
    return this.getClient().whaleNotificationDelivery.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    })
  }

  async countUnread(userId: string) {
    return this.getClient().whaleNotificationDelivery.count({
      where: {
        userId,
        isRead: false,
      },
    })
  }

  async findUserEmail(userId: string): Promise<string | null> {
    const row = await this.getClient().user.findUnique({
      where: { id: userId },
      select: { email: true },
    })
    return row?.email ?? null
  }

  async findUserTelegramId(userId: string): Promise<string | null> {
    const credential = await this.getClient().userCredential.findFirst({
      where: {
        userId,
        value: {
          startsWith: 'telegram:',
        },
      },
      orderBy: [{ createdAt: 'desc' }],
      select: { value: true },
    })

    if (!credential?.value)
      return null
    const telegramId = credential.value.slice('telegram:'.length).trim()
    return telegramId || null
  }
}
