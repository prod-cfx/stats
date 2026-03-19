import type { ExecutionContext } from '@nestjs/common'
import { createParamDecorator } from '@nestjs/common'

/**
 * 可选用户装饰器
 * 用于获取当前用户信息（如果已登录）
 * 配合 @OptionalAuth() 使用
 */
export const OptionalUser = createParamDecorator((data: string, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest()
  const user = request.user

  // 如果没有用户信息，返回 undefined
  if (!user) {
    return undefined
  }

  return data ? user?.[data] : user
})
