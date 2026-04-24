import type { AccountAiQuantStrategyDetail } from './api'

import {
  API_BASE_URL,
  ApiError,
  apiCall,
  optionalAuthHeaders,
  requireAuthHeaders,
  unwrapResponse,
  validateId,
} from './api-access'

export interface StrategyPlazaTemplate {
  id: string
  name: string
  description: string
  logicDescription: string
  tags: string[]
  riskLevel: 'low' | 'medium' | 'high'
  scenario: string
  exchange: 'okx'
  environment: 'demo'
  marketType: 'spot' | 'perp'
  symbol: string
  timeframe: string
  positionPct: number
  leverage: number | null
  status: 'live' | 'hidden'
  displayOrder: number
  displayMetrics: {
    label: 'official_sample_backtest'
    returnPct: number | null
    winRatePct: number | null
    maxDrawdownPct: number | null
  }
}

export interface StrategyPlazaEditSessionResponse {
  sessionId: string
  templateId: string
  initialMessage: string
}

async function parseStrategyPlazaJson(response: Response, fallbackMessage: string): Promise<unknown> {
  let json: unknown = null
  try {
    json = await response.json()
  } catch {
    json = null
  }

  if (!response.ok) {
    throw new ApiError(fallbackMessage, 'STRATEGY_PLAZA_REQUEST_FAILED', response.status, json)
  }

  return json
}

function buildStrategyPlazaUrl(templateId?: string, action?: 'run' | 'edit-session'): string {
  const baseUrl = `${API_BASE_URL}/strategy-plaza/templates`
  if (!templateId) return baseUrl

  const templateUrl = `${baseUrl}/${encodeURIComponent(templateId)}`
  return action ? `${templateUrl}/${action}` : templateUrl
}

export async function fetchStrategyPlazaTemplates(): Promise<StrategyPlazaTemplate[]> {
  return apiCall(async () => {
    const response = await fetch(buildStrategyPlazaUrl(), {
      method: 'GET',
      headers: optionalAuthHeaders(),
    })
    const json = await parseStrategyPlazaJson(response, '获取策略广场模板失败')
    return unwrapResponse<StrategyPlazaTemplate[]>(
      json as StrategyPlazaTemplate[] | { data?: StrategyPlazaTemplate[]; message?: string },
    )
  }, 'FETCH_STRATEGY_PLAZA_TEMPLATES')
}

export async function runStrategyPlazaTemplate(
  templateId: string,
  runRequestId: string,
): Promise<AccountAiQuantStrategyDetail> {
  return apiCall(async () => {
    validateId(templateId, 'strategy plaza template ID')
    if (!runRequestId?.trim()) {
      throw new ApiError('runRequestId is required', 'INVALID_INPUT')
    }

    const response = await fetch(buildStrategyPlazaUrl(templateId, 'run'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...requireAuthHeaders(),
      },
      body: JSON.stringify({ runRequestId: runRequestId.trim() }),
    })
    const json = await parseStrategyPlazaJson(response, '运行策略广场模板失败')
    return unwrapResponse<AccountAiQuantStrategyDetail>(
      json as AccountAiQuantStrategyDetail | { data?: AccountAiQuantStrategyDetail; message?: string },
    )
  }, 'RUN_STRATEGY_PLAZA_TEMPLATE')
}

export async function startStrategyPlazaEditSession(
  templateId: string,
): Promise<StrategyPlazaEditSessionResponse> {
  return apiCall(async () => {
    validateId(templateId, 'strategy plaza template ID')

    const response = await fetch(buildStrategyPlazaUrl(templateId, 'edit-session'), {
      method: 'POST',
      headers: requireAuthHeaders(),
    })
    const json = await parseStrategyPlazaJson(response, '创建策略广场编辑会话失败')
    return unwrapResponse<StrategyPlazaEditSessionResponse>(
      json as StrategyPlazaEditSessionResponse | { data?: StrategyPlazaEditSessionResponse; message?: string },
    )
  }, 'START_STRATEGY_PLAZA_EDIT_SESSION')
}

export function createStrategyPlazaRunRequestId(): string {
  const randomUUID = globalThis.crypto?.randomUUID
  if (typeof randomUUID === 'function') {
    return `plaza-run-${randomUUID.call(globalThis.crypto)}`
  }

  const randomPart = Math.random().toString(36).slice(2, 10).padEnd(8, '0')
  return `plaza-run-${Date.now().toString(36)}-${randomPart}`
}
