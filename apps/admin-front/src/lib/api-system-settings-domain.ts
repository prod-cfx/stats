import type { SettingResponse } from './api'

import { client, requireAuthHeaders, unwrapResponse, withAuthErrorHandling } from './api-access'

const SYSTEM_PROMPT_CATEGORY = 'system_prompt'

export interface CreateSystemPromptSettingPayload {
  key: string
  value: string
  type?: string
  description?: string
}

export interface UpdateSystemPromptSettingPayload {
  value: string
  type?: string
  description?: string
}

export async function fetchSystemPromptSettings(): Promise<SettingResponse[]> {
  return withAuthErrorHandling(async () => {
    const response = await client.AdminSettingsController_getAllSettings({
      headers: requireAuthHeaders(),
      queries: { category: SYSTEM_PROMPT_CATEGORY },
    })
    const data = unwrapResponse<SettingResponse[] | { items: SettingResponse[] }>(response as any)
    if (Array.isArray(data)) return data
    if (data && Array.isArray((data as any).items)) return (data as any).items
    return []
  })
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
      { headers: requireAuthHeaders() },
    )
    return unwrapResponse<SettingResponse>(response as any)
  })
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
