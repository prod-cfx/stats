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

export interface DataPullTask {
  id: number
  key: string
  name: string
  source?: string | null
  type?: string | null
  cron?: string | null
  intervalSeconds?: number | null
  enabled: boolean
  cursor?: string | null
  lastStatus?: string | null
  lastRunAt?: string | null
  lastSuccessAt?: string | null
  lastError?: string | null
  createdAt: string
  updatedAt: string
}

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
  const headers = requireAuthHeaders()
  const url = new URL(`${API_BASE_URL}/admin/data-pull-tasks`)
  if (query.page != null)
    url.searchParams.set('page', String(query.page))
  if (query.limit != null)
    url.searchParams.set('limit', String(query.limit))
  if (query.key)
    url.searchParams.set('key', query.key)
  if (query.name)
    url.searchParams.set('name', query.name)
  if (typeof query.enabled === 'boolean')
    url.searchParams.set('enabled', String(query.enabled))

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers,
  })
  if (!res.ok) {
    throw new Error(`获取数据拉取任务失败：${res.statusText}`)
  }
  const data = (await res.json()) as PaginationResult<DataPullTask> | { data: PaginationResult<DataPullTask> }
  return (data as any).data ?? (data as any)
}

export interface CreateDataPullTaskPayload {
  key: string
  name: string
  source?: string
  type?: string
  cron?: string
  intervalSeconds?: number
  enabled?: boolean
  cursor?: string
}

export async function createDataPullTask(payload: CreateDataPullTaskPayload): Promise<DataPullTask> {
  const headers = {
    ...requireAuthHeaders(),
    'Content-Type': 'application/json',
  }
  const res = await fetch(`${API_BASE_URL}/admin/data-pull-tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || '创建数据拉取任务失败')
  }
  const data = (await res.json()) as DataPullTask | { data: DataPullTask }
  return (data as any).data ?? (data as any)
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
  const headers = {
    ...requireAuthHeaders(),
    'Content-Type': 'application/json',
  }
  const res = await fetch(`${API_BASE_URL}/admin/data-pull-tasks/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || '更新数据拉取任务失败')
  }
  const data = (await res.json()) as DataPullTask | { data: DataPullTask }
  return (data as any).data ?? (data as any)
}

export async function deleteDataPullTask(id: number): Promise<void> {
  const headers = requireAuthHeaders()
  const res = await fetch(`${API_BASE_URL}/admin/data-pull-tasks/${id}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || '删除数据拉取任务失败')
  }
}

// ===== 旧业务逻辑已移除 =====
// 以下功能的后端接口已被移除，前端不再支持：
// - 策略模板管理（Strategy Templates）
// - 策略实例管理（Strategy Instances）
// - LLM 策略管理（LLM Strategies）
// - 交易信号管理（Trading Signals）
// - 市场交易对管理（Market Symbols）
// 如需这些功能，请参考产品规划文档或联系后端团队

