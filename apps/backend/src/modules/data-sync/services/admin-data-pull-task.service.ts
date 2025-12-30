import type { DataPullJob, JobMetaSchema } from '../contracts/data-pull-job'
import type {
  AdminDataPullExecutionResponseDto,
  AdminDataPullTaskListQueryDto,
  CreateAdminDataPullTaskDto,
  UpdateAdminDataPullTaskDto,
} from '../dto/admin-data-pull-task.dto'
import type { DataPullTask } from '../repositories/data-pull-task.repository'
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { DATA_PULL_JOB_REGISTRY } from '../data-sync.tokens'
import { AdminDataPullTaskResponseDto } from '../dto/admin-data-pull-task.dto'
import { DataPullExecutionRepository } from '../repositories/data-pull-execution.repository'
import { DataPullTaskRepository } from '../repositories/data-pull-task.repository'

/**
 * Job 信息（用于前端展示）
 */
export interface RegisteredJobInfo {
  /** Job 唯一标识 */
  key: string
  /** Job 名称（用于展示） */
  name: string
  /** Meta 配置格式说明 */
  metaSchema: JobMetaSchema | null
}

@Injectable()
export class AdminDataPullTaskService {
  private readonly registeredKeys: Set<string>
  private readonly jobsMap: Map<string, DataPullJob>

  constructor(
    @Inject(DataPullTaskRepository)
    private readonly taskRepo: DataPullTaskRepository,
    @Inject(DATA_PULL_JOB_REGISTRY)
    jobs: DataPullJob[],
    @Inject(DataPullExecutionRepository)
    private readonly execRepo: DataPullExecutionRepository,
  ) {
    this.registeredKeys = new Set(jobs.map(job => job.key))
    this.jobsMap = new Map(jobs.map(job => [job.key, job]))
  }

  /**
   * 获取所有已在代码中注册的 Job key 列表
   * 用于前端创建任务时的下拉选择
   */
  getRegisteredKeys(): string[] {
    return Array.from(this.registeredKeys).sort()
  }

  /**
   * 获取所有已注册的 Job 详细信息（包含 metaSchema）
   * 用于前端展示 meta 配置说明
   */
  getRegisteredJobs(): RegisteredJobInfo[] {
    return Array.from(this.jobsMap.values())
      .map(job => ({
        key: job.key,
        name: job.name ?? job.key,
        metaSchema: job.metaSchema ?? null,
      }))
      .sort((a, b) => a.key.localeCompare(b.key))
  }

  /**
   * 检查任务 key 是否有对应的 Job 实现
   * 支持两种匹配模式：
   * 1. 精确匹配：taskKey === job.key
   * 2. 前缀匹配：taskKey 以 "job.key:" 开头（用于支持同一 Job 类型的多个任务实例）
   *
   * 例如：
   * - "coinglass-aggregated-liquidation" 精确匹配
   * - "coinglass-aggregated-liquidation:BTC" 前缀匹配 "coinglass-aggregated-liquidation"
   */
  private isKeyRegistered(taskKey: string): boolean {
    // 精确匹配
    if (this.registeredKeys.has(taskKey)) {
      return true
    }

    // 前缀匹配：taskKey 格式为 "jobKey:suffix"
    const colonIndex = taskKey.indexOf(':')
    if (colonIndex > 0) {
      const jobKeyPrefix = taskKey.slice(0, colonIndex)
      return this.registeredKeys.has(jobKeyPrefix)
    }

    return false
  }

  async list(query: AdminDataPullTaskListQueryDto): Promise<BasePaginationResponseDto<AdminDataPullTaskResponseDto>> {
    const page = query.page ?? 1
    const limit = query.limit ?? 20

    const { total, items } = await this.taskRepo.listTasks({
      page,
      limit,
      key: query.key,
      name: query.name,
      enabled: query.enabled,
    })

    const mapped = items.map(task => this.toResponseDto(task))

    return new BasePaginationResponseDto(total, page, limit, mapped)
  }

  async findById(id: number): Promise<AdminDataPullTaskResponseDto> {
    const task = await this.taskRepo.findById(id)
    if (!task) {
      throw new NotFoundException(`DataPullTask#${id} 不存在`)
    }
    return this.toResponseDto(task)
  }

  /**
   * 分页查询指定任务的执行历史
   */
  async listExecutions(
    taskId: number,
    page: number,
    limit: number,
  ): Promise<BasePaginationResponseDto<AdminDataPullExecutionResponseDto>> {
    const task = await this.taskRepo.findById(taskId)
    if (!task) {
      throw new NotFoundException(`DataPullTask#${taskId} 不存在`)
    }

    const { total, items } = await this.execRepo.listByTaskId(taskId, page, limit)
    const mapped: AdminDataPullExecutionResponseDto[] = items.map(exec => ({
      id: exec.id,
      taskId: exec.taskId,
      status: exec.status,
      fetchedCount: exec.fetchedCount,
      startedAt: exec.startedAt,
      finishedAt: exec.finishedAt,
      errorMessage: exec.errorMessage,
      meta: (exec.meta ?? null) as any,
    }))

    return new BasePaginationResponseDto(total, page, limit, mapped)
  }

  async create(dto: CreateAdminDataPullTaskDto): Promise<AdminDataPullTaskResponseDto> {
    // 校验 key 是否已注册（支持精确匹配和前缀匹配，如 "job-key:BTC"）
    if (!this.isKeyRegistered(dto.key)) {
      throw new BadRequestException(
        `数据拉取任务 key "${dto.key}" 未注册，无法创建。支持的格式：精确匹配或 "jobKey:suffix"。当前已注册的 Job key: ${Array.from(this.registeredKeys).join(', ')}`,
      )
    }

    // 检查 key 是否已存在
    const existing = await this.taskRepo.findByKey(dto.key)
    if (existing) {
      throw new BadRequestException(
        `数据拉取任务 key "${dto.key}" 已存在，请使用不同的后缀或编辑已有任务`,
      )
    }

    const created = await this.taskRepo.createTask({
      key: dto.key,
      name: dto.name,
      source: dto.source,
      type: dto.type,
      cron: dto.cron,
      intervalSeconds: dto.intervalSeconds,
      enabled: dto.enabled,
      cursor: dto.cursor,
      meta: dto.meta ?? null,
    })
    return this.toResponseDto(created)
  }

  async update(id: number, dto: UpdateAdminDataPullTaskDto): Promise<AdminDataPullTaskResponseDto> {
    const existing = await this.taskRepo.findById(id)
    if (!existing) {
      throw new NotFoundException(`DataPullTask#${id} 不存在`)
    }

    // 如果要启用任务，校验 key 是否已注册（支持精确匹配和前缀匹配）
    if (dto.enabled && !this.isKeyRegistered(existing.key)) {
      throw new BadRequestException(
        `数据拉取任务 key "${existing.key}" 未注册，无法启用。支持的格式：精确匹配或 "jobKey:suffix"。当前已注册的 Job key: ${Array.from(this.registeredKeys).join(', ')}`,
      )
    }

    const updated = await this.taskRepo.updateTask(id, {
      name: dto.name,
      source: dto.source,
      type: dto.type,
      cron: dto.cron,
      intervalSeconds: dto.intervalSeconds,
      enabled: dto.enabled,
      cursor: dto.cursor,
      meta: dto.meta,
    })

    return this.toResponseDto(updated)
  }

  async delete(id: number): Promise<void> {
    const existing = await this.taskRepo.findById(id)
    if (!existing) {
      // 幂等删除
      return
    }
    await this.taskRepo.deleteTask(id)
  }

  private toResponseDto(task: DataPullTask): AdminDataPullTaskResponseDto {
    const dto = new AdminDataPullTaskResponseDto()
    dto.id = task.id
    dto.key = task.key
    dto.name = task.name
    dto.source = task.source
    dto.type = task.type
    dto.cron = task.cron
    dto.intervalSeconds = task.intervalSeconds
    dto.enabled = task.enabled
    dto.cursor = task.cursor
    dto.lastStatus = task.lastStatus
    dto.lastRunAt = task.lastRunAt
    dto.lastSuccessAt = task.lastSuccessAt
    dto.lastError = task.lastError
    dto.meta = (task.meta ?? null) as any
    dto.createdAt = task.createdAt
    dto.updatedAt = task.updatedAt
    return dto
  }
}



