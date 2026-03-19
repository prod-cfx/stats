import type { z } from 'zod'
import { schemas } from '@ai/api-contracts'

// Auth Response 类型
export type AuthResponseDto = z.infer<typeof schemas.AuthResponseDto>
export const authResponseSchema = schemas.AuthResponseDto

// User Profile 类型
export type UserProfile = z.infer<typeof schemas.UserProfileResponseDto>
export const profileResponseSchema = schemas.UserProfileResponseDto

// 验证码用途枚举
export enum VerificationCodePurpose {
  EMAIL_VERIFICATION = 'EMAIL_VERIFICATION',
  PASSWORD_RESET = 'PASSWORD_RESET',
}
