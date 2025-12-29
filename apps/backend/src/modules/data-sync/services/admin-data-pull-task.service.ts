import type { DataPullJob } from '../contracts/data-pull-job'
import type {
  AdminDataPullTaskListQueryDto,
  CreateAdminDataPullTaskDto,
  UpdateAdminDataPullTaskDto,
} from '../dto/admin-data-pull-task.dto'
import type { DataPullTask } from '../repositories/data-pull-task.repository'
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { DATA_PULL_JOB_REGISTRY } from '../data-sync.tokens'
import { AdminDataPullTaskResponseDto } from '../dto/admin-data-pull-task.dto'
import { DataPullTaskRepository } from '../repositories/data-pull-task.repository'

@Injectable()
export class AdminDataPullTaskService {
  private readonly registeredKeys: Set<string>

  constructor(
    @Inject(DataPullTaskRepository)
    private readonly taskRepo: DataPullTaskRepository,
    @Inject(DATA_PULL_JOB_REGISTRY)
    jobs: DataPullJob[],
  ) {
    this.registeredKeys = new Set(jobs.map(job => job.key))
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

  async create(dto: CreateAdminDataPullTaskDto): Promise<AdminDataPullTaskResponseDto> {
    // 校验 key 是否已注册（避免创建无法执行的任务导致调度器卡死）
    if (!this.registeredKeys.has(dto.key)) {
      throw new BadRequestException(
        `数据拉取任务 key "${dto.key}" 未注册，无法创建。当前已注册的 key: ${Array.from(this.registeredKeys).join(', ')}`,
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

    // 如果要启用任务，校验 key 是否已注册（避免启用无法执行的任务）
    if (dto.enabled && !this.registeredKeys.has(existing.key)) {
      throw new BadRequestException(
        `数据拉取任务 key "${existing.key}" 未注册，无法启用。当前已注册的 key: ${Array.from(this.registeredKeys).join(', ')}`,
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



