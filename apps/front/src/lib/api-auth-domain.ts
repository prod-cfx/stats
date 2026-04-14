import type { schemas } from '@ai/api-contracts'
import type { ZodTypeAny } from 'zod'

import { client } from './api-client'
import { apiCall, requireAuthHeaders, unwrapResponse } from './api-access'

type Infer<T extends ZodTypeAny> = T['_output']

type LoginPayload = Infer<typeof schemas.LoginRequestDto>
type RegisterPayload = Infer<typeof schemas.RegisterRequestDto>
type PasswordResetRequestPayload = Infer<typeof schemas.PasswordResetRequestDto>
type VerifyResetPayload = Infer<typeof schemas.VerifyPasswordResetRequestDto>
type SendVerificationCodePayload = Infer<typeof schemas.SendVerificationCodeRequestDto>

export interface TelegramLoginConfigResponse {
  botName?: string | null
}

export async function login(payload: LoginPayload) {
  return apiCall(async () => {
    const response = await client.AuthController_login(payload)
    return unwrapResponse(response)
  }, 'LOGIN')
}

export async function registerAccount(payload: RegisterPayload) {
  const response = await client.AuthController_register(payload)
  return unwrapResponse(response)
}

export async function requestPasswordReset(payload: PasswordResetRequestPayload) {
  const response = await client.AuthController_requestPasswordReset(payload)
  return unwrapResponse(response)
}

export async function verifyPasswordReset(payload: VerifyResetPayload) {
  const response = await client.AuthController_verifyPasswordReset(payload)
  return unwrapResponse(response)
}

export async function fetchProfile() {
  const response = await client.UserController_me({ headers: requireAuthHeaders() })
  return unwrapResponse(response)
}

export async function sendVerificationCode(payload: SendVerificationCodePayload) {
  const response = await client.AuthController_sendVerificationCode(payload)
  return unwrapResponse(response)
}

export async function getTelegramLoginConfigRequest(): Promise<TelegramLoginConfigResponse> {
  const response = await (client as any).AuthController_getTelegramLoginConfig()
  return unwrapResponse<TelegramLoginConfigResponse>(
    response as unknown as TelegramLoginConfigResponse | { data?: TelegramLoginConfigResponse; message?: string },
  )
}
