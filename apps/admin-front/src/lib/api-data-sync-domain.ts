import type { DataPullTask } from './api'
import type { schemas } from '@ai/api-contracts'
import type { z } from 'zod'

import { client, requireAuthHeaders, unwrapResponse, withAuthErrorHandling } from './api-access'

type _CreateDataPullTaskDto = z.infer<typeof schemas.CreateAdminDataPullTaskDto>
type _UpdateDataPullTaskDto = z.infer<typeof schemas.UpdateAdminDataPullTaskDto>
type _DataPullExecutionDto = z.infer<typeof schemas.AdminDataPullExecutionResponseDto>

export interface InterruptDataPullTaskResult {
  success: boolean
  message: string
}

interface PaginationResult<T> {
  total: number
  page: number
  limit: number
  items: T[]
}

export interface JobMetaFieldSchema {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required: boolean
  description: string
  options?: string[]
  defaultValue?: any
}

export interface JobMetaSchema {
  description: string
  fields: JobMetaFieldSchema[]
  example: Record<string, any>
}

export interface RegisteredJobInfo {
  key: string
  name: string
  metaSchema: JobMetaSchema | null
}

export type DataPullExecutionLog = _DataPullExecutionDto

export interface DataPullTaskListQuery {
  page?: number
  limit?: number
  key?: string
  name?: string
  enabled?: boolean
}

export interface CreateDataPullTaskPayload {
  key: string
  name: string
  source?: string | null
  type?: string | null
  cron?: string | null
  intervalSeconds?: number | null
  enabled?: boolean
  cursor?: string | null
  meta?: Record<string, unknown> | null
}

export interface UpdateDataPullTaskPayload {
  name?: string
  source?: string | null
  type?: string | null
  cron?: string | null
  intervalSeconds?: number | null
  enabled?: boolean
  cursor?: string | null
  meta?: Record<string, unknown> | null
}

export async function fetchRegisteredJobKeys(): Promise<string[]> {
  return withAuthErrorHandling(async () => {
    const response = await client.AdminDataPullTaskController_getRegisteredKeys({
      headers: requireAuthHeaders(),
    })
    const data = unwrapResponse<{ keys?: string[] }>(response as { data?: { keys?: string[] } } | { keys?: string[] })
    return Array.isArray(data?.keys) ? data.keys : []
  })
}

export async function fetchRegisteredJobs(): Promise<RegisteredJobInfo[]> {
  return withAuthErrorHandling(async () => {
    const response = await client.AdminDataPullTaskController_getRegisteredJobs({
      headers: requireAuthHeaders(),
    })
    const data = unwrapResponse<any>(response as any)
    return data?.jobs ?? []
  })
}

export async function fetchDataPullTasks(
  query: DataPullTaskListQuery = {},
): Promise<PaginationResult<DataPullTask>> {
  return withAuthErrorHandling(async () => {
    const response = await client.AdminDataPullTaskController_list({
      headers: requireAuthHeaders(),
      queries: {
        page: query.page,
        limit: query.limit,
        key: query.key,
        name: query.name,
        enabled: query.enabled,
      },
    })
    const data = unwrapResponse<any>(response)
    return {
      total: data.total ?? 0,
      page: data.page ?? query.page ?? 1,
      limit: data.limit ?? query.limit ?? 20,
      items: Array.isArray(data.items) ? (data.items as DataPullTask[]) : [],
    }
  })
}

export async function fetchDataPullTaskExecutions(
  taskId: number,
  page = 1,
  limit = 20,
): Promise<PaginationResult<DataPullExecutionLog>> {
  return withAuthErrorHandling(async () => {
    const response = await client.AdminDataPullTaskController_listExecutions({
      headers: requireAuthHeaders(),
      params: { id: taskId },
      queries: { page, limit },
    })
    const payload = unwrapResponse<any>(response as any)

    return {
      total: payload.total ?? 0,
      page: payload.page ?? page,
      limit: payload.limit ?? limit,
      items: Array.isArray(payload.items) ? (payload.items as DataPullExecutionLog[]) : [],
    }
  })
}

export async function createDataPullTask(
  payload: CreateDataPullTaskPayload,
): Promise<DataPullTask> {
  return withAuthErrorHandling(async () => {
    const dto: _CreateDataPullTaskDto = {
      key: payload.key,
      name: payload.name,
      source: payload.source ?? null,
      type: payload.type ?? null,
      cron: payload.cron ?? null,
      intervalSeconds: payload.intervalSeconds ?? null,
      enabled: payload.enabled ?? true,
      cursor: payload.cursor ?? null,
      meta: payload.meta ?? null,
    }

    try {
      const response = await client.AdminDataPullTaskController_create(dto, {
        headers: requireAuthHeaders(),
      })
      return unwrapResponse<DataPullTask>(response as any)
    } catch (error: any) {
      const errorMsg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.data?.message ||
        error?.message ||
        '创建任务失败'
      throw new Error(errorMsg)
    }
  })
}

export async function updateDataPullTask(
  id: number,
  payload: UpdateDataPullTaskPayload,
): Promise<DataPullTask> {
  return withAuthErrorHandling(async () => {
    const dto: _UpdateDataPullTaskDto = {}
    if (payload.name !== undefined) dto.name = payload.name
    if (payload.source !== undefined) dto.source = payload.source
    if (payload.type !== undefined) dto.type = payload.type
    if (payload.cron !== undefined) dto.cron = payload.cron
    if (payload.intervalSeconds !== undefined) dto.intervalSeconds = payload.intervalSeconds
    if (payload.enabled !== undefined) dto.enabled = payload.enabled
    if (payload.cursor !== undefined) dto.cursor = payload.cursor
    if (payload.meta !== undefined) dto.meta = payload.meta
    const response = await client.AdminDataPullTaskController_update(dto, {
      headers: requireAuthHeaders(),
      params: { id },
    })
    return unwrapResponse<DataPullTask>(response as any)
  })
}

export async function deleteDataPullTask(id: number): Promise<void> {
  await withAuthErrorHandling(async () => {
    await (client as any).AdminDataPullTaskController_delete({
      headers: requireAuthHeaders(),
      params: { id },
    })
  })
}

export async function triggerDataPullTask(id: number): Promise<DataPullExecutionLog> {
  return withAuthErrorHandling(async () => {
    const response = await client.AdminDataPullTaskController_triggerOnce(undefined, {
      headers: requireAuthHeaders(),
      params: { id },
    })
    return unwrapResponse<DataPullExecutionLog>(response as any)
  })
}

export async function interruptDataPullTask(id: number): Promise<InterruptDataPullTaskResult> {
  return withAuthErrorHandling(async () => {
    const typedClient = client as unknown as {
      AdminDataPullTaskController_interruptTask: (
        body: undefined,
        options: { headers: { Authorization: string }; params: { id: number } },
      ) => Promise<unknown>
    }
    const response = await typedClient.AdminDataPullTaskController_interruptTask(undefined, {
      headers: requireAuthHeaders(),
      params: { id },
    })
    return unwrapResponse<InterruptDataPullTaskResult>(
      response as { data?: InterruptDataPullTaskResult; message?: string },
    )
  })
}
