import type { ExecutionContext } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common'
import { GUARDS_METADATA } from '@nestjs/common/constants'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { DomainException } from '@/common/exceptions/domain.exception'
import { IS_OPTIONAL_AUTH_KEY } from '../decorators/access-control.decorator'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import { JwtAuthGuard } from './jwt-auth.guard'
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard'

@Injectable()
export class GlobalJwtAuthBoundaryGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super()
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') {
      return true
    }

    if (this.isPublic(context)) {
      return true
    }

    return (await super.canActivate(context)) as boolean
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false | null | undefined,
    info?: unknown,
    context?: ExecutionContext,
  ): TUser | null {
    if (context && this.isOptionalAuth(context)) {
      if (err && !(err instanceof UnauthorizedException)) {
        throw err
      }

      if (err instanceof UnauthorizedException || info instanceof Error) {
        return null
      }

      return (user as TUser) || null
    }

    if (err || !user) {
      throw new DomainException('Unauthorized', {
        code: ErrorCode.AUTH_UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    return user
  }

  private isPublic(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]) === true
  }

  private isOptionalAuth(context: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(IS_OPTIONAL_AUTH_KEY, [context.getHandler(), context.getClass()]) === true) {
      return true
    }

    const handlerGuards = this.reflector.get<unknown[]>(GUARDS_METADATA, context.getHandler())
    if (handlerGuards?.length) {
      if (this.hasOptionalJwtAuthGuard(handlerGuards)) {
        return true
      }

      if (this.hasJwtAuthGuard(handlerGuards)) {
        return false
      }
    }

    const controllerGuards = this.reflector.get<unknown[]>(GUARDS_METADATA, context.getClass()) ?? []
    return this.hasOptionalJwtAuthGuard(controllerGuards)
  }

  private hasJwtAuthGuard(guards: unknown[]): boolean {
    return guards.includes(JwtAuthGuard)
  }

  private hasOptionalJwtAuthGuard(guards: unknown[]): boolean {
    return guards.includes(OptionalJwtAuthGuard)
  }
}
