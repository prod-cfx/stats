import type { WhaleNotificationRule } from '@prisma/client'
import type { CreateWhaleNotificationRuleDto } from '../dto/create-whale-notification-rule.dto'
import type { UpdateWhaleNotificationRuleDto } from '../dto/update-whale-notification-rule.dto'
import type { WhaleNotificationRulesRepository } from '../repositories/whale-notification-rules.repository'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { WhaleNotificationRuleType } from '@prisma/client'
import { DomainException } from '@/common/exceptions/domain.exception'

@Injectable()
export class WhaleNotificationRulesService {
  constructor(private readonly repository: WhaleNotificationRulesRepository) {}

  async listByUser(userId: string): Promise<WhaleNotificationRule[]> {
    return this.repository.listByUser(userId)
  }

  async create(userId: string, dto: CreateWhaleNotificationRuleDto): Promise<WhaleNotificationRule> {
    const normalized = this.normalizeCreateInput(dto)

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
      thresholdUsd: dto.thresholdUsd,
      note: dto.note?.trim() || undefined,
      channels: dto.channels,
    }
  }
}
