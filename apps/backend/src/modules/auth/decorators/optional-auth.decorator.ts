import { applyDecorators, UseGuards } from '@nestjs/common'

import { OptionalJwtAuthGuard } from '../guards/optional-jwt-auth.guard'

/**
 * 可选认证装饰器
 * 用于不强制要求登录的接口，但如果用户已登录则可以获取用户信息
 */
export const OptionalAuth = () => applyDecorators(UseGuards(OptionalJwtAuthGuard))
