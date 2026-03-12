import type { LlmStrategyInstance, LlmStrategyInstanceStatus, Prisma } from '@prisma/client'
import type { CreateLlmStrategyInstanceDto } from '../dto/create-llm-strategy-instance.dto'
import type { LlmStrategyInstanceListQueryDto } from '../dto/llm-strategy-instance-list.query.dto'
import type { UpdateLlmStrategyInstanceDto } from '../dto/update-llm-strategy-instance.dto'
import { Injectable, Logger } from '@nestjs/common'
import { Prisma as PrismaNamespace } from '@prisma/client'

import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'

import { LlmStrategyInstanceNameConflictException } from '../exceptions/llm-strategy-instance-name-conflict.exception'
import { LlmStrategyInstanceNotFoundException } from '../exceptions/llm-strategy-instance-not-found.exception'
import { LlmStrategyNotLiveException } from '../exceptions/llm-strategy-not-live.exception'
// eslint-disable-next-line ts/consistent-type-imports -- 闇€瑕佺敤浜庝緷璧栨敞鍏ワ紝涓嶈兘浣跨敤 import type
import { LlmStrategyInstancesRepository } from '../repositories/llm-strategy-instances.repository'
// eslint-disable-next-line ts/consistent-type-imports -- 闇€瑕佺敤浜庝緷璧栨敞鍏ワ紝涓嶈兘浣跨敤 import type
import { LlmStrategiesService } from './llm-strategies.service'
// eslint-disable-next-line ts/consistent-type-imports -- 闇€瑕佺敤浜庝緷璧栨敞鍏ワ紝涓嶈兘浣跨敤 import type
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
    // 楠岃瘉绛栫暐瀛樺湪涓斿浜庝笂绾跨姸鎬?
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
      // 鎹曡幏 Prisma 鍞竴绾︽潫鍐茬獊閿欒
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

      // 馃攧 鐘舵€佸彉鏇村悗鑷姩绠＄悊璋冨害浠诲姟
      if (dto.status !== undefined && dto.status !== current.status) {
        await this.handleSchedulerOnStatusChange(updated, current.status, dto.status)
      }

      // scheduleCron 鍙樻洿锛歳unning 鐘舵€佷笅鍏佽鍔ㄦ€侀噸鍚?鍋滄璋冨害
      if (updated.status === 'running' && dto.scheduleCron !== undefined) {
        if (updated.scheduleCron) {
          await this.scheduler.restartInstance(updated.id)
          this.logger.log(`LLM瀹炰緥 ${updated.id} 鐨?scheduleCron 宸叉洿鏂帮紝閲嶅惎璋冨害浠诲姟`)
        } else {
          // 绠＄悊鍛樻竻绌?scheduleCron锛氳涓衡€滄殏鍋滆嚜鍔ㄨ皟搴︿絾浠嶅厑璁告墜鍔ㄨЕ鍙戔€濓紝闇€鏄惧紡 stop
          await this.scheduler.stopInstance(updated.id)
          this.logger.log(`LLM瀹炰緥 ${updated.id} 鐨?scheduleCron 宸叉竻绌猴紝宸插仠姝㈣皟搴︿换鍔)
        }
      }

      return updated
    }
    catch (error) {
      // 鎹曡幏 Prisma 鍞竴绾︽潫鍐茬獊閿欒
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

    // 鍒犻櫎鍓嶆竻鐞嗚皟搴︿换鍔?
    await this.scheduler.stopInstance(id)

    // 鍒犻櫎瀹炰緥浼氱骇鑱斿垹闄ょ浉鍏崇殑runs
    await this.repository.delete(id)
  }

  /**
   * 鐘舵€佸彉鏇存椂鑷姩绠＄悊璋冨害浠诲姟
   * - running: 鍚姩瀹炰緥鐨勮皟搴︿换鍔★紙濡傛灉璁剧疆浜唖cheduleCron锛?
   * - paused/stopped: 鍋滄瀹炰緥鐨勮皟搴︿换鍔?
   */
  private async handleSchedulerOnStatusChange(
    instance: LlmStrategyInstance,
    oldStatus: LlmStrategyInstanceStatus,
    newStatus: LlmStrategyInstanceStatus,
  ): Promise<void> {
    try {
      if (newStatus === 'running' && oldStatus !== 'running') {
        // 瀹炰緥鍚姩 -> 鍚姩璋冨害浠诲姟锛堟湭璁剧疆 cron 鏃朵娇鐢ㄩ粯璁ゅ€硷級
        this.logger.log(
          `LLM瀹炰緥 ${instance.id} 鍚姩锛屾鍦ㄥ垱寤鸿皟搴︿换鍔?{instance.scheduleCron ? '' : '锛堜娇鐢ㄩ粯璁?cron锛?}...`
        )
        await this.scheduler.startInstance(instance)
      } else if (newStatus !== 'running' && oldStatus === 'running') {
        // 瀹炰緥鍋滄/鏆傚仠 -> 鍋滄璋冨害浠诲姟
        this.logger.log(`LLM瀹炰緥 ${instance.id} ${newStatus === 'paused' ? '鏆傚仠' : '鍋滄'}锛屾鍦ㄦ竻鐞嗚皟搴︿换鍔?..`)
        await this.scheduler.stopInstance(instance.id)
      }
    } catch (error) {
      this.logger.error(
        `绠＄悊LLM瀹炰緥 ${instance.id} 鐨勮皟搴︿换鍔″け璐? ${(error as Error).message}`,
        (error as Error).stack,
      )
      // 璋冨害浠诲姟澶辫触涓嶅簲闃诲鐘舵€佹洿鏂帮紝鍙褰曢敊璇?
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
