import type { ExecutionContext } from '@nestjs/common'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

/**
 * 可选的 JWT 认证守卫
 * 如果提供了有效的 token，则解析用户信息
 * 如果没有提供 token 或 token 无效，则继续执行但用户信息为空
 * 如果发生系统错误（非认证错误），则正常抛出异常
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false | null | undefined,
    info?: unknown,
    _context?: ExecutionContext,
  ): TUser | null {
    // 如果有系统级错误（非认证错误），必须抛出，避免掩盖真实故障
    if (err && !(err instanceof UnauthorizedException)) {
      throw err
    }

    // 如果是 token 过期或其他认证相关错误，返回 null（允许匿名访问）
    if (info instanceof Error) {
      const errorName = (info as any).name
      if (errorName === 'TokenExpiredError' || errorName === 'JsonWebTokenError') {
        return null
      }
    }

    // 如果是 UnauthorizedException，返回 null（允许匿名访问）
    if (err instanceof UnauthorizedException) {
      return null
    }

    // 返回用户信息或 null
    return (user as TUser) || null
  }
}
