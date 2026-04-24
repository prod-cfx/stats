import type { BetaAccessCode } from '../../../../generated/prisma'
import { isValidInvitationCode } from '@ai/shared/constants/invite'
import { Injectable } from '@nestjs/common'
import { randomInt } from 'node:crypto'
import { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'
// Nest 注入需要运行时引用 SettingsService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { SettingsService } from '@/modules/settings/services/settings.service'
import {
  BetaCodeDisabledException,
  BetaCodeExhaustedException,
  BetaCodeInvalidException,
  BetaCodeRequiredException,
} from '../exceptions'
// Nest 注入需要运行时引用 Repository，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { BetaAccessCodeRepository } from '../repositories/beta-code.repository'

export interface QueryBetaCodeListInput {
  page?: number
  limit?: number
}

export interface CreateBetaCodeBatchInput {
  count: number
  maxUsesPerCode: number
  adminId?: string | null
}

export interface ConsumeBetaCodeInput {
  betaCode?: string | null
  userId: string
}

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const CODE_LENGTH = 12
export const BETA_CODE_GATE_ENABLED_SETTING_KEY = 'beta_code.enabled'

@Injectable()
export class BetaCodeService {
  constructor(
    private readonly repository: BetaAccessCodeRepository,
    private readonly settingsService: SettingsService,
  ) {}

  async list(query: QueryBetaCodeListInput): Promise<BasePaginationResponseDto<BetaAccessCode>> {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const skip = (page - 1) * limit

    const [total, items] = await Promise.all([
      this.repository.count(),
      this.repository.findMany({ skip, take: limit }),
    ])

    return new BasePaginationResponseDto(total, page, limit, items)
  }

  async createBatch(input: CreateBetaCodeBatchInput): Promise<BetaAccessCode[]> {
    const created: BetaAccessCode[] = []
    const attemptedCodes = new Set<string>()

    while (created.length < input.count) {
      const codes = new Set<string>()
      while (codes.size < input.count - created.length) {
        const code = this.generateCode()
        if (!attemptedCodes.has(code)) {
          codes.add(code)
          attemptedCodes.add(code)
        }
      }

      const batch = await this.repository.createMany(
        [...codes].map(code => ({
          code,
          maxUses: input.maxUsesPerCode,
          createdByAdminId: input.adminId ?? null,
        })),
      )
      created.push(...batch)
    }

    return created
  }

  async updateStatus(id: string, isActive: boolean): Promise<BetaAccessCode> {
    return this.repository.updateStatus(id, isActive)
  }

  async consumeForNewUser(input: ConsumeBetaCodeInput): Promise<void> {
    const gateEnabled = await this.settingsService.getBoolean(BETA_CODE_GATE_ENABLED_SETTING_KEY, false)
    if (!gateEnabled) {
      return
    }

    const normalizedCode = input.betaCode?.trim().toUpperCase()
    if (!normalizedCode) {
      throw new BetaCodeRequiredException()
    }

    if (!isValidInvitationCode(normalizedCode)) {
      throw new BetaCodeInvalidException()
    }

    const code = await this.repository.findByCode(normalizedCode)
    if (!code) {
      throw new BetaCodeInvalidException()
    }

    if (!code.isActive) {
      throw new BetaCodeDisabledException()
    }

    if (code.usedCount >= code.maxUses) {
      throw new BetaCodeExhaustedException()
    }

    const updatedCount = await this.repository.incrementUsedCountIfAvailable(code.id)
    if (updatedCount !== 1) {
      throw new BetaCodeExhaustedException()
    }

    await this.repository.createRedemption({
      codeId: code.id,
      userId: input.userId,
    })
    await this.repository.updateUserInvitationCode(input.userId, normalizedCode)
  }

  private generateCode(): string {
    let code = ''
    for (let index = 0; index < CODE_LENGTH; index += 1) {
      code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
    }
    return code
  }
}
