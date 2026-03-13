import type { LlmStrategyInstance, LlmStrategyInstanceStatus, Prisma } from '@/prisma/prisma.types'
import type { CreateLlmStrategyInstanceDto } from '../dto/create-llm-strategy-instance.dto'
import type { LlmStrategyInstanceListQueryDto } from '../dto/llm-strategy-instance-list.query.dto'
import type { UpdateLlmStrategyInstanceDto } from '../dto/update-llm-strategy-instance.dto'
import { Injectable, Logger } from '@nestjs/common'
import { Prisma as PrismaNamespace } from '@/prisma/prisma.types'

import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'

import { LlmStrategyInstanceNameConflictException } from '../exceptions/llm-strategy-instance-name-conflict.exception'
import { LlmStrategyInstanceNotFoundException } from '../exceptions/llm-strategy-instance-not-found.exception'
import { LlmStrategyNotLiveException } from '../exceptions/llm-strategy-not-live.exception'
// eslint-disable-next-line ts/consistent-type-imports -- 需要用于依赖注入，不能使用 import type
import { LlmStrategyInstancesRepository } from '../repositories/llm-strategy-instances.repository'
// eslint-disable-next-line ts/consistent-type-imports -- 需要用于依赖注入，不能使用 import type
import { LlmStrategiesService } from './llm-strategies.service'
// eslint-disable-next-line ts/consistent-type-imports -- 需要用于依赖注入，不能使用 import type
import { LlmStrategyInstanceSchedulerService } from './llm-strategy-instance-scheduler.service'

@Injectable()
export class LlmStrategyInstancesService {
  private readonly logger = new Logger(LlmStrategyInstancesService.name)
  private static readonly ORDERABLE_FIELDS = new Set<keyof LlmStrategyInstance>([
    'createdAt',
    'updatedAt',
    'lastRunAt',
  ])

  constructor(
    private readonly repository: LlmStrategyInstancesRepository,
    private readonly strategiesService: LlmStrategiesService,
    private readonly scheduler: LlmStrategyInstanceSchedulerService,
  ) {}

  async list(query: LlmStrategyInstanceListQueryDto) {
    const { page = 1, limit = 20, status, strategyId, orderBy } = query
    const skip = (page - 1) * limit

    const parsedOrderBy = this.parseOrderBy(orderBy)
    const items = await this.repository.list({
      status,
      strategyId,
      skip,
      take: limit,
      orderBy: parsedOrderBy,
    })

    const total = await this.repository.count({
      status,
      strategyId,
    })

    return new BasePaginationResponseDto(total, page, limit, items)
  }

  async getDetail(id: string): Promise<LlmStrategyInstance> {
    const record = await this.repository.findById(id)
    if (!record) {
      throw new LlmStrategyInstanceNotFoundException({ instanceId: id })
    }
    return record
  }

  async getDetailWithStrategy(id: string) {
    const record = await this.repository.findByIdWithStrategy(id)
    if (!record) {
      throw new LlmStrategyInstanceNotFoundException({ instanceId: id })
    }
    return record
  }

  async create(dto: CreateLlmStrategyInstanceDto, operatorId: string): Promise<LlmStrategyInstance> {
    // 验证策略存在且处于上线状态
    const strategy = await this.strategiesService.getDetail(dto.strategyId)
    if (strategy.status !== 'live') {
      throw new LlmStrategyNotLiveException({ strategyId: dto.strategyId, status: strategy.status })
    }

    const payload: Prisma.LlmStrategyInstanceCreateInput = {
      strategy: {
        connect: { id: dto.strategyId },
      },
      name: dto.name,
      mode: dto.mode,
      llmModel: dto.llmModel,
      status: 'paused',
      createdBy: operatorId,
      updatedBy: operatorId,
    }

    if (dto.scheduleCron !== undefined) {
      payload.scheduleCron = dto.scheduleCron
    }

    if (dto.maxToolCallsPerRun !== undefined) {
      payload.maxToolCallsPerRun = dto.maxToolCallsPerRun
    }

    if (dto.maxRunsPerHour !== undefined) {
      payload.maxRunsPerHour = dto.maxRunsPerHour
    }

    if (dto.cooldownSeconds !== undefined) {
      payload.cooldownSeconds = dto.cooldownSeconds
    }

    if (dto.configOverrides !== undefined) {
      payload.configOverrides = dto.configOverrides as Prisma.InputJsonValue
    }

    if (dto.metadata !== undefined) {
      payload.metadata = dto.metadata as Prisma.InputJsonValue
    }

    try {
      return await this.repository.create(payload)
    }
    catch (error) {
      // 捕获 Prisma 唯一约束冲突错误
      if (error instanceof PrismaNamespace.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new LlmStrategyInstanceNameConflictException({ 
          name: dto.name, 
          strategyId: dto.strategyId,
        })
      }
      throw error
    }
  }

  async update(id: string, dto: UpdateLlmStrategyInstanceDto, operatorId: string): Promise<LlmStrategyInstance> {
    const current = await this.getDetail(id)

    const data: Prisma.LlmStrategyInstanceUpdateInput = {
      name: dto.name,
      status: dto.status,
      mode: dto.mode,
      llmModel: dto.llmModel,
      scheduleCron: dto.scheduleCron !== undefined ? dto.scheduleCron : undefined,
      maxToolCallsPerRun: dto.maxToolCallsPerRun,
      maxRunsPerHour: dto.maxRunsPerHour,
      cooldownSeconds: dto.cooldownSeconds,
      configOverrides: dto.configOverrides !== undefined
        ? (dto.configOverrides as Prisma.InputJsonValue | null)
        : undefined,
      metadata: dto.metadata !== undefined
        ? (dto.metadata as Prisma.InputJsonValue | null)
        : undefined,
      updatedBy: operatorId,
    }

    try {
      const updated = await this.repository.update(id, data)
      if (!updated) {
        throw new LlmStrategyInstanceNotFoundException({ instanceId: id })
      }

      // 🔄 状态变更后自动管理调度任务
      if (dto.status !== undefined && dto.status !== current.status) {
        await this.handleSchedulerOnStatusChange(updated, current.status, dto.status)
      }
      
      // scheduleCron 变更：running 状态下允许动态重启/停止调度
      if (updated.status === 'running' && dto.scheduleCron !== undefined) {
        if (updated.scheduleCron) {
          await this.scheduler.restartInstance(updated.id)
          this.logger.log(`LLM实例 ${updated.id} 的 scheduleCron 已更新，重启调度任务`)
        } else {
          // 管理员清空 scheduleCron：视为“暂停自动调度但仍允许手动触发”，需显式 stop
          await this.scheduler.stopInstance(updated.id)
          this.logger.log(`LLM实例 ${updated.id} 的 scheduleCron 已清空，已停止调度任务`)
        }
      }

      return updated
    }
    catch (error) {
      // 捕获 Prisma 唯一约束冲突错误
      if (error instanceof PrismaNamespace.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new LlmStrategyInstanceNameConflictException({ 
          name: dto.name ?? current.name,
          strategyId: current.strategyId,
        })
      }
      throw error
    }
  }

  async delete(id: string): Promise<void> {
    await this.getDetail(id)
    
    // 删除前清理调度任务
    await this.scheduler.stopInstance(id)
    
    // 删除实例会级联删除相关的runs
    await this.repository.delete(id)
  }

  /**
   * 状态变更时自动管理调度任务
   * - running: 启动实例的调度任务（如果设置了scheduleCron）
   * - paused/stopped: 停止实例的调度任务
   */
  private async handleSchedulerOnStatusChange(
    instance: LlmStrategyInstance,
    oldStatus: LlmStrategyInstanceStatus,
    newStatus: LlmStrategyInstanceStatus,
  ): Promise<void> {
    try {
      if (newStatus === 'running' && oldStatus !== 'running') {
        // 实例启动 -> 启动调度任务（未设置 cron 时使用默认值）
        this.logger.log(
          `LLM实例 ${instance.id} 启动，正在创建调度任务${instance.scheduleCron ? '' : '（使用默认 cron）'}...`
        )
        await this.scheduler.startInstance(instance)
      } else if (newStatus !== 'running' && oldStatus === 'running') {
        // 实例停止/暂停 -> 停止调度任务
        this.logger.log(`LLM实例 ${instance.id} ${newStatus === 'paused' ? '暂停' : '停止'}，正在清理调度任务...`)
        await this.scheduler.stopInstance(instance.id)
      }
    } catch (error) {
      this.logger.error(
        `管理LLM实例 ${instance.id} 的调度任务失败: ${(error as Error).message}`,
        (error as Error).stack,
      )
      // 调度任务失败不应阻塞状态更新，只记录错误
    }
  }

  private parseOrderBy(orderBy?: string): Prisma.LlmStrategyInstanceOrderByWithRelationInput | undefined {
    if (!orderBy) return undefined
    const [field, direction] = orderBy.split(':')
    if (!field) return undefined
    if (!LlmStrategyInstancesService.ORDERABLE_FIELDS.has(field as keyof LlmStrategyInstance)) {
      return undefined
    }
    if (direction && direction.toLowerCase() === 'asc') {
      return { [field]: 'asc' }
    }
    return { [field]: 'desc' }
  }
}
