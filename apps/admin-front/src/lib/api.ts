import type { schemas } from '@ai/api-contracts';
import type { MarketInstrumentType, MarketSymbolStatus, MarketSymbolType } from '@ai/shared'
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

// 策略模板相关类型定义
export type MarketTimeframe = '1m' | '5m' | '15m' | '1h' | '4h' | '1d'

// 响应类型：symbol 可选（兼容旧模板）
export interface StrategyLeg {
  id: string
  symbol?: string | null  // 与后端 DTO 一致：可选字段
  role: 'primary' | 'hedge' | 'context'
  description?: string
}

// 创建/更新时的 Leg 类型：symbol 必填（符合后端 DTO 契约）
export interface StrategyLegInput {
  id: string
  symbol: string  // 必填：创建时必须提供
  role: 'primary' | 'hedge' | 'context'
  description?: string
}

export interface StrategyExecutionConfig {
  timeframe: MarketTimeframe
  cooldownMinutes?: number
}

export type StrategyDataRequirements = Record<string, MarketTimeframe[]>

export interface StrategyTemplate {
  id: string
  name: string
  description?: string | null
  legs?: StrategyLeg[] | null  // 与后端 DTO 一致：可选字段
  execution?: StrategyExecutionConfig | null
  dataRequirements?: StrategyDataRequirements | null
  llmModel?: string | null
  promptTemplate?: string | null
  script?: string | null
  paramsSchema?: Record<string, any> | null
  defaultParams?: Record<string, any> | null
  metadata?: Record<string, any> | null
  requiredFields?: string[]
  status: 'draft' | 'testing' | 'live' | 'disabled'
  rulesVersion: number
  lastGenerationSummary?: string | null
  createdAt: string
  updatedAt: string
  createdBy?: string | null
  updatedBy?: string | null
}

export interface StrategyTemplatesListResponse {
  items: StrategyTemplate[]
  total: number
  page: number
  limit: number
}

export interface CreateStrategyTemplatePayload {
  name: string
  description: string
  legs: StrategyLegInput[]  // 使用 StrategyLegInput：symbol 必填
  execution: StrategyExecutionConfig
  dataRequirements: StrategyDataRequirements
  llmModel: string
  promptTemplate: string
  script: string  // 必填：与后端 DTO 一致
  paramsSchema: Record<string, any>
  defaultParams?: Record<string, any>
  requiredFields?: string[]
  metadata?: Record<string, any>
}

export interface UpdateStrategyTemplatePayload {
  name?: string
  description?: string
  legs?: StrategyLegInput[]  // 使用 StrategyLegInput：symbol 必填
  execution?: StrategyExecutionConfig
  dataRequirements?: StrategyDataRequirements
  llmModel?: string
  promptTemplate?: string
  script?: string
  paramsSchema?: Record<string, any> | null
  defaultParams?: Record<string, any> | null
  metadata?: Record<string, any> | null
  status?: 'draft' | 'testing' | 'live' | 'disabled'
}

// 策略模板 API 方法（后端相关接口已移除，这里保留占位并在运行时报错）
export async function fetchStrategyTemplates(_params?: {
  page?: number
  limit?: number
  status?: 'draft' | 'testing' | 'live' | 'disabled'
  keyword?: string
  orderBy?: string
  onlyDraft?: boolean
}): Promise<StrategyTemplatesListResponse> {
  throw new Error('Strategy template APIs are not available in this build')
}

export async function fetchStrategyTemplateDetail(_id: string): Promise<StrategyTemplate> {
  throw new Error('Strategy template APIs are not available in this build')
}

export async function createStrategyTemplate(
  _payload: CreateStrategyTemplatePayload,
): Promise<StrategyTemplate> {
  throw new Error('Strategy template APIs are not available in this build')
}

export async function updateStrategyTemplate(
  _id: string,
  _payload: UpdateStrategyTemplatePayload,
): Promise<StrategyTemplate> {
  throw new Error('Strategy template APIs are not available in this build')
}

export async function deleteStrategyTemplate(_id: string): Promise<void> {
  throw new Error('Strategy template APIs are not available in this build')
}

export async function generateStrategyScript(id: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/admin/strategy-templates/${id}/generate-script`, {
    method: 'POST',
    headers: {
      ...requireAuthHeaders(),
      'Content-Type': 'application/json',
    },
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: '生成脚本失败' }))
    throw new Error(error.message || '生成脚本失败')
  }
  
  const data = await response.json()
  return unwrapResponse(data)?.script || data.script
}

export async function validateStrategyScript(script: string): Promise<{
  valid: boolean
  errors?: string[]
  warnings?: string[]
}> {
  const response = await fetch(`${API_BASE_URL}/admin/strategy-templates/validate-script`, {
    method: 'POST',
    headers: {
      ...requireAuthHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ script }),
  })
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: '验证脚本失败' }))
    throw new Error(error.message || '验证脚本失败')
  }
  
  const data = await response.json()
  return unwrapResponse(data) || data
}

// 策略实例相关类型定义（后端相关 DTO / 接口已移除，使用宽松占位类型）
export type StrategyInstance = any
export type CreateStrategyInstancePayload = any
export type UpdateStrategyInstancePayload = any
export type StrategyInstanceStatus = 'draft' | 'running' | 'paused' | 'stopped'
export type StrategyInstanceMode = 'BACKTEST' | 'PAPER' | 'TESTNET' | 'LIVE'

export interface StrategyInstancesListResponse {
  items: StrategyInstance[]
  total: number
  page: number
  limit: number
}

// 策略实例 API 方法 (使用生成的 client)
export async function fetchStrategyInstances(_params?: {
  page?: number
  limit?: number
  strategyTemplateId?: string
  status?: StrategyInstanceStatus
  llmModel?: string
}): Promise<StrategyInstancesListResponse> {
  throw new Error('Strategy instance APIs are not available in this build')
}

export async function fetchStrategyInstanceDetail(_id: string): Promise<StrategyInstance> {
  throw new Error('Strategy instance APIs are not available in this build')
}

export async function createStrategyInstance(
  _payload: CreateStrategyInstancePayload,
): Promise<StrategyInstance> {
  throw new Error('Strategy instance APIs are not available in this build')
}

export async function updateStrategyInstance(
  _id: string,
  _payload: UpdateStrategyInstancePayload,
): Promise<StrategyInstance> {
  throw new Error('Strategy instance APIs are not available in this build')
}

export async function deleteStrategyInstance(_id: string): Promise<void> {
  throw new Error('Strategy instance APIs are not available in this build')
}

// 主动实例检查（调试）相关类型（占位）
export type TestStrategyInstancePayload = any
export type TestStrategyInstanceResult = any

/**
 * 主动触发策略实例检查（调试用，不会生成真实信号）
 * 使用生成的 SDK client 方法
 */
export async function testStrategyInstance(
  _id: string,
  _payload: TestStrategyInstancePayload,
): Promise<TestStrategyInstanceResult> {
  throw new Error('Strategy instance test APIs are not available in this build')
}

/**
 * 从后台自动构造实例检查的默认请求体（多 Leg 多周期）
 * 使用生成的 SDK client 方法
 */
export async function prefillStrategyInstanceTestPayload(
  _id: string,
): Promise<TestStrategyInstancePayload> {
  throw new Error('Strategy instance test APIs are not available in this build')
}

// 订阅相关类型（后端 DTO 已移除，占位）
export type SubscriberInfo = any
export type StrategyInstanceSubscriptionDetails = any

export async function fetchStrategyInstanceSubscriptionDetails(
  _id: string,
  _page: number = 1,
  _limit: number = 50,
): Promise<StrategyInstanceSubscriptionDetails> {
  throw new Error('Strategy subscription APIs are not available in this build')
}

export interface TriggerSignalGenerationResponse {
  message?: string
  instanceId?: string
}

export async function triggerSignalGeneration(
  _instanceId: string,
): Promise<TriggerSignalGenerationResponse> {
  // 后端主动触发信号相关接口已移除，这里直接报错
  throw new Error('Trigger signal generation API is not available in this build')
}

// 信号记录相关类型定义（后端 DTO / 接口已移除，占位）
export type TradingSignal = any
export type SignalStatus = string
export type SignalDirection = string

export interface TradingSignalsListResponse {
  items: TradingSignal[]
  total: number
  page: number
  limit: number
}

// 信号记录 API 方法（后端相关接口已移除，占位）
export async function fetchTradingSignals(_params?: {
  page?: number
  limit?: number
  strategyInstanceId?: string
  strategyId?: string
  symbolId?: string
  status?: SignalStatus
}): Promise<TradingSignalsListResponse> {
  throw new Error('Trading signal APIs are not available in this build')
}

// ===== LLM Strategy 相关类型定义和 API 方法 =====

// LLM 策略相关类型（后端 DTO / 接口已移除，占位）
export type LlmStrategy = any
export type LlmStrategyInstance = any
export type LlmStrategyRun = any
export type CreateLlmStrategyPayload = any
export type UpdateLlmStrategyPayload = any
export type CreateLlmStrategyInstancePayload = any
export type UpdateLlmStrategyInstancePayload = any

export type LlmStrategyStatus = string
export type LlmStrategyInstanceStatus = string
export type LlmStrategyInstanceMode = string
export type LlmStrategyRunStatus = string

// 列表响应类型（使用 BasePaginationResponseDto）
export interface LlmStrategiesListResponse {
  items: LlmStrategy[]
  total: number
  page: number
  limit: number
}

export interface LlmStrategyInstancesListResponse {
  items: LlmStrategyInstance[]
  total: number
  page: number
  limit: number
}

// LLM Strategy API 方法（后端相关接口已移除，占位）
export async function fetchLlmStrategies(_params?: {
  page?: number
  limit?: number
  status?: LlmStrategyStatus
  keyword?: string
  orderBy?: string
}): Promise<LlmStrategiesListResponse> {
  throw new Error('LLM strategy APIs are not available in this build')
}

export async function fetchLlmStrategyDetail(_id: string): Promise<LlmStrategy> {
  throw new Error('LLM strategy APIs are not available in this build')
}

export async function createLlmStrategy(_payload: CreateLlmStrategyPayload): Promise<LlmStrategy> {
  throw new Error('LLM strategy APIs are not available in this build')
}

export async function updateLlmStrategy(
  _id: string,
  _payload: UpdateLlmStrategyPayload,
): Promise<LlmStrategy> {
  throw new Error('LLM strategy APIs are not available in this build')
}

export async function deleteLlmStrategy(_id: string): Promise<void> {
  throw new Error('LLM strategy APIs are not available in this build')
}

// LLM Strategy Instance API 方法（后端相关接口已移除，占位）
export async function fetchLlmStrategyInstances(_params?: {
  page?: number
  limit?: number
  status?: LlmStrategyInstanceStatus
  strategyId?: string
  orderBy?: string
}): Promise<LlmStrategyInstancesListResponse> {
  throw new Error('LLM strategy instance APIs are not available in this build')
}

export async function fetchLlmStrategyInstanceDetail(_id: string): Promise<LlmStrategyInstance> {
  throw new Error('LLM strategy instance APIs are not available in this build')
}

export async function createLlmStrategyInstance(
  _payload: CreateLlmStrategyInstancePayload,
): Promise<LlmStrategyInstance> {
  throw new Error('LLM strategy instance APIs are not available in this build')
}

export async function updateLlmStrategyInstance(
  _id: string,
  _payload: UpdateLlmStrategyInstancePayload,
): Promise<LlmStrategyInstance> {
  throw new Error('LLM strategy instance APIs are not available in this build')
}

export async function deleteLlmStrategyInstance(_id: string): Promise<void> {
  throw new Error('LLM strategy instance APIs are not available in this build')
}

export async function fetchLlmStrategyRuns(
  _instanceId: string,
  _limit: number = 20,
): Promise<LlmStrategyRun[]> {
  throw new Error('LLM strategy run APIs are not available in this build')
}

export async function testLlmStrategyInstance(_id: string): Promise<LlmStrategyRun> {
  throw new Error('LLM strategy run APIs are not available in this build')
}

// 市场交易对列表（用于下拉选择，自动与后台配置对齐）
// 后端部分 Admin 管理接口已移除，这里仅保留查询列表功能。
export type MarketSymbol = any

export interface MarketSymbolsListResponse {
  items: MarketSymbol[]
  total: number
  page: number
  limit: number
}

export async function fetchMarketSymbols(params?: {
  page?: number
  limit?: number
  exchange?: string
  type?: MarketSymbolType
  status?: MarketSymbolStatus
  instrumentType?: MarketInstrumentType
  keyword?: string
}): Promise<MarketSymbolsListResponse> {
  const page = params?.page ?? 1
  const limit = params?.limit ?? 50

  // 后端通用市场交易对查询接口已裁剪，当前构建暂不支持从服务端动态获取列表。
  // 这里保留占位实现，返回空列表。
  return {
    items: [],
    total: 0,
    page,
    limit,
  }
}

// 管理员交易对管理（创建/更新）相关接口已从后端移除，这里保留占位类型与方法。
export type CreateMarketSymbolPayload = any
export type UpdateMarketSymbolPayload = any

export async function createMarketSymbol(
  _payload: CreateMarketSymbolPayload,
): Promise<MarketSymbol> {
  throw new Error('Admin market symbol management APIs are not available in this build')
}

export async function updateMarketSymbol(
  _code: string,
  _payload: UpdateMarketSymbolPayload,
): Promise<MarketSymbol> {
  throw new Error('Admin market symbol management APIs are not available in this build')
}

export async function fetchLlmStrategyRunDetail(_runId: string): Promise<LlmStrategyRun> {
  throw new Error('LLM strategy run detail API is not available in this build')
}

