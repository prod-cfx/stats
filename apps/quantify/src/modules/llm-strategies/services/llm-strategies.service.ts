import type { LlmStrategy, Prisma } from '@/prisma/prisma.types'
import type { CreateLlmStrategyDto } from '../dto/create-llm-strategy.dto'
import type { LlmStrategyListQueryDto } from '../dto/llm-strategy-list.query.dto'
import type { UpdateLlmStrategyDto } from '../dto/update-llm-strategy.dto'
import { Injectable } from '@nestjs/common'
import { Prisma as PrismaNamespace } from '@/prisma/prisma.types'

import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'

import { LlmStrategyNameConflictException } from '../exceptions/llm-strategy-name-conflict.exception'
import { LlmStrategyNotFoundException } from '../exceptions/llm-strategy-not-found.exception'
// eslint-disable-next-line ts/consistent-type-imports -- 闇€瑕佺敤浜庝緷璧栨敞鍏ワ紝涓嶈兘浣跨敤 import type
import { LlmStrategiesRepository } from '../repositories/llm-strategies.repository'

@Injectable()
export class LlmStrategiesService {
  private static readonly ORDERABLE_FIELDS = new Set<keyof LlmStrategy>([
    'createdAt',
    'updatedAt',
    'name',
  ])

  constructor(
    private readonly repository: LlmStrategiesRepository,
  ) {}

  async list(query: LlmStrategyListQueryDto) {
    const { page = 1, limit = 20, status, keyword, orderBy } = query
    const skip = (page - 1) * limit

    const parsedOrderBy = this.parseOrderBy(orderBy)
    const items = await this.repository.list({
      status,
      keyword,
      skip,
      take: limit,
      orderBy: parsedOrderBy,
    })

    // 鑾峰彇鎬绘暟
    const total = await this.repository.count({ status, keyword })

    return new BasePaginationResponseDto(total, page, limit, items)
  }

  async getDetail(id: string): Promise<LlmStrategy> {
    const record = await this.repository.findById(id)
    if (!record) {
      throw new LlmStrategyNotFoundException({ strategyId: id })
    }
    return record
  }

  async create(dto: CreateLlmStrategyDto, operatorId: string): Promise<LlmStrategy> {
    const payload: Prisma.LlmStrategyCreateInput = {
      name: dto.name,
      description: dto.description,
      status: 'draft',
      createdBy: operatorId,
      updatedBy: operatorId,
    }

    if (dto.systemPrompt !== undefined) {
      payload.systemPrompt = dto.systemPrompt
    }

    if (dto.initialPromptTemplate !== undefined) {
      payload.initialPromptTemplate = dto.initialPromptTemplate
    }

    if (dto.allowedSymbols !== undefined) {
      payload.allowedSymbols = dto.allowedSymbols as Prisma.InputJsonValue
    }

    if (dto.allowedTimeframes !== undefined) {
      payload.allowedTimeframes = dto.allowedTimeframes as Prisma.InputJsonValue
    }

    if (dto.riskConfig !== undefined) {
      payload.riskConfig = dto.riskConfig as Prisma.InputJsonValue
    }

    if (dto.metadata !== undefined) {
      payload.metadata = dto.metadata as Prisma.InputJsonValue
    }

    try {
      return await this.repository.create(payload)
    }
    catch (error) {
      // 鎹曡幏 Prisma 鍞竴绾︽潫鍐茬獊閿欒
      if (error instanceof PrismaNamespace.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new LlmStrategyNameConflictException({ name: dto.name })
      }
      throw error
    }
  }

  async update(id: string, dto: UpdateLlmStrategyDto, operatorId: string): Promise<LlmStrategy> {
    const current = await this.getDetail(id)

    const data: Prisma.LlmStrategyUpdateInput = {
      name: dto.name,
      description: dto.description,
      status: dto.status,
      systemPrompt: dto.systemPrompt !== undefined ? dto.systemPrompt : undefined,
      initialPromptTemplate: dto.initialPromptTemplate !== undefined ? dto.initialPromptTemplate : undefined,
      allowedSymbols: dto.allowedSymbols !== undefined
        ? (dto.allowedSymbols as Prisma.InputJsonValue | null)
        : undefined,
      allowedTimeframes: dto.allowedTimeframes !== undefined
        ? (dto.allowedTimeframes as Prisma.InputJsonValue | null)
        : undefined,
      riskConfig: dto.riskConfig !== undefined
        ? (dto.riskConfig as Prisma.InputJsonValue | null)
        : undefined,
      metadata: dto.metadata !== undefined
        ? (dto.metadata as Prisma.InputJsonValue | null)
        : undefined,
      updatedBy: operatorId,
    }

    try {
      const updated = await this.repository.update(id, data)
      if (!updated) {
        throw new LlmStrategyNotFoundException({ strategyId: id })
      }
      return updated
    }
    catch (error) {
      // 鎹曡幏 Prisma 鍞竴绾︽潫鍐茬獊閿欒
      if (error instanceof PrismaNamespace.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new LlmStrategyNameConflictException({ name: dto.name ?? current.name })
      }
      throw error
    }
  }

  async delete(id: string): Promise<void> {
    await this.getDetail(id)
    await this.repository.delete(id)
  }

  private parseOrderBy(orderBy?: string): Prisma.LlmStrategyOrderByWithRelationInput | undefined {
    if (!orderBy) return undefined
    const [field, direction] = orderBy.split(':')
    if (!field) return undefined
    if (!LlmStrategiesService.ORDERABLE_FIELDS.has(field as keyof LlmStrategy)) {
      return undefined
    }
    if (direction && direction.toLowerCase() === 'asc') {
      return { [field]: 'asc' }
    }
    return { [field]: 'desc' }
  }
}
