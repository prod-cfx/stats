import type { AccountAiQuantStrategyDetail } from './api'

import {
  API_BASE_URL,
  ApiError,
  apiCall,
  extractBackendErrorMessage,
  optionalAuthHeaders,
  requireAuthHeaders,
  unwrapResponse,
} from './api-access'

const STRATEGY_PLAZA_TEMPLATE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

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
    throw new ApiError(
      extractBackendErrorMessage(json, fallbackMessage),
      extractBackendErrorCode(json) ?? 'STRATEGY_PLAZA_REQUEST_FAILED',
      response.status,
      json,
    )
  }

  return json
}

function getStrategyPlazaTemplateSlug(templateId: string): string {
  const slug = templateId.trim()
  if (!STRATEGY_PLAZA_TEMPLATE_SLUG_PATTERN.test(slug)) {
    throw new ApiError('strategy plaza template ID is required', 'INVALID_INPUT')
  }
  return slug
}

function extractBackendErrorCode(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const error = (payload as { error?: { code?: unknown } }).error
  return typeof error?.code === 'string' && error.code.trim() ? error.code : undefined
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
    const slug = getStrategyPlazaTemplateSlug(templateId)
    if (!runRequestId?.trim()) {
      throw new ApiError('runRequestId is required', 'INVALID_INPUT')
    }

    const response = await fetch(buildStrategyPlazaUrl(slug, 'run'), {
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
    const slug = getStrategyPlazaTemplateSlug(templateId)

    const response = await fetch(buildStrategyPlazaUrl(slug, 'edit-session'), {
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
