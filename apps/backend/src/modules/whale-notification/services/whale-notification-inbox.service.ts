import type { WhaleNotificationDelivery } from '@/prisma/prisma.types'
import type { WhaleNotificationInboxResponseDto } from '../dto/whale-notification-inbox.response.dto'
import type { WhaleNotificationDeliveryRepository } from '../repositories/whale-notification-delivery.repository'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { WhaleNotificationDeliveryRepository as WhaleNotificationDeliveryRepositoryToken } from '../repositories/whale-notification-delivery.repository'

@Injectable()
export class WhaleNotificationInboxService {
  constructor(
    @Inject(WhaleNotificationDeliveryRepositoryToken)
    private readonly repository: WhaleNotificationDeliveryRepository,
  ) {}

  async list(userId: string): Promise<WhaleNotificationInboxResponseDto[]> {
    const rows = await this.repository.listInboxByUser(userId)
    return rows.map(row => this.toResponse(row))
  }

  async markRead(userId: string, id: string): Promise<void> {
    const existing = await this.repository.findById(id)
    if (!existing || existing.userId !== userId) {
      throw new DomainException('Notification not found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }

    await this.repository.markRead(userId, id)
  }

  async markAllRead(userId: string): Promise<void> {
    await this.repository.markAllRead(userId)
  }

  async unreadCount(userId: string): Promise<number> {
    return this.repository.countUnread(userId)
  }

  private toResponse(row: WhaleNotificationDelivery): WhaleNotificationInboxResponseDto {
    const web = row.channel === 'WEB' ? this.mapStatus(row.status) : 'SKIPPED'
    const email = row.channel === 'EMAIL' ? this.mapStatus(row.status) : 'SKIPPED'
    const telegram = row.channel === 'TELEGRAM' ? this.mapStatus(row.status) : 'SKIPPED'

    return {
      id: row.id,
      title: row.title ?? '监控命中',
      content: row.content ?? `${row.whaleAddress} ${row.side} ${row.symbol} ${Number(row.tradeValueUsd).toLocaleString('en-US')}`,
      ruleId: row.ruleId,
      channels: {
        web,
        email,
        telegram,
      },
      read: row.isRead,
      createdAt: row.createdAt.toISOString(),
    }
  }

  private mapStatus(status: WhaleNotificationDelivery['status']): 'SENT' | 'FAILED' | 'SKIPPED' | 'PENDING' {
    if (status === 'FAILED') return 'FAILED'
    if (status === 'SKIPPED_COOLDOWN') return 'SKIPPED'
    if (status === 'PENDING') return 'PENDING'
    return 'SENT'
  }
}
