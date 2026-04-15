import type { DataPullJob, DataPullJobContext, JobMetaSchema } from '../contracts/data-pull-job'
import type {
  AdminDataPullExecutionResponseDto,
  AdminDataPullTaskListQueryDto,
  AdminDataPullTaskResponseDto,
  CreateAdminDataPullTaskDto,
  UpdateAdminDataPullTaskDto,
} from '../dto/admin-data-pull-task.dto'
import type { DataPullTask } from '../repositories/data-pull-task.repository'
import type { RegisteredJobInfo } from './data-pull-job-registry.resolver'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Inject, Injectable } from '@nestjs/common'
import { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'
import { DomainException } from '@/common/exceptions/domain.exception'
import { DATA_PULL_JOB_REGISTRY } from '../data-sync.tokens'
import { DataPullExecutionRepository } from '../repositories/data-pull-execution.repository'
import { DataPullTaskRepository } from '../repositories/data-pull-task.repository'
import {
  toAdminDataPullExecutionResponseDto,
  toAdminDataPullTaskResponseDto,
} from './admin-data-pull-task.mapper'
import { DataPullJobRegistryResolver } from './data-pull-job-registry.resolver'

@Injectable()
export class AdminDataPullTaskService {
  private readonly registryResolver: DataPullJobRegistryResolver

  constructor(
    @Inject(DataPullTaskRepository)
    private readonly taskRepo: DataPullTaskRepository,
    @Inject(DATA_PULL_JOB_REGISTRY)
    jobs: DataPullJob[],
    @Inject(DataPullExecutionRepository)
    private readonly execRepo: DataPullExecutionRepository,
  ) {
    this.registryResolver = new DataPullJobRegistryResolver(jobs)
  }

  getRegisteredKeys(): string[] {
    return this.registryResolver.getRegisteredKeys()
  }

  getRegisteredJobs(): RegisteredJobInfo[] {
    return this.registryResolver.getRegisteredJobs()
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
      throw new DomainException('data_sync.task_not_found', {
        code: ErrorCode.DATA_SYNC_TASK_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { taskId: id },
      })
    }

    const now = new Date()

    const job = this.registryResolver.findJobForTask(task.key)
    if (!job) {
      throw new DomainException('data_sync.task_key_not_registered', {
        code: ErrorCode.DATA_SYNC_TASK_KEY_NOT_REGISTERED,
        status: HttpStatus.BAD_REQUEST,
        args: { key: task.key, registeredKeys: this.registryResolver.getRegisteredKeys().join(', ') },
      })
    }

    // 通过乐观锁方式标记为 RUNNING，避免并发”立即执行”导致重复跑同一任务
    const claimed = await this.taskRepo.tryMarkRunningOnce(task.id, now)
    if (!claimed) {
      throw new DomainException('data_sync.task_already_running', {
        code: ErrorCode.DATA_SYNC_TASK_ALREADY_RUNNING,
        status: HttpStatus.BAD_REQUEST,
        args: { key: task.key },
      })
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

      return toAdminDataPullExecutionResponseDto({
        ...exec,
        status: 'SUCCESS',
        fetchedCount: result.fetchedCount,
        finishedAt: finished,
        errorMessage: null,
        meta: result.meta ?? null,
      })
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
      throw new DomainException('data_sync.task_not_found', {
        code: ErrorCode.DATA_SYNC_TASK_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { taskId: id },
      })
    }

    if (task.lastStatus !== 'RUNNING') {
      throw new DomainException('data_sync.task_not_interruptible', {
        code: ErrorCode.DATA_SYNC_TASK_NOT_INTERRUPTIBLE,
        status: HttpStatus.BAD_REQUEST,
        args: { name: task.name, status: task.lastStatus ?? 'IDLE' },
      })
    }

    const reset = await this.taskRepo.forceResetStatus(id)
    if (!reset) {
      throw new DomainException('data_sync.task_status_changed', {
        code: ErrorCode.DATA_SYNC_TASK_STATUS_CHANGED,
        status: HttpStatus.BAD_REQUEST,
      })
    }

    return { success: true, message: `任务 "${task.name}" 已中断，状态已重置为 IDLE` }
  }

  async list(
    query: AdminDataPullTaskListQueryDto,
  ): Promise<BasePaginationResponseDto<AdminDataPullTaskResponseDto>> {
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
      throw new DomainException('data_sync.task_not_found', {
        code: ErrorCode.DATA_SYNC_TASK_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { taskId: id },
      })
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
      throw new DomainException('data_sync.task_not_found', {
        code: ErrorCode.DATA_SYNC_TASK_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { taskId },
      })
    }

    const { total, items } = await this.execRepo.listByTaskId(taskId, page, limit)
    const mapped = items.map(exec => toAdminDataPullExecutionResponseDto(exec))

    return new BasePaginationResponseDto(total, page, limit, mapped)
  }

  async create(dto: CreateAdminDataPullTaskDto): Promise<AdminDataPullTaskResponseDto> {
    // 校验 key 是否已注册（支持精确匹配和前缀匹配，如 "job-key:BTC"）
    if (!this.registryResolver.isKeyRegistered(dto.key)) {
      throw new DomainException('data_sync.task_key_not_registered', {
        code: ErrorCode.DATA_SYNC_TASK_KEY_NOT_REGISTERED,
        status: HttpStatus.BAD_REQUEST,
        args: { key: dto.key, registeredKeys: this.registryResolver.getRegisteredKeys().join(', ') },
      })
    }

    // 检查 key 是否已存在
    const existing = await this.taskRepo.findByKey(dto.key)
    if (existing) {
      throw new DomainException('data_sync.task_key_duplicate', {
        code: ErrorCode.DATA_SYNC_TASK_KEY_DUPLICATE,
        status: HttpStatus.BAD_REQUEST,
        args: { key: dto.key },
      })
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
      throw new DomainException('data_sync.task_not_found', {
        code: ErrorCode.DATA_SYNC_TASK_NOT_FOUND,
        status: HttpStatus.NOT_FOUND,
        args: { taskId: id },
      })
    }

    // 如果要启用任务，校验 key 是否已注册（支持精确匹配和前缀匹配）
    if (dto.enabled && !this.registryResolver.isKeyRegistered(existing.key)) {
      throw new DomainException('data_sync.task_key_not_registered', {
        code: ErrorCode.DATA_SYNC_TASK_KEY_NOT_REGISTERED,
        status: HttpStatus.BAD_REQUEST,
        args: { key: existing.key, registeredKeys: this.registryResolver.getRegisteredKeys().join(', ') },
      })
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
    return toAdminDataPullTaskResponseDto(task)
  }
}
