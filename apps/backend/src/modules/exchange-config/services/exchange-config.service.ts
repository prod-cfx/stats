import type { ExchangeConfig } from '@prisma/client'
import type { CreateExchangeConfigDto } from '../dto/create-exchange-config.dto'
import type { QueryExchangeConfigDto } from '../dto/query-exchange-config.dto'
import type { UpdateExchangeConfigDto } from '../dto/update-exchange-config.dto'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { DomainException } from '@/common/exceptions/domain.exception'
// Nest 注入需要运行时引用 Repository，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { ExchangeConfigRepository } from '../repositories/exchange-config.repository'

@Injectable()
export class ExchangeConfigService {
  constructor(
    private readonly repository: ExchangeConfigRepository,
  ) {}

  async findAll(filter?: QueryExchangeConfigDto): Promise<ExchangeConfig[]> {
    return this.repository.findAll(filter)
  }

  async findById(id: string): Promise<ExchangeConfig> {
    const record = await this.repository.findById(id)
    if (!record) {
      throw new DomainException('Exchange config not found', {
        code: ErrorCode.NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
      })
    }
    return record
  }

  async create(dto: CreateExchangeConfigDto): Promise<ExchangeConfig> {
    const normalizedCode = dto.code.trim().toUpperCase()
    const payload: CreateExchangeConfigDto = { ...dto, code: normalizedCode }

    const existing = await this.repository.findByCode(payload.code)
    if (existing) {
      throw new DomainException('Exchange code already exists', {
        code: ErrorCode.CONFLICT,
        status: HttpStatus.CONFLICT,
      })
    }

    try {
      return await this.repository.create(payload)
    }
    catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainException('Exchange code already exists', {
          code: ErrorCode.CONFLICT,
          status: HttpStatus.CONFLICT,
        })
      }
      throw error
    }
  }

  async update(id: string, dto: UpdateExchangeConfigDto): Promise<ExchangeConfig> {
    await this.findById(id)

    const normalized: UpdateExchangeConfigDto = { ...dto }
    if (dto.code !== undefined) normalized.code = dto.code.trim().toUpperCase()

    if (normalized.code) {
      const existing = await this.repository.findByCode(normalized.code)
      if (existing && existing.id !== id) {
        throw new DomainException('Exchange code already exists', {
          code: ErrorCode.CONFLICT,
          status: HttpStatus.CONFLICT,
        })
      }
    }

    try {
      return await this.repository.update(id, normalized)
    }
    catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new DomainException('Exchange code already exists', {
          code: ErrorCode.CONFLICT,
          status: HttpStatus.CONFLICT,
        })
      }
      throw error
    }
  }

  async delete(id: string): Promise<void> {
    await this.findById(id)
    await this.repository.delete(id)
  }
}

