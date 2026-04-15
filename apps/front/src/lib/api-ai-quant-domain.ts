import type {
  AccountAiQuantDeployPayload,
  AccountAiQuantStrategyAction,
  AccountAiQuantStrategyDetail,
  AccountAiQuantStrategyListItem,
  AccountAiQuantUpdateLeveragePayload,
  AiQuantConversationResponse,
  ContinueLlmCodegenSessionPayload,
  LlmCodegenSessionResponse,
  PaginatedResponse,
  StartLlmCodegenSessionPayload,
} from './api'

import {
  deleteStrategyById as deleteMockStrategyById,
  listStrategies as listMockStrategies,
  updateStrategyStatus as updateMockStrategyStatus,
} from '@/components/account/ai-quant-strategy-store'
import {
  buildAiQuantErrorMessage,
  parseAiQuantErrorMeta,
} from '@/components/ai-quant/ai-quant-error-stage'
import {
  API_BASE_URL,
  ApiError,
  apiCall,
  optionalAuthHeaders,
  requireAuthHeaders,
  shouldFallbackDeleteAccountAiQuantMock,
  shouldFallbackToAccountAiQuantMock,
  unwrapResponse,
  validateId,
} from './api-access'

interface AccountAiQuantListQuery {
  userId: string
  page?: number
  limit?: number
  status?: AccountAiQuantStrategyDetail['status']
  subscribedOnly?: boolean
  excludeDraft?: boolean
}

function buildMockAccountAiQuantListResponse(
  query: AccountAiQuantListQuery,
): PaginatedResponse<AccountAiQuantStrategyListItem> {
  const subscribedOnly = query.subscribedOnly === true
  const excludeDraft = query.excludeDraft === true
  const page = query.page ?? 1
  const limit = query.limit ?? 20
  const all = listMockStrategies()
    .filter(item => !query.status || item.status === query.status)
    .map(mapMockStrategyToListItem)
    .filter(item => (!subscribedOnly || item.isSubscribed) && (!excludeDraft || item.status !== 'draft'))
  const start = (page - 1) * limit
  const items = all.slice(start, start + limit)
  return {
    total: all.length,
    page,
    limit,
    items,
  }
}

function mapMockStrategyToListItem(item: ReturnType<typeof listMockStrategies>[number]): AccountAiQuantStrategyListItem {
  const paramSchema = item.paramSchema ?? null
  const paramValues = paramSchema ? (item.paramValues ?? {}) : null

  return {
    id: item.id,
    name: item.name,
    status: item.status,
    exchange: item.exchange,
    symbol: item.symbol,
    timeframe: item.timeframe,
    positionPct: item.positionPct,
    isSubscribed: true,
    paramSchema,
    paramValues,
    schemaVersion: item.schemaVersion ?? null,
    metrics: {
      returnPct: item.metrics.returnPct,
      maxDrawdownPct: item.metrics.maxDrawdownPct,
      winRatePct: item.metrics.winRatePct,
      tradeCount: item.metrics.tradeCount,
    },
    updatedAt: item.updatedAt,
  }
}

function buildAccountAiQuantHeaders(userId?: string) {
  return {
    'Content-Type': 'application/json',
    ...(userId ? { 'x-user-id': userId } : {}),
    ...optionalAuthHeaders(),
  }
}

async function parseAccountAiQuantJson(response: Response, fallbackMessage: string) {
  let json: unknown = null
  try {
    json = await response.json()
  } catch {
    json = null
  }

  if (!response.ok) {
    throw new ApiError(
      parseApiErrorMessage(response.status, json, fallbackMessage),
      'ACCOUNT_AI_QUANT_REQUEST_FAILED',
      response.status,
      json,
    )
  }

  return json
}

function parseApiErrorMessage(status: number, payload: unknown, fallback: string): string {
  const meta = parseAiQuantErrorMeta(payload)
  return buildAiQuantErrorMessage(fallback, status, meta)
}

async function postLlmCodegen<T>(path: string, payload: unknown): Promise<T> {
  const authHeaders = requireAuthHeaders()
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/llm-strategy-codegen${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify(payload),
    })
  } catch (error) {
    const message = error instanceof Error && error.message.trim() ? error.message : 'LLM 策略生成请求失败'
    throw new ApiError(message, 'LLM_CODEGEN_ERROR', 502)
  }

  let json: unknown = null
  try {
    json = await response.json()
  } catch {
    json = null
  }

  if (!response.ok) {
    throw new ApiError(
      parseApiErrorMessage(response.status, json, 'LLM 策略生成请求失败'),
      'LLM_CODEGEN_ERROR',
      response.status,
      json,
    )
  }

  return unwrapResponse<T>(json as T | { data?: T; message?: string })
}

export async function fetchAccountAiQuantStrategies(
  query: AccountAiQuantListQuery,
): Promise<PaginatedResponse<AccountAiQuantStrategyListItem>> {
  const subscribedOnly = query.subscribedOnly ?? true
  const excludeDraft = query.excludeDraft ?? true

  try {
    return await apiCall(async () => {
      if (!query.userId?.trim()) {
        throw new ApiError('userId is required', 'INVALID_INPUT')
      }

      const search = new URLSearchParams({
        userId: query.userId.trim(),
        page: String(query.page ?? 1),
        limit: String(query.limit ?? 20),
        subscribedOnly: String(subscribedOnly),
        excludeDraft: String(excludeDraft),
      })
      if (query.status) search.set('status', query.status)

      const response = await fetch(`${API_BASE_URL}/account/ai-quant/strategies?${search.toString()}`, {
        method: 'GET',
        headers: buildAccountAiQuantHeaders(query.userId.trim()),
      })
      const json = await parseAccountAiQuantJson(response, '获取 AI 量化策略列表失败')
      return unwrapResponse<PaginatedResponse<AccountAiQuantStrategyListItem>>(
        json as PaginatedResponse<AccountAiQuantStrategyListItem> | { data?: PaginatedResponse<AccountAiQuantStrategyListItem>; message?: string },
      )
    }, 'FETCH_ACCOUNT_AI_QUANT_STRATEGIES')
  } catch (error) {
    if (!shouldFallbackToAccountAiQuantMock(error)) throw error
    return buildMockAccountAiQuantListResponse({
      ...query,
      subscribedOnly,
      excludeDraft,
    })
  }
}

export async function fetchAccountAiQuantStrategyDetail(
  strategyId: string,
  userId: string,
): Promise<AccountAiQuantStrategyDetail> {
  return apiCall(async () => {
    validateId(strategyId, 'strategy ID')
    if (!userId?.trim()) {
      throw new ApiError('userId is required', 'INVALID_INPUT')
    }

    const search = new URLSearchParams({ userId: userId.trim() })
    const response = await fetch(
      `${API_BASE_URL}/account/ai-quant/strategies/${encodeURIComponent(strategyId)}?${search.toString()}`,
      { method: 'GET', headers: buildAccountAiQuantHeaders(userId.trim()) },
    )
    const json = await parseAccountAiQuantJson(response, '获取 AI 量化策略详情失败')
    const detail = unwrapResponse<AccountAiQuantStrategyDetail | null>(
      json as AccountAiQuantStrategyDetail | { data?: AccountAiQuantStrategyDetail; message?: string },
    )
    if (!detail) {
      throw new ApiError('策略详情不存在', 'ACCOUNT_AI_QUANT_NOT_FOUND', 404, json)
    }
    return detail
  }, 'FETCH_ACCOUNT_AI_QUANT_STRATEGY_DETAIL')
}

export async function performAccountAiQuantStrategyAction(
  strategyId: string,
  payload: { userId: string; action: AccountAiQuantStrategyAction },
): Promise<AccountAiQuantStrategyDetail> {
  return apiCall(async () => {
    validateId(strategyId, 'strategy ID')
    if (!payload.userId?.trim()) {
      throw new ApiError('userId is required', 'INVALID_INPUT')
    }

    const response = await fetch(
      `${API_BASE_URL}/account/ai-quant/strategies/${encodeURIComponent(strategyId)}/actions`,
      {
        method: 'POST',
        headers: buildAccountAiQuantHeaders(payload.userId.trim()),
        body: JSON.stringify({ userId: payload.userId.trim(), action: payload.action }),
      },
    )
    const json = await parseAccountAiQuantJson(response, '执行策略动作失败')
    return unwrapResponse<AccountAiQuantStrategyDetail>(
      json as AccountAiQuantStrategyDetail | { data?: AccountAiQuantStrategyDetail; message?: string },
    )
  }, 'PERFORM_ACCOUNT_AI_QUANT_STRATEGY_ACTION')
}

export async function deleteAccountAiQuantStrategy(
  strategyId: string,
  userId: string,
): Promise<void> {
  try {
    return await apiCall(async () => {
      validateId(strategyId, 'strategy ID')
      if (!userId?.trim()) {
        throw new ApiError('userId is required', 'INVALID_INPUT')
      }

      const search = new URLSearchParams({ userId: userId.trim() })
      const response = await fetch(
        `${API_BASE_URL}/account/ai-quant/strategies/${encodeURIComponent(strategyId)}?${search.toString()}`,
        { method: 'DELETE', headers: buildAccountAiQuantHeaders(userId.trim()) },
      )
      await parseAccountAiQuantJson(response, '删除策略失败')
    }, 'DELETE_ACCOUNT_AI_QUANT_STRATEGY')
  } catch (error) {
    if (!shouldFallbackDeleteAccountAiQuantMock(error)) throw error
    deleteMockStrategyById(strategyId)
  }
}

export async function deployAccountAiQuantStrategy(
  payload: AccountAiQuantDeployPayload,
): Promise<AccountAiQuantStrategyDetail> {
  return apiCall(async () => {
    if (!payload.userId?.trim()) throw new ApiError('userId is required', 'INVALID_INPUT')
    if (!payload.name?.trim()) throw new ApiError('name is required', 'INVALID_INPUT')
    if (!payload.deployRequestId?.trim()) throw new ApiError('deployRequestId is required', 'INVALID_INPUT')
    if (!payload.publishedSnapshotId?.trim()) throw new ApiError('publishedSnapshotId is required', 'INVALID_INPUT')

    const response = await fetch(`${API_BASE_URL}/account/ai-quant/strategies/deploy`, {
      method: 'POST',
      headers: buildAccountAiQuantHeaders(payload.userId.trim()),
      body: JSON.stringify({
        userId: payload.userId.trim(),
        name: payload.name.trim(),
        deployRequestId: payload.deployRequestId.trim(),
        publishedSnapshotId: payload.publishedSnapshotId.trim(),
        strategyInstanceId: payload.strategyInstanceId?.trim() || undefined,
        exchangeAccountId: payload.exchangeAccountId,
        exchangeAccountName: payload.exchangeAccountName,
        deploymentExecutionConfig: payload.deploymentExecutionConfig,
      }),
    })
    const json = await parseAccountAiQuantJson(response, '部署策略失败')
    return unwrapResponse<AccountAiQuantStrategyDetail>(
      json as AccountAiQuantStrategyDetail | { data?: AccountAiQuantStrategyDetail; message?: string },
    )
  }, 'DEPLOY_ACCOUNT_AI_QUANT_STRATEGY')
}

export async function updateAccountAiQuantStrategyLeverage(
  strategyId: string,
  payload: AccountAiQuantUpdateLeveragePayload,
): Promise<AccountAiQuantStrategyDetail> {
  return apiCall(async () => {
    validateId(strategyId, 'strategy ID')
    if (!payload.userId?.trim()) throw new ApiError('userId is required', 'INVALID_INPUT')
    if (!Number.isFinite(payload.leverage) || payload.leverage <= 0) {
      throw new ApiError('leverage is required', 'INVALID_INPUT')
    }

    const response = await fetch(
      `${API_BASE_URL}/account/ai-quant/strategies/${encodeURIComponent(strategyId)}/execution/leverage`,
      {
        method: 'POST',
        headers: buildAccountAiQuantHeaders(payload.userId.trim()),
        body: JSON.stringify({ userId: payload.userId.trim(), leverage: payload.leverage }),
      },
    )
    const json = await parseAccountAiQuantJson(response, '更新策略杠杆失败')
    return unwrapResponse<AccountAiQuantStrategyDetail>(
      json as AccountAiQuantStrategyDetail | { data?: AccountAiQuantStrategyDetail; message?: string },
    )
  }, 'UPDATE_ACCOUNT_AI_QUANT_STRATEGY_LEVERAGE')
}

export async function startLlmCodegenSession(
  payload: StartLlmCodegenSessionPayload,
): Promise<LlmCodegenSessionResponse> {
  return postLlmCodegen<LlmCodegenSessionResponse>('/sessions', payload)
}

export async function listAiQuantConversations(): Promise<AiQuantConversationResponse[]> {
  const authHeaders = requireAuthHeaders()
  const response = await fetch(`${API_BASE_URL}/account/ai-quant/conversations`, {
    method: 'GET',
    headers: authHeaders,
  })
  let json: unknown = null
  try {
    json = await response.json()
  } catch {
    json = null
  }
  if (!response.ok) {
    const message = parseApiErrorMessage(response.status, json, '查询 AI Quant 会话列表失败')
    throw new ApiError(message, 'AI_QUANT_CONVERSATION_ERROR', response.status, json)
  }
  return unwrapResponse<AiQuantConversationResponse[]>(
    json as AiQuantConversationResponse[] | { data?: AiQuantConversationResponse[]; message?: string },
  )
}

export async function deleteAiQuantConversation(conversationId: string): Promise<void> {
  const authHeaders = requireAuthHeaders()
  const response = await fetch(`${API_BASE_URL}/account/ai-quant/conversations/${encodeURIComponent(conversationId)}`, {
    method: 'DELETE',
    headers: authHeaders,
  })
  let json: unknown = null
  try {
    json = await response.json()
  } catch {
    json = null
  }
  if (!response.ok) {
    const message = parseApiErrorMessage(response.status, json, '删除 AI Quant 会话失败')
    throw new ApiError(message, 'AI_QUANT_CONVERSATION_ERROR', response.status, json)
  }
}

export async function continueLlmCodegenSession(
  sessionId: string,
  payload: ContinueLlmCodegenSessionPayload,
): Promise<LlmCodegenSessionResponse> {
  validateId(sessionId, 'llm codegen session ID')
  if (!payload.message.trim()) {
    throw new ApiError('message is required', 'INVALID_INPUT')
  }
  return postLlmCodegen<LlmCodegenSessionResponse>(`/sessions/${sessionId}/messages`, payload)
}

export async function getLlmCodegenSession(
  sessionId: string,
): Promise<LlmCodegenSessionResponse> {
  validateId(sessionId, 'llm codegen session ID')
  const authHeaders = requireAuthHeaders()
  const response = await fetch(`${API_BASE_URL}/llm-strategy-codegen/sessions/${sessionId}`, {
    method: 'GET',
    headers: authHeaders,
  })
  let json: unknown = null
  try {
    json = await response.json()
  } catch {
    json = null
  }
  if (!response.ok) {
    const message = parseApiErrorMessage(response.status, json, '查询 LLM 代码生成会话失败')
    throw new ApiError(message, 'LLM_CODEGEN_ERROR', response.status, json)
  }
  return unwrapResponse<LlmCodegenSessionResponse>(
    json as LlmCodegenSessionResponse | { data?: LlmCodegenSessionResponse; message?: string },
  )
}
