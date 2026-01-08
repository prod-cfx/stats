/* eslint-disable perfectionist/sort-imports, perfectionist/sort-named-imports, ts/consistent-type-imports */
import { z } from 'zod'
import { schemas, createApiClient } from '@ai/api-contracts'

import { useAuthStore } from './auth-store'
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
type _DataPullTaskDto = z.infer<typeof schemas.AdminDataPullTaskResponseDto>
type _CreateDataPullTaskDto = z.infer<typeof schemas.CreateAdminDataPullTaskDto>
type _UpdateDataPullTaskDto = z.infer<typeof schemas.UpdateAdminDataPullTaskDto>

// 系统配置相关类型
export type SettingResponse = z.infer<typeof schemas.SettingResponseDto>

// 数据拉取任务相关类型
export type DataPullTask = _DataPullTaskDto

interface _PaginationResult<T> {
  total: number
  page: number
  limit: number
  items: T[]
}

// 订单薄配置相关类型
export type OrderbookPairConfigResponse = z.infer<typeof schemas.OrderbookPairConfigResponseDto>
export type CreateOrderbookPairConfigPayload = z.infer<typeof schemas.CreateOrderbookPairConfigDto>
export type UpdateOrderbookPairConfigPayload = z.infer<typeof schemas.UpdateOrderbookPairConfigDto>

// 交易记录订阅配置相关类型
export type TradesPairConfigResponse = z.infer<typeof schemas.TradesPairConfigResponseDto>
export type CreateTradesPairConfigPayload = z.infer<typeof schemas.CreateTradesPairConfigDto>
export type UpdateTradesPairConfigPayload = z.infer<typeof schemas.UpdateTradesPairConfigDto>

// 交易记录相关类型
export type MarketTradeResponse = z.infer<typeof schemas.MarketTradeResponseDto>

// 交易所配置相关类型
export type ExchangeConfigResponse = z.infer<typeof schemas.ExchangeConfigResponseDto>
export type CreateExchangeConfigPayload = z.infer<typeof schemas.CreateExchangeConfigDto>
export type UpdateExchangeConfigPayload = z.infer<typeof schemas.UpdateExchangeConfigDto>

const SYSTEM_PROMPT_CATEGORY = 'system_prompt'

function requireAuthHeaders() {
  const token = getToken()
  if (!token) throw new Error('登录状态已失效，请重新登录')
  return { Authorization: `Bearer ${token}` }
}

async function withAuthErrorHandling<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error: any) {
    const status = error?.response?.status ?? error?.status

    // 401 未授权：登录态失效，统一清理会话并跳转登录
    if (status === 401) {
      // 管理员登录态失效：统一清理 Zustand 会话（内存 + localStorage），并跳转登录页
      try {
        // 通过 Zustand store 清理，会自动同步 localStorage 与内存 session 状态
        useAuthStore.getState().clearSession()
      } catch {
        // 兜底：即便 Zustand 不可用（极端环境），也保证不会抛出异常阻断后续逻辑
      }

      if (typeof window !== 'undefined') {
        window.location.href = '/login'
      }
    }

    // 403 禁止访问：表示当前账号缺少操作权限，不清理 session，由调用方处理提示
    throw error
  }
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

export async function loginAdmin(payload: AdminLoginPayload) {
  const response = await client.AdminAuthController_login(payload)
  return unwrapResponse(response)
}

export async function registerAdmin(payload: AdminRegisterPayload) {
  const response = await client.AdminAuthController_register(payload)
  return unwrapResponse(response)
}

export async function fetchAdminMenus(): Promise<AdminMenuNode[]> {
  return withAuthErrorHandling(async () => {
    const response = await client['AdminMenuController_findMenuTree[0]']({
      headers: requireAuthHeaders(),
    })
    return unwrapListResponse<AdminMenuNode>(response)
  })
}

export function createMenu(payload: CreateMenuPayload) {
  return withAuthErrorHandling(() =>
    client['AdminMenuController_create[0]'](payload, {
      headers: requireAuthHeaders(),
    }).then(unwrapResponse),
  )
}

export async function fetchAdminRoles(): Promise<AdminRole[]> {
  return withAuthErrorHandling(async () => {
    const response = await client['AdminRoleController_list[0]']({
      headers: requireAuthHeaders(),
    })
    return unwrapListResponse<AdminRole>(response)
  })
}

export function createRole(payload: CreateRolePayload) {
  return withAuthErrorHandling(() =>
    client['AdminRoleController_create[0]'](payload, {
      headers: requireAuthHeaders(),
    }).then(unwrapResponse),
  )
}

export function updateRole(id: string, payload: UpdateRolePayload) {
  return withAuthErrorHandling(() =>
    client['AdminRoleController_update[0]'](payload, {
      headers: requireAuthHeaders(),
      params: { id },
    }).then(unwrapResponse),
  )
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  return withAuthErrorHandling(async () => {
    const response = await client['AdminUserController_list[0]']({
      headers: requireAuthHeaders(),
    })
    return unwrapListResponse<AdminUser>(response)
  })
}

export function createAdminUser(payload: CreateAdminUserPayload) {
  return withAuthErrorHandling(() =>
    client['AdminUserController_create[0]'](payload, {
      headers: requireAuthHeaders(),
    }).then(unwrapResponse),
  )
}

export function updateAdminUser(id: string, payload: UpdateAdminUserPayload) {
  return withAuthErrorHandling(() =>
    client['AdminUserController_update[0]'](payload, {
      headers: requireAuthHeaders(),
      params: { id },
    }).then(unwrapResponse),
  )
}

// 系统提示词配置相关 API
export async function fetchSystemPromptSettings(): Promise<SettingResponse[]> {
  return withAuthErrorHandling(async () => {
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
  })
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
  return withAuthErrorHandling(async () => {
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
  })
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
  return withAuthErrorHandling(async () => {
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
  })
}

// ===== 数据拉取任务管理（Admin） =====

/**
 * 获取所有已注册的 Job key 列表（用于创建任务时的下拉选择）
 */
export async function fetchRegisteredJobKeys(): Promise<string[]> {
  const response = await fetch(`${API_BASE_URL}/admin/data-pull-tasks/registered-keys`, {
    headers: requireAuthHeaders(),
  })
  if (!response.ok) {
    throw new Error('获取已注册 key 列表失败')
  }
  const data = await response.json()
  return data?.keys ?? data?.data?.keys ?? []
}

/**
 * Meta 字段格式说明
 */
export interface JobMetaFieldSchema {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required: boolean
  description: string
  options?: string[]
  defaultValue?: any
}

/**
 * Job Meta 配置格式说明
 */
export interface JobMetaSchema {
  description: string
  fields: JobMetaFieldSchema[]
  example: Record<string, any>
}

/**
 * 已注册的 Job 信息
 */
export interface RegisteredJobInfo {
  key: string
  name: string
  metaSchema: JobMetaSchema | null
}

/**
 * 获取所有已注册的 Job 详细信息（包含 meta 配置格式说明）
 */
export async function fetchRegisteredJobs(): Promise<RegisteredJobInfo[]> {
  const response = await client.AdminDataPullTaskController_getRegisteredJobs({
    headers: requireAuthHeaders(),
  })
  const data = unwrapResponse<any>(response as any)
  return data?.jobs ?? []
}

/**
 * 单条任务执行日志
 */
export interface DataPullExecutionLog {
  id: number
  taskId: number
  status: string
  fetchedCount: number
  startedAt: string
  finishedAt?: string | null
  errorMessage?: string | null
  meta?: Record<string, any> | null
}

export interface DataPullTaskListQuery {
  page?: number
  limit?: number
  key?: string
  name?: string
  enabled?: boolean
}

export async function fetchDataPullTasks(
  query: DataPullTaskListQuery = {},
): Promise<_PaginationResult<DataPullTask>> {
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
      page: data.page ?? (query.page ?? 1),
      limit: data.limit ?? (query.limit ?? 20),
      items: Array.isArray(data.items) ? (data.items as DataPullTask[]) : [],
    }
  })
}

/**
 * 分页获取指定任务的执行日志
 */
export async function fetchDataPullTaskExecutions(
  taskId: number,
  page = 1,
  limit = 20,
): Promise<_PaginationResult<DataPullExecutionLog>> {
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
  /**
   * 任务级配置参数（任意 JSON 对象），将直接透传给后端的 data_pull_tasks.meta 字段
   */
  meta?: Record<string, unknown> | null
}

export async function createDataPullTask(payload: CreateDataPullTaskPayload): Promise<DataPullTask> {
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
      // 提取错误信息，向上抛出用户可读的错误文案
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

export interface UpdateDataPullTaskPayload {
  name?: string
  source?: string | null
  type?: string | null
  cron?: string | null
  intervalSeconds?: number | null
  enabled?: boolean
  cursor?: string | null
  /**
   * 任务级配置参数（任意 JSON 对象），将直接透传给后端的 data_pull_tasks.meta 字段
   */
  meta?: Record<string, unknown> | null
}

export async function updateDataPullTask(id: number, payload: UpdateDataPullTaskPayload): Promise<DataPullTask> {
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

/**
 * 手动触发一次数据拉取任务执行（主要用于测试）
 */
export async function triggerDataPullTask(id: number): Promise<DataPullExecutionLog> {
  return withAuthErrorHandling(async () => {
    const response = await (client as any).AdminDataPullTaskController_triggerOnce({
      headers: requireAuthHeaders(),
      params: { id },
    })
    const data = unwrapResponse<any>(response as any)

    return {
      id: data.id,
      taskId: data.taskId,
      status: data.status,
      fetchedCount: data.fetchedCount ?? 0,
      startedAt: data.startedAt,
      finishedAt: data.finishedAt ?? null,
      errorMessage: data.errorMessage ?? null,
      meta: (data.meta ?? null) as any,
    }
  })
}

// 订单薄交易对配置相关 API
export async function fetchOrderbookConfigs(): Promise<OrderbookPairConfigResponse[]> {
  return withAuthErrorHandling(async () => {
    const response = await client.AdminOrderbookPairConfigController_getAllConfigs({
      headers: requireAuthHeaders(),
    })
    return unwrapListResponse<OrderbookPairConfigResponse>(response)
  })
}

export async function createOrderbookConfig(
  payload: CreateOrderbookPairConfigPayload,
): Promise<OrderbookPairConfigResponse> {
  return withAuthErrorHandling(async () => {
    const response = await client.AdminOrderbookPairConfigController_createConfig(payload, {
      headers: requireAuthHeaders(),
    })
    return unwrapResponse<OrderbookPairConfigResponse>(response as any)
  })
}

export async function updateOrderbookConfig(
  id: string,
  payload: UpdateOrderbookPairConfigPayload,
): Promise<OrderbookPairConfigResponse> {
  return withAuthErrorHandling(async () => {
    const response = await client.AdminOrderbookPairConfigController_updateConfig(payload, {
      headers: requireAuthHeaders(),
      params: { id },
    })
    return unwrapResponse<OrderbookPairConfigResponse>(response as any)
  })
}

export async function deleteOrderbookConfig(id: string): Promise<void> {
  await withAuthErrorHandling(async () => {
    await client.AdminOrderbookPairConfigController_deleteConfig(undefined, {
      headers: requireAuthHeaders(),
      params: { id },
    })
  })
}

// 交易记录订阅配置相关 API
export async function fetchTradesConfigs(): Promise<TradesPairConfigResponse[]> {
  return withAuthErrorHandling(async () => {
    const response = await client.AdminTradesPairConfigController_getAllConfigs({
      headers: requireAuthHeaders(),
    })
    return unwrapListResponse<TradesPairConfigResponse>(response)
  })
}

export async function createTradesConfig(
  payload: CreateTradesPairConfigPayload,
): Promise<TradesPairConfigResponse> {
  return withAuthErrorHandling(async () => {
    const response = await client.AdminTradesPairConfigController_createConfig(payload, {
      headers: requireAuthHeaders(),
    })
    return unwrapResponse<TradesPairConfigResponse>(response as any)
  })
}

export async function updateTradesConfig(
  id: string,
  payload: UpdateTradesPairConfigPayload,
): Promise<TradesPairConfigResponse> {
  return withAuthErrorHandling(async () => {
    const response = await client.AdminTradesPairConfigController_updateConfig(payload, {
      headers: requireAuthHeaders(),
      params: { id },
    })
    return unwrapResponse<TradesPairConfigResponse>(response as any)
  })
}

export async function deleteTradesConfig(id: string): Promise<void> {
  await withAuthErrorHandling(async () => {
    await client.AdminTradesPairConfigController_deleteConfig(undefined, {
      headers: requireAuthHeaders(),
      params: { id },
    })
  })
}

// 交易记录数据查询 API
export interface GetLatestTradesParams {
  exchange: string
  instrumentType: string
  symbol: string
  limit?: number
}

export async function getLatestTrades(params: GetLatestTradesParams): Promise<MarketTradeResponse[]> {
  return withAuthErrorHandling(async () => {
    const response = await client.MarketsController_getLatestTrades({
      headers: requireAuthHeaders(),
      queries: {
        exchange: params.exchange,
        instrumentType: params.instrumentType,
        symbol: params.symbol,
        limit: params.limit || 50,
      },
    })
    return unwrapListResponse<MarketTradeResponse>(response)
  })
}

// 交易所配置相关 API
export interface ExchangeConfigListQuery {
  page?: number
  limit?: number
  code?: string
  name?: string
  venueType?: 'CEX' | 'DEX'
  enabled?: boolean
}

export async function fetchExchangeConfigs(
  query: ExchangeConfigListQuery = {},
): Promise<_PaginationResult<ExchangeConfigResponse>> {
  return withAuthErrorHandling(async () => {
    const page = query.page ?? 1
    const limit = query.limit ?? 20
    const response = await client.AdminExchangeConfigController_getAllConfigs({
      headers: requireAuthHeaders(),
      queries: {
        page,
        limit,
        code: query.code,
        name: query.name,
        venueType: query.venueType,
        enabled: query.enabled,
      },
    })
    const data = unwrapResponse<any>(response)
    return {
      total: data.total ?? 0,
      page: data.page ?? page,
      limit: data.limit ?? limit,
      items: Array.isArray(data.items) ? (data.items as ExchangeConfigResponse[]) : [],
    }
  })
}

export async function createExchangeConfig(payload: CreateExchangeConfigPayload): Promise<ExchangeConfigResponse> {
  return withAuthErrorHandling(async () => {
    const response = await client.AdminExchangeConfigController_createConfig(payload, {
      headers: requireAuthHeaders(),
    })
    return unwrapResponse<ExchangeConfigResponse>(response as any)
  })
}

export async function updateExchangeConfig(
  id: string,
  payload: UpdateExchangeConfigPayload,
): Promise<ExchangeConfigResponse> {
  return withAuthErrorHandling(async () => {
    const response = await client.AdminExchangeConfigController_updateConfig(payload, {
      headers: requireAuthHeaders(),
      params: { id },
    })
    return unwrapResponse<ExchangeConfigResponse>(response as any)
  })
}

export async function deleteExchangeConfig(id: string): Promise<void> {
  await withAuthErrorHandling(async () => {
    await client.AdminExchangeConfigController_deleteConfig(undefined, {
      headers: requireAuthHeaders(),
      params: { id },
    })
  })
}

// ===== 订单薄快照查看（Admin 专用，直接调用后端自定义接口） =====

// 使用 SDK 生成的 VenueOrderBookDto 类型，避免直接依赖 @ai/shared 的编译产物
type VenueOrderBookDto = z.infer<typeof schemas.VenueOrderBookDto>

// ===== 订单薄快照查看（Admin 专用，直接调用后端自定义接口） =====

export async function fetchOrderbookSnapshotByConfigId(
  id: string,
): Promise<VenueOrderBookDto | null> {
  return withAuthErrorHandling(async () => {
    const response = await client.AdminOrderbookPairConfigController_getCurrentOrderbook({
      headers: requireAuthHeaders(),
      params: { id },
    })
    const data = unwrapResponse<VenueOrderBookDto | null>(response as any)
    return data ?? null
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

