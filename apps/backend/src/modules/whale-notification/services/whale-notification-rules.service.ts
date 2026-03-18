import type { CreateWhaleNotificationRuleDto } from '../dto/create-whale-notification-rule.dto'
import type { UpdateWhaleNotificationRuleDto } from '../dto/update-whale-notification-rule.dto'
import type { WhaleNotificationDeliveryRepository } from '../repositories/whale-notification-delivery.repository'
import type { WhaleNotificationRulesRepository } from '../repositories/whale-notification-rules.repository'
import type { WhaleNotificationRule } from '@/prisma/prisma.types'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import { DomainException } from '@/common/exceptions/domain.exception'
import { WhaleNotificationRuleType } from '@/prisma/prisma.types'
import { WhaleNotificationDeliveryRepository as WhaleNotificationDeliveryRepositoryToken } from '../repositories/whale-notification-delivery.repository'
import { WhaleNotificationRulesRepository as WhaleNotificationRulesRepositoryToken } from '../repositories/whale-notification-rules.repository'

@Injectable()
export class WhaleNotificationRulesService {
  constructor(
    @Inject(WhaleNotificationRulesRepositoryToken)
    private readonly repository: WhaleNotificationRulesRepository,
    @Inject(WhaleNotificationDeliveryRepositoryToken)
    private readonly deliveryRepository: WhaleNotificationDeliveryRepository,
  ) {}

  async listByUser(userId: string): Promise<WhaleNotificationRule[]> {
    return this.repository.listByUser(userId)
  }

  async create(userId: string, dto: CreateWhaleNotificationRuleDto): Promise<WhaleNotificationRule> {
    const normalized = this.normalizeCreateInput(dto)
    await this.ensureTelegramChannelAvailable(userId, normalized.channels.telegram)

    return this.repository.create({
      userId,
      type: normalized.type,
      address: normalized.address,
      symbol: normalized.symbol,
      thresholdUsd: normalized.thresholdUsd,
      note: normalized.note,
      channels: normalized.channels,
    })
  }

  async update(userId: string, id: string, dto: UpdateWhaleNotificationRuleDto): Promise<WhaleNotificationRule> {
    const existing = await this.repository.findById(id)
    if (!existing || existing.userId !== userId) {
      throw new DomainException('Whale notification rule not found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }

    await this.ensureTelegramChannelAvailable(userId, dto.channels?.telegram === true)

    return this.repository.update(id, {
      thresholdUsd: dto.thresholdUsd,
      note: dto.note,
      isActive: dto.isActive,
      channels: dto.channels,
    })
  }

  async delete(userId: string, id: string): Promise<void> {
    const existing = await this.repository.findById(id)
    if (!existing || existing.userId !== userId) {
      throw new DomainException('Whale notification rule not found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }

    await this.repository.delete(id)
  }

  private normalizeCreateInput(dto: CreateWhaleNotificationRuleDto) {
    const normalizedAddress = dto.address?.trim().toLowerCase()
    const normalizedSymbol = dto.symbol?.trim().toUpperCase()
    const thresholdInput = dto.thresholdUsd
    const normalizedThresholdUsd = Number(thresholdInput)

    if (!Number.isFinite(normalizedThresholdUsd) || normalizedThresholdUsd < 1) {
      throw new DomainException('thresholdUsd must be a valid number greater than or equal to 1', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    if (
      !dto.channels
      || typeof dto.channels.web !== 'boolean'
      || typeof dto.channels.email !== 'boolean'
      || typeof dto.channels.telegram !== 'boolean'
    ) {
      throw new DomainException('channels must include web/email/telegram boolean fields', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    if (dto.type === WhaleNotificationRuleType.ADDRESS && !normalizedAddress) {
      throw new DomainException('Address rule requires address', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    if (dto.type === WhaleNotificationRuleType.SYMBOL && !normalizedSymbol) {
      throw new DomainException('Symbol rule requires symbol', {
        code: ErrorCode.BAD_REQUEST,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    return {
      type: dto.type,
      address: normalizedAddress,
      symbol: normalizedSymbol,
      thresholdUsd: normalizedThresholdUsd,
      note: dto.note?.trim() || undefined,
      channels: dto.channels,
    }
  }

  private async ensureTelegramChannelAvailable(userId: string, useTelegram: boolean): Promise<void> {
    if (!useTelegram) return
    const telegramId = await this.deliveryRepository.findUserTelegramId(userId)
    if (telegramId) return

    throw new DomainException('Telegram channel requires linked Telegram account', {
      code: ErrorCode.BAD_REQUEST,
      status: HttpStatus.BAD_REQUEST,
    })
  }
}
