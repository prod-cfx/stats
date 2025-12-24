import type { schemas } from '@ai/api-contracts';
import type { z } from 'zod'
import { createApiClient } from '@ai/api-contracts'

import { getToken } from './session'

interface BaseResponse<T> {
  data?: T
  message?: string
}

function unwrapResponse<T>(response: T | BaseResponse<T>): T {
  if (response && typeof response === 'object' && 'data' in response) {
    const data = (response as BaseResponse<T>).data
    if (data !== undefined) {
      return data
    }
  }
  return response as T
}

function unwrapListResponse<T>(response: unknown): T[] {
  const unwrapped = unwrapResponse(response) as any
  if (Array.isArray(unwrapped)) {
    return unwrapped as T[]
  }
  if (unwrapped && typeof unwrapped === 'object' && Array.isArray(unwrapped.items)) {
    return unwrapped.items as T[]
  }
  return []
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000/api/v1'

const client = createApiClient(API_BASE_URL, { validate: 'request' })

type AdminLoginPayload = z.infer<typeof schemas.AdminLoginDto>
type AdminRegisterPayload = z.infer<typeof schemas.AdminRegisterDto>
type CreateMenuPayload = z.infer<typeof schemas.CreateAdminMenuDto>
type CreateRolePayload = z.infer<typeof schemas.CreateAdminRoleDto>
type UpdateRolePayload = z.infer<typeof schemas.UpdateAdminRoleDto>
type CreateAdminUserPayload = z.infer<typeof schemas.CreateAdminUserDto>
type UpdateAdminUserPayload = z.infer<typeof schemas.UpdateAdminUserDto>
type DataPullTaskDto = z.infer<typeof schemas.AdminDataPullTaskResponseDto>
type UpdateDataPullTaskDto = z.infer<typeof schemas.UpdateAdminDataPullTaskDto>

// 系统配置相关类型
export type SettingResponse = z.infer<typeof schemas.SettingResponseDto>

const SYSTEM_PROMPT_CATEGORY = 'system_prompt'

function requireAuthHeaders() {
  const token = getToken()
  if (!token) throw new Error('登录状态已失效，请重新登录')
  return { Authorization: `Bearer ${token}` }
}

export interface AdminRole {
  id: string
  code: string
  name: string
  description?: string | null
  menuPermissions: string[]
}

export interface AdminMenuNode {
  id: string
  title: string
  type: 'DIRECTORY' | 'MENU' | 'FEATURE'
  code?: string | null
  path?: string | null
  parentId?: string | null
  icon?: string | null
  i18nKey?: string | null
  sort?: number | null
  isShow?: boolean | null
}

export interface AdminUser {
  id: string
  username: string
  email?: string | null
  nickName?: string | null
  isFrozen: boolean
  roles: {
    id: string
    code: string
    name: string
    description?: string | null
  }[]
}

export type DataPullTask = DataPullTaskDto

interface PaginationResult<T> {
  total: number
  page: number
  limit: number
  items: T[]
}

export async function loginAdmin(payload: AdminLoginPayload) {
  const response = await client.AdminAuthController_login(payload)
  return unwrapResponse(response)
}

export async function registerAdmin(payload: AdminRegisterPayload) {
  const response = await client.AdminAuthController_register(payload)
  return unwrapResponse(response)
}

export async function fetchAdminMenus(): Promise<AdminMenuNode[]> {
  const response = await client['AdminMenuController_findMenuTree[0]']({ headers: requireAuthHeaders() })
  return unwrapListResponse<AdminMenuNode>(response)
}

export function createMenu(payload: CreateMenuPayload) {
  return client['AdminMenuController_create[0]'](payload, { headers: requireAuthHeaders() }).then(unwrapResponse)
}

export async function fetchAdminRoles(): Promise<AdminRole[]> {
  const response = await client['AdminRoleController_list[0]']({ headers: requireAuthHeaders() })
  return unwrapListResponse<AdminRole>(response)
}

export function createRole(payload: CreateRolePayload) {
  return client['AdminRoleController_create[0]'](payload, { headers: requireAuthHeaders() }).then(unwrapResponse)
}

export function updateRole(id: string, payload: UpdateRolePayload) {
  return client['AdminRoleController_update[0]'](payload, {
    headers: requireAuthHeaders(),
    params: { id },
  }).then(unwrapResponse)
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const response = await client['AdminUserController_list[0]']({ headers: requireAuthHeaders() })
  return unwrapListResponse<AdminUser>(response)
}

export function createAdminUser(payload: CreateAdminUserPayload) {
  return client['AdminUserController_create[0]'](payload, { headers: requireAuthHeaders() }).then(unwrapResponse)
}

export function updateAdminUser(id: string, payload: UpdateAdminUserPayload) {
  return client['AdminUserController_update[0]'](payload, {
    headers: requireAuthHeaders(),
    params: { id },
  }).then(unwrapResponse)
}

// 系统提示词配置相关 API
export async function fetchSystemPromptSettings(): Promise<SettingResponse[]> {
  const response = await client.AdminSettingsController_getAllSettings({
    headers: requireAuthHeaders(),
    queries: { category: SYSTEM_PROMPT_CATEGORY },
  })
  const data = unwrapResponse<SettingResponse[] | { items: SettingResponse[] }>(response as any)
  if (Array.isArray(data))
    return data
  if (data && Array.isArray((data as any).items))
    return (data as any).items
  return []
}

export interface CreateSystemPromptSettingPayload {
  key: string
  value: string
  type?: string
  description?: string
}

export async function createSystemPromptSetting(
  payload: CreateSystemPromptSettingPayload,
): Promise<SettingResponse> {
  const response = await client.AdminSettingsController_createSetting(
    {
      key: payload.key,
      value: payload.value,
      type: (payload.type || 'string') as 'string' | 'number' | 'boolean' | 'json',
      description: payload.description,
      category: SYSTEM_PROMPT_CATEGORY,
      isSystem: true,
    },
    {
      headers: requireAuthHeaders(),
    },
  )
  return unwrapResponse<SettingResponse>(response as any)
}

export interface UpdateSystemPromptSettingPayload {
  value: string
  type?: string
  description?: string
}

export async function updateSystemPromptSetting(
  key: string,
  payload: UpdateSystemPromptSettingPayload,
): Promise<SettingResponse> {
  const response = await client.AdminSettingsController_updateSetting(
    {
      value: payload.value,
      type: (payload.type || 'string') as 'string' | 'number' | 'boolean' | 'json',
      description: payload.description,
      category: SYSTEM_PROMPT_CATEGORY,
      isSystem: true,
    },
    {
      headers: requireAuthHeaders(),
      params: { key },
    },
  )
  return ((response as any)?.data ?? response) as SettingResponse
}

// ===== 数据拉取任务管理（Admin） =====

export interface DataPullTaskListQuery {
  page?: number
  limit?: number
  key?: string
  name?: string
  enabled?: boolean
}

export async function fetchDataPullTasks(
  query: DataPullTaskListQuery = {},
): Promise<PaginationResult<DataPullTask>> {
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
    page: data.page ?? (query.page ?? 1),
    limit: data.limit ?? (query.limit ?? 20),
    items: Array.isArray(data.items) ? (data.items as DataPullTask[]) : [],
  }
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
}

export async function createDataPullTask(payload: CreateDataPullTaskPayload): Promise<DataPullTask> {
  const dto = {
    key: payload.key,
    name: payload.name,
    source: payload.source,
    type: payload.type,
    cron: payload.cron,
    intervalSeconds: payload.intervalSeconds,
    enabled: payload.enabled,
    cursor: payload.cursor,
  }
  const response = await client.AdminDataPullTaskController_create(dto, {
    headers: requireAuthHeaders(),
  })
  return unwrapResponse<DataPullTask>(response as any)
}

export interface UpdateDataPullTaskPayload {
  name?: string
  source?: string | null
  type?: string | null
  cron?: string | null
  intervalSeconds?: number | null
  enabled?: boolean
  cursor?: string | null
}

export async function updateDataPullTask(id: number, payload: UpdateDataPullTaskPayload): Promise<DataPullTask> {
  const dto: UpdateDataPullTaskDto = {}
  if (payload.name !== undefined) dto.name = payload.name
  if (payload.source !== undefined) dto.source = payload.source
  if (payload.type !== undefined) dto.type = payload.type
  if (payload.cron !== undefined) dto.cron = payload.cron
  if (payload.intervalSeconds !== undefined) dto.intervalSeconds = payload.intervalSeconds
  if (payload.enabled !== undefined) dto.enabled = payload.enabled
  if (payload.cursor !== undefined) dto.cursor = payload.cursor
  const response = await client.AdminDataPullTaskController_update(dto, {
    headers: requireAuthHeaders(),
    params: { id },
  })
  return unwrapResponse<DataPullTask>(response as any)
}

export async function deleteDataPullTask(id: number): Promise<void> {
  await client.AdminDataPullTaskController_delete({
    headers: requireAuthHeaders(),
    params: { id },
  })
}

// ===== 旧业务逻辑已移除 =====
// 以下功能的后端接口已被移除，前端不再支持：
// - 策略模板管理（Strategy Templates）
// - 策略实例管理（Strategy Instances）
// - LLM 策略管理（LLM Strategies）
// - 交易信号管理（Trading Signals）
// - 市场交易对管理（Market Symbols）
// 如需这些功能，请参考产品规划文档或联系后端团队

