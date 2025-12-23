import type { schemas } from '@ai/api-contracts'
import type { z } from 'zod'

export type AdminAuthResponse = z.infer<typeof schemas.AdminAuthResponseDto>
export type AdminProfile = z.infer<typeof schemas.AdminProfileDto>
