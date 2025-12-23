import type { ExecutionContext } from '@nestjs/common'
import { ErrorCode } from '@ai/shared'
import { HttpStatus, Injectable } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { DomainException } from '@/common/exceptions/domain.exception'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser | false | null | undefined,
    _info?: unknown,
    _context?: ExecutionContext,
  ): TUser {
    if (err || !user) {
      throw new DomainException('Unauthorized', {
        code: ErrorCode.AUTH_UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }
    return user
  }
}


