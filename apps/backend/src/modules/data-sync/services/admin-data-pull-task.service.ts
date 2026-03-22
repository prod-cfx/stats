import type {
  DataPullJob,
  DataPullJobContext,
  JobMetaSchema,
} from '../contracts/data-pull-job'
import type {
  AdminDataPullTaskListQueryDto,
  CreateAdminDataPullTaskDto,
  UpdateAdminDataPullTaskDto,
} from '../dto/admin-data-pull-task.dto'
import type { DataPullTask } from '../repositories/data-pull-task.repository'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { DomainException } from '@/common/exceptions/domain.exception'
import { DATA_PULL_JOB_REGISTRY } from '../data-sync.tokens'
import {
  AdminDataPullExecutionResponseDto,
  AdminDataPullTaskResponseDto,
} from '../dto/admin-data-pull-task.dto'
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
   * 根据任务 key 查找对应的 Job 实现
   * - 支持精确匹配和前缀匹配（key 以 "job.key:" 开头）
   */
  private findJobForTask(taskKey: string): DataPullJob | undefined {
    // 优先精确匹配
    const exactMatch = this.jobsMap.get(taskKey)
    if (exactMatch) {
      return exactMatch
    }

    // 前缀匹配：taskKey 格式为 "jobKey:suffix"
    const colonIndex = taskKey.indexOf(':')
    if (colonIndex > 0) {
      const jobKeyPrefix = taskKey.slice(0, colonIndex)
      return this.jobsMap.get(jobKeyPrefix)
    }

    return undefined
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

  /**
   * 手动触发指定任务执行一次（主要用于测试，不受 intervalSeconds 限制）
   *
   * 注意：
   * - 如果任务当前处于 RUNNING 状态，会直接报错，避免并发执行同一任务
   * - 执行结果和错误信息会正常写入 data_pull_executions / data_pull_tasks
   */
  async triggerOnce(id: number): Promise<AdminDataPullExecutionResponseDto> {
    const task = await this.taskRepo.findById(id)
    if (!task) {
      throw new DomainException('data_sync.task_not_found', { code: ErrorCode.DATA_SYNC_TASK_NOT_FOUND, status: HttpStatus.NOT_FOUND, args: { taskId: id } })
    }

    const now = new Date()

    const job = this.findJobForTask(task.key)
    if (!job) {
      throw new DomainException('data_sync.task_key_not_registered', { code: ErrorCode.DATA_SYNC_TASK_KEY_NOT_REGISTERED, status: HttpStatus.BAD_REQUEST, args: { key: task.key, registeredKeys: Array.from(this.registeredKeys).join(', ') } })
    }

    // 通过乐观锁方式标记为 RUNNING，避免并发”立即执行”导致重复跑同一任务
    const claimed = await this.taskRepo.tryMarkRunningOnce(task.id, now)
    if (!claimed) {
      throw new DomainException('data_sync.task_already_running', { code: ErrorCode.DATA_SYNC_TASK_ALREADY_RUNNING, status: HttpStatus.BAD_REQUEST, args: { key: task.key } })
    }

    // 记录一次新的执行历史
    const exec = await this.execRepo.createStart(task.id, now)

    try {
      const ctx: DataPullJobContext = {
        taskId: task.id,
        key: task.key,
        cursor: task.cursor ?? null,
        meta: (task.meta ?? null) as any,
        now,
      }

      const result = await job.run(ctx)
      const finished = new Date()

      await this.execRepo.markSuccess(exec.id, finished, result)
      await this.taskRepo.markSuccess(
        task.id,
        finished,
        result.newCursor ?? task.cursor ?? null,
        result.meta,
      )

      const dto = new AdminDataPullExecutionResponseDto()
      dto.id = exec.id
      dto.taskId = task.id
      dto.status = 'SUCCESS'
      dto.fetchedCount = result.fetchedCount
      dto.startedAt = exec.startedAt
      dto.finishedAt = finished
      dto.errorMessage = null
      dto.meta = (result.meta ?? null) as any

      return dto
    } catch (error) {
      const finished = new Date()
      await this.execRepo.markFailed(exec.id, finished, error)
      await this.taskRepo.markFailed(task.id, finished, error)

      // 直接抛出原始错误，HTTP 层会返回 500 / 4xx
      throw error
    }
  }

  /**
   * 中断（重置）正在运行的任务
   * 将 lastStatus 从 RUNNING 重置为 IDLE，使任务可以被重新调度
   */
  async interruptTask(id: number): Promise<{ success: boolean; message: string }> {
    const task = await this.taskRepo.findById(id)
    if (!task) {
      throw new DomainException('data_sync.task_not_found', { code: ErrorCode.DATA_SYNC_TASK_NOT_FOUND, status: HttpStatus.NOT_FOUND, args: { taskId: id } })
    }

    if (task.lastStatus !== 'RUNNING') {
      throw new DomainException('data_sync.task_not_interruptible', { code: ErrorCode.DATA_SYNC_TASK_NOT_INTERRUPTIBLE, status: HttpStatus.BAD_REQUEST, args: { name: task.name, status: task.lastStatus ?? 'IDLE' } })
    }

    const reset = await this.taskRepo.forceResetStatus(id)
    if (!reset) {
      throw new DomainException('data_sync.task_status_changed', { code: ErrorCode.DATA_SYNC_TASK_STATUS_CHANGED, status: HttpStatus.BAD_REQUEST })
    }

    return { success: true, message: `任务 "${task.name}" 已中断，状态已重置为 IDLE` }
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
      throw new DomainException('data_sync.task_not_found', { code: ErrorCode.DATA_SYNC_TASK_NOT_FOUND, status: HttpStatus.NOT_FOUND, args: { taskId: id } })
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
      throw new DomainException('data_sync.task_not_found', { code: ErrorCode.DATA_SYNC_TASK_NOT_FOUND, status: HttpStatus.NOT_FOUND, args: { taskId } })
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
      throw new DomainException('data_sync.task_key_not_registered', { code: ErrorCode.DATA_SYNC_TASK_KEY_NOT_REGISTERED, status: HttpStatus.BAD_REQUEST, args: { key: dto.key, registeredKeys: Array.from(this.registeredKeys).join(', ') } })
    }

    // 检查 key 是否已存在
    const existing = await this.taskRepo.findByKey(dto.key)
    if (existing) {
      throw new DomainException('data_sync.task_key_duplicate', { code: ErrorCode.DATA_SYNC_TASK_KEY_DUPLICATE, status: HttpStatus.BAD_REQUEST, args: { key: dto.key } })
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
      throw new DomainException('data_sync.task_not_found', { code: ErrorCode.DATA_SYNC_TASK_NOT_FOUND, status: HttpStatus.NOT_FOUND, args: { taskId: id } })
    }

    // 如果要启用任务，校验 key 是否已注册（支持精确匹配和前缀匹配）
    if (dto.enabled && !this.isKeyRegistered(existing.key)) {
      throw new DomainException('data_sync.task_key_not_registered', { code: ErrorCode.DATA_SYNC_TASK_KEY_NOT_REGISTERED, status: HttpStatus.BAD_REQUEST, args: { key: existing.key, registeredKeys: Array.from(this.registeredKeys).join(', ') } })
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

