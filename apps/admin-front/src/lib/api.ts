import type { schemas } from '@ai/api-contracts'
import type { z } from 'zod'
import { client, requireAuthHeaders, unwrapListResponse, unwrapResponse, withAuthErrorHandling } from './api-access'
type CreateMenuPayload = z.infer<typeof schemas.CreateAdminMenuDto>
type CreateRolePayload = z.infer<typeof schemas.CreateAdminRoleDto>
type UpdateRolePayload = z.infer<typeof schemas.UpdateAdminRoleDto>
type CreateAdminUserPayload = z.infer<typeof schemas.CreateAdminUserDto>
type UpdateAdminUserPayload = z.infer<typeof schemas.UpdateAdminUserDto>
type _DataPullTaskDto = z.infer<typeof schemas.AdminDataPullTaskResponseDto>
export {
  loginAdmin,
  registerAdmin,
} from './api-auth-domain'
export {
  createDataPullTask,
  deleteDataPullTask,
  fetchDataPullTaskExecutions,
  fetchDataPullTasks,
  fetchRegisteredJobKeys,
  fetchRegisteredJobs,
  interruptDataPullTask,
  triggerDataPullTask,
  updateDataPullTask,
  type CreateDataPullTaskPayload,
  type DataPullExecutionLog,
  type DataPullTaskListQuery,
  type InterruptDataPullTaskResult,
  type JobMetaFieldSchema,
  type JobMetaSchema,
  type RegisteredJobInfo,
  type UpdateDataPullTaskPayload,
} from './api-data-sync-domain'
export {
  createSystemPromptSetting,
  fetchSystemPromptSettings,
  updateSystemPromptSetting,
  type CreateSystemPromptSettingPayload,
  type UpdateSystemPromptSettingPayload,
} from './api-system-settings-domain'

// 系统配置相关类型
export type SettingResponse = z.infer<typeof schemas.SettingResponseDto>

// 数据拉取任务相关类型
export type DataPullTask = _DataPullTaskDto

export interface PaginationResult<T> {
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

export interface BetaCode {
  id: string
  code: string
  maxUses: number
  usedCount: number
  isActive: boolean
  createdAt: string
}

export interface CreateBetaCodeBatchPayload {
  count: number
  maxUsesPerCode: number
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

export interface BetaCodeListQuery {
  page?: number
  limit?: number
}

export async function fetchBetaCodes(
  query: BetaCodeListQuery = {},
): Promise<PaginationResult<BetaCode>> {
  return withAuthErrorHandling(async () => {
    const response = await client.AdminBetaCodeController_list({
      headers: requireAuthHeaders(),
      queries: {
        page: query.page,
        limit: query.limit,
      },
    })
    const data = unwrapResponse<any>(response)
    return {
      total: data.total ?? 0,
      page: data.page ?? query.page ?? 1,
      limit: data.limit ?? query.limit ?? 20,
      items: Array.isArray(data.items) ? (data.items as BetaCode[]) : [],
    }
  })
}

export async function createBetaCodeBatch(
  payload: CreateBetaCodeBatchPayload,
): Promise<BetaCode[]> {
  return withAuthErrorHandling(async () => {
    const response = await client.AdminBetaCodeController_createBatch(
      {
        count: payload.count,
        maxUsesPerCode: payload.maxUsesPerCode,
      },
      {
        headers: requireAuthHeaders(),
      },
    )
    return unwrapListResponse<BetaCode>(response)
  })
}

export async function updateBetaCodeStatus(
  id: string,
  isActive: boolean,
): Promise<BetaCode> {
  return withAuthErrorHandling(async () => {
    const response = await client.AdminBetaCodeController_updateStatus({ isActive }, {
      headers: requireAuthHeaders(),
      params: { id },
    })
    return unwrapResponse<BetaCode>(response)
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
  instrumentType: 'SPOT' | 'PERPETUAL' | 'FUTURE'
  symbol: string
  limit?: number
}

export async function getLatestTrades(
  params: GetLatestTradesParams,
): Promise<MarketTradeResponse[]> {
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

export async function createExchangeConfig(
  payload: CreateExchangeConfigPayload,
): Promise<ExchangeConfigResponse> {
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
