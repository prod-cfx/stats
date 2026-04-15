import type { DataPullExecution } from '../repositories/data-pull-execution.repository'
import type { DataPullTask } from '../repositories/data-pull-task.repository'
import {
  AdminDataPullExecutionResponseDto,
  AdminDataPullTaskResponseDto,
} from '../dto/admin-data-pull-task.dto'

export function toAdminDataPullTaskResponseDto(task: DataPullTask): AdminDataPullTaskResponseDto {
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

export function toAdminDataPullExecutionResponseDto(exec: DataPullExecution): AdminDataPullExecutionResponseDto {
  const dto = new AdminDataPullExecutionResponseDto()
  dto.id = exec.id
  dto.taskId = exec.taskId
  dto.status = exec.status
  dto.fetchedCount = exec.fetchedCount
  dto.startedAt = exec.startedAt
  dto.finishedAt = exec.finishedAt
  dto.errorMessage = exec.errorMessage
  dto.meta = (exec.meta ?? null) as any
  return dto
}
