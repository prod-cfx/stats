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

// 策略模板 API 方法
export async function fetchStrategyTemplates(params?: {
  page?: number
  limit?: number
  status?: 'draft' | 'testing' | 'live' | 'disabled'
  keyword?: string
  orderBy?: string
  onlyDraft?: boolean
}): Promise<StrategyTemplatesListResponse> {
  const response = await client.AdminStrategyTemplatesController_list({
    headers: requireAuthHeaders(),
    queries: params,
  })
  return unwrapResponse(response) as StrategyTemplatesListResponse
}

export async function fetchStrategyTemplateDetail(id: string): Promise<StrategyTemplate> {
  const response = await client.AdminStrategyTemplatesController_detail({
    headers: requireAuthHeaders(),
    params: { id },
  })
  return unwrapResponse(response) as StrategyTemplate
}

export async function createStrategyTemplate(payload: CreateStrategyTemplatePayload): Promise<StrategyTemplate> {
  const response = await client.AdminStrategyTemplatesController_create(payload as any, {
    headers: requireAuthHeaders(),
  })
  return unwrapResponse(response) as StrategyTemplate
}

export async function updateStrategyTemplate(id: string, payload: UpdateStrategyTemplatePayload): Promise<StrategyTemplate> {
  const response = await client.AdminStrategyTemplatesController_update(payload as any, {
    headers: requireAuthHeaders(),
    params: { id },
  })
  return unwrapResponse(response) as StrategyTemplate
}

export async function deleteStrategyTemplate(id: string): Promise<void> {
  await client.AdminStrategyTemplatesController_delete(undefined as any, {
    headers: requireAuthHeaders(),
    params: { id },
  })
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

// 策略实例相关类型定义 (使用生成的类型)
export type StrategyInstance = z.infer<typeof schemas.StrategyInstanceResponseDto>
export type CreateStrategyInstancePayload = z.infer<typeof schemas.CreateStrategyInstanceDto>
export type UpdateStrategyInstancePayload = z.infer<typeof schemas.UpdateStrategyInstanceDto>
export type StrategyInstanceStatus = 'draft' | 'running' | 'paused' | 'stopped'
export type StrategyInstanceMode = 'BACKTEST' | 'PAPER' | 'TESTNET' | 'LIVE'

export interface StrategyInstancesListResponse {
  items: StrategyInstance[]
  total: number
  page: number
  limit: number
}

// 策略实例 API 方法 (使用生成的 client)
export async function fetchStrategyInstances(params?: {
  page?: number
  limit?: number
  strategyTemplateId?: string
  status?: StrategyInstanceStatus
  llmModel?: string
}): Promise<StrategyInstancesListResponse> {
  const response = await client.AdminStrategyInstancesController_list({
    headers: requireAuthHeaders(),
    queries: {
      page: params?.page || 1,
      limit: params?.limit || 20,
      strategyTemplateId: params?.strategyTemplateId,
      status: params?.status,
      llmModel: params?.llmModel,
    },
  })
  
  const data = unwrapResponse(response)
  return {
    items: Array.isArray(data) ? data : ((data as any)?.items || []),
    total: (data as any)?.total || 0,
    page: params?.page || 1,
    limit: params?.limit || 20,
  }
}

export async function fetchStrategyInstanceDetail(id: string): Promise<StrategyInstance> {
  const response = await client.AdminStrategyInstancesController_detail({
    headers: requireAuthHeaders(),
    params: { id },
  })
  
  return unwrapResponse(response)
}

export async function createStrategyInstance(payload: CreateStrategyInstancePayload): Promise<StrategyInstance> {
  const response = await client.AdminStrategyInstancesController_create(payload, {
    headers: requireAuthHeaders(),
  })
  
  return unwrapResponse(response)
}

export async function updateStrategyInstance(
  id: string,
  payload: UpdateStrategyInstancePayload
): Promise<StrategyInstance> {
  const response = await client.AdminStrategyInstancesController_update(payload, {
    headers: requireAuthHeaders(),
    params: { id },
  })
  
  return unwrapResponse(response)
}

export async function deleteStrategyInstance(id: string): Promise<void> {
  await client.AdminStrategyInstancesController_delete(undefined, {
    headers: requireAuthHeaders(),
    params: { id },
  })
}

// 主动实例检查（调试）相关类型（使用生成的类型）
export type TestStrategyInstancePayload = z.infer<typeof schemas.TestStrategyInstanceDto>
export type TestStrategyInstanceResult = z.infer<typeof schemas.TestStrategyInstanceResultDto>

/**
 * 主动触发策略实例检查（调试用，不会生成真实信号）
 * 使用生成的 SDK client 方法
 */
export async function testStrategyInstance(
  id: string,
  payload: TestStrategyInstancePayload,
): Promise<TestStrategyInstanceResult> {
  // 按照 Zodios 约定：第一个参数为 body，第二个参数传 headers / params 等配置
  const response = await client.AdminStrategyInstancesController_testRun(payload, {
    headers: requireAuthHeaders(),
    params: { id },
  })

  const data = unwrapResponse(response)
  return data || (response as TestStrategyInstanceResult)
}

/**
 * 从后台自动构造实例检查的默认请求体（多 Leg 多周期）
 * 使用生成的 SDK client 方法
 */
export async function prefillStrategyInstanceTestPayload(
  id: string,
): Promise<TestStrategyInstancePayload> {
  const response = await client.AdminStrategyInstancesController_buildTestPayload({
    headers: requireAuthHeaders(),
    params: { id },
  })

  const data = unwrapResponse(response)
  return data || (response as TestStrategyInstancePayload)
}

// 导出 SDK 生成的类型
export type SubscriberInfo = z.infer<typeof schemas.SubscriberInfoDto>
export type StrategyInstanceSubscriptionDetails = z.infer<typeof schemas.StrategyInstanceSubscriptionDetailsDto>

export async function fetchStrategyInstanceSubscriptionDetails(
  id: string,
  page: number = 1,
  limit: number = 50
): Promise<StrategyInstanceSubscriptionDetails> {
  const response = await client.AdminStrategyInstancesController_getSubscriptionDetails({
    headers: requireAuthHeaders(),
    params: { id },
    queries: { page, limit },
  })
  
  const data = unwrapResponse(response)
  return data || response as StrategyInstanceSubscriptionDetails
}

export interface TriggerSignalGenerationResponse {
  message?: string
  instanceId?: string
}

export async function triggerSignalGeneration(instanceId: string): Promise<TriggerSignalGenerationResponse> {
  const result = await client.AdminStrategyInstancesController_generateSignal(undefined, {
    params: { id: instanceId },
    headers: requireAuthHeaders(),
  })
  return unwrapResponse(result)
}

// 信号记录相关类型定义（使用生成的类型）
export type TradingSignal = z.infer<typeof schemas.TradingSignalResponseDto>
export type SignalStatus = TradingSignal['status']
export type SignalDirection = TradingSignal['direction']

export interface TradingSignalsListResponse {
  items: TradingSignal[]
  total: number
  page: number
  limit: number
}

// 信号记录 API 方法（使用生成的 client）
export async function fetchTradingSignals(params?: {
  page?: number
  limit?: number
  strategyInstanceId?: string
  strategyId?: string
  symbolId?: string
  status?: SignalStatus
}): Promise<TradingSignalsListResponse> {
  const response = await client.AdminTradingSignalsController_list({
    headers: requireAuthHeaders(),
    queries: {
      page: params?.page || 1,
      limit: params?.limit || 20,
      strategyInstanceId: params?.strategyInstanceId,
      strategyId: params?.strategyId,
      symbolId: params?.symbolId,
      status: params?.status,
    },
  })
  
  const data = unwrapResponse(response)
  return {
    items: Array.isArray(data) ? data : ((data as any)?.items || []),
    total: (data as any)?.total || 0,
    page: params?.page || 1,
    limit: params?.limit || 20,
  }
}

// ===== LLM Strategy 相关类型定义和 API 方法 =====

// LLM策略相关类型（从生成的 schemas 推导）
export type LlmStrategy = z.infer<typeof schemas.LlmStrategyResponseDto>
export type LlmStrategyInstance = z.infer<typeof schemas.LlmStrategyInstanceResponseDto>
export type LlmStrategyRun = z.infer<typeof schemas.LlmStrategyRunResponseDto>
export type CreateLlmStrategyPayload = z.infer<typeof schemas.CreateLlmStrategyDto>
export type UpdateLlmStrategyPayload = z.infer<typeof schemas.UpdateLlmStrategyDto>
export type CreateLlmStrategyInstancePayload = z.infer<typeof schemas.CreateLlmStrategyInstanceDto>
export type UpdateLlmStrategyInstancePayload = z.infer<typeof schemas.UpdateLlmStrategyInstanceDto>

// 从响应 DTO 推导枚举类型
export type LlmStrategyStatus = LlmStrategy['status']
export type LlmStrategyInstanceStatus = LlmStrategyInstance['status']
export type LlmStrategyInstanceMode = LlmStrategyInstance['mode']
export type LlmStrategyRunStatus = LlmStrategyRun['status']

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

// LLM Strategy API 方法
export async function fetchLlmStrategies(params?: {
  page?: number
  limit?: number
  status?: LlmStrategyStatus
  keyword?: string
  orderBy?: string
}): Promise<LlmStrategiesListResponse> {
  const response = await client.AdminLlmStrategiesController_list({
    queries: params,
    headers: requireAuthHeaders(),
  })
  return unwrapResponse(response) as LlmStrategiesListResponse
}

export async function fetchLlmStrategyDetail(id: string): Promise<LlmStrategy> {
  const response = await client.AdminLlmStrategiesController_detail({
    params: { id },
    headers: requireAuthHeaders(),
  })
  return unwrapResponse(response) as LlmStrategy
}

export async function createLlmStrategy(payload: CreateLlmStrategyPayload): Promise<LlmStrategy> {
  const response = await client.AdminLlmStrategiesController_create(payload, {
    headers: requireAuthHeaders(),
  })
  return unwrapResponse(response) as LlmStrategy
}

export async function updateLlmStrategy(id: string, payload: UpdateLlmStrategyPayload): Promise<LlmStrategy> {
  const response = await client.AdminLlmStrategiesController_update(payload, {
    params: { id },
    headers: requireAuthHeaders(),
  })
  return unwrapResponse(response) as LlmStrategy
}

export async function deleteLlmStrategy(id: string): Promise<void> {
  await client.AdminLlmStrategiesController_delete(undefined as any, {
    params: { id },
    headers: requireAuthHeaders(),
  })
}

// LLM Strategy Instance API 方法
export async function fetchLlmStrategyInstances(params?: {
  page?: number
  limit?: number
  status?: LlmStrategyInstanceStatus
  strategyId?: string
  orderBy?: string
}): Promise<LlmStrategyInstancesListResponse> {
  const response = await client.AdminLlmStrategyInstancesController_list({
    queries: params,
    headers: requireAuthHeaders(),
  })
  return unwrapResponse(response) as LlmStrategyInstancesListResponse
}

export async function fetchLlmStrategyInstanceDetail(id: string): Promise<LlmStrategyInstance> {
  const response = await client.AdminLlmStrategyInstancesController_detail({
    params: { id },
    headers: requireAuthHeaders(),
  })
  return unwrapResponse(response) as LlmStrategyInstance
}

export async function createLlmStrategyInstance(payload: CreateLlmStrategyInstancePayload): Promise<LlmStrategyInstance> {
  const response = await client.AdminLlmStrategyInstancesController_create(payload, {
    headers: requireAuthHeaders(),
  })
  return unwrapResponse(response) as LlmStrategyInstance
}

export async function updateLlmStrategyInstance(id: string, payload: UpdateLlmStrategyInstancePayload): Promise<LlmStrategyInstance> {
  const response = await client.AdminLlmStrategyInstancesController_update(payload, {
    params: { id },
    headers: requireAuthHeaders(),
  })
  return unwrapResponse(response) as LlmStrategyInstance
}

export async function deleteLlmStrategyInstance(id: string): Promise<void> {
  await client.AdminLlmStrategyInstancesController_delete(undefined as any, {
    params: { id },
    headers: requireAuthHeaders(),
  })
}

export async function fetchLlmStrategyRuns(instanceId: string, limit: number = 20): Promise<LlmStrategyRun[]> {
  const response = await client.AdminLlmStrategyInstancesController_listRuns({
    params: { id: instanceId },
    queries: { limit },
    headers: requireAuthHeaders(),
  })
  return unwrapListResponse<LlmStrategyRun>(response)
}

export async function testLlmStrategyInstance(id: string): Promise<LlmStrategyRun> {
  const response = await client.AdminLlmStrategyInstancesController_testRun(undefined as any, {
    params: { id },
    headers: requireAuthHeaders(),
  })
  return unwrapResponse(response) as LlmStrategyRun
}

// 市场交易对列表（用于下拉选择，自动与后台配置对齐）
export type MarketSymbol = z.infer<typeof schemas.MarketSymbolDto>

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

  // 使用 SDK client 调用后端接口，统一鉴权与数据结构
  const response = await client.MarketDataController_listSymbols({
    headers: requireAuthHeaders(),
    queries: {
      page,
      limit,
      exchange: params?.exchange,
      type: params?.type,
      status: params?.status,
      instrumentType: params?.instrumentType,
      keyword: params?.keyword,
    },
  })

  return unwrapResponse(response) as MarketSymbolsListResponse
}

// 管理员交易对管理（创建/更新）
// 使用 SDK 生成的类型
export type CreateMarketSymbolPayload = z.infer<typeof schemas.AdminCreateMarketSymbolDto>
export type UpdateMarketSymbolPayload = z.infer<typeof schemas.AdminUpdateMarketSymbolDto>

export async function createMarketSymbol(payload: CreateMarketSymbolPayload): Promise<MarketSymbol> {
  const response = await client.AdminMarketSymbolsController_create(payload as any, {
    headers: requireAuthHeaders(),
  })
  return unwrapResponse(response) as MarketSymbol
}

export async function updateMarketSymbol(code: string, payload: UpdateMarketSymbolPayload): Promise<MarketSymbol> {
  const response = await client.AdminMarketSymbolsController_update(payload as any, {
    params: { code },
    headers: requireAuthHeaders(),
  })
  return unwrapResponse(response) as MarketSymbol
}

export async function fetchLlmStrategyRunDetail(runId: string): Promise<LlmStrategyRun> {
  const response = await client.AdminLlmStrategyInstancesController_getRunDetail({
    params: { runId },
    headers: requireAuthHeaders(),
  })
  return unwrapResponse(response) as LlmStrategyRun
}

