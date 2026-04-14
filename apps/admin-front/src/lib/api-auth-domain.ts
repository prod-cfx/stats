import type { schemas } from '@ai/api-contracts'
import type { z } from 'zod'

import { client, unwrapResponse } from './api-access'

type AdminLoginPayload = z.infer<typeof schemas.AdminLoginDto>
type AdminRegisterPayload = z.infer<typeof schemas.AdminRegisterDto>

export async function loginAdmin(payload: AdminLoginPayload) {
  const response = await client.AdminAuthController_login(payload)
  return unwrapResponse(response)
}

export async function registerAdmin(payload: AdminRegisterPayload) {
  const response = await client.AdminAuthController_register(payload)
  return unwrapResponse(response)
}
