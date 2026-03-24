import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { JwtPayload } from '../interfaces/jwt-payload.interface'
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type'
// Nest 注入需要运行时引用 ConfigService，保留值导入

import { ErrorCode } from '@ai/shared'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { DomainException } from '@/common/exceptions/domain.exception'
import { PrincipalType } from '@/prisma/prisma.types'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name)

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {
    const secret = configService.get<string>('jwt.secret')
    if (!secret) {
      throw new DomainException('auth.jwt_config_error', {
        code: ErrorCode.AUTH_JWT_CONFIG_ERROR,
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        args: { reason: 'JWT_SECRET is not configured' },
      })
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    })
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload?.sub) {
      throw new DomainException('Invalid token', {
        code: ErrorCode.AUTH_UNAUTHORIZED,
        status: HttpStatus.UNAUTHORIZED,
      })
    }

    const principalType: PrincipalType = payload.principalType === 'admin' ? PrincipalType.ADMIN : PrincipalType.USER

    // 验证 tokenVersion（仅对 USER 类型，ADMIN 暂不校验）
    if (principalType === PrincipalType.USER && payload.tokenVersion !== undefined) {
      const user = await this.txHost.tx.user.findUnique({
        where: { id: payload.sub },
        select: { tokenVersion: true },
      })

      if (!user) {
        this.logger.warn(`JWT 验证失败：用户 ${payload.sub} 不存在`)
        throw new DomainException('User not found', {
          code: ErrorCode.AUTH_UNAUTHORIZED,
          status: HttpStatus.UNAUTHORIZED,
        })
      }

      // 如果 tokenVersion 不匹配，说明用户已重置密码，旧 token 失效
      if (user.tokenVersion !== payload.tokenVersion) {
        this.logger.warn(
          `JWT 验证失败：用户 ${payload.sub} tokenVersion 不匹配（payload: ${payload.tokenVersion}, db: ${user.tokenVersion}）`,
        )
        throw new DomainException('Token has been invalidated', {
          code: ErrorCode.AUTH_UNAUTHORIZED,
          status: HttpStatus.UNAUTHORIZED,
        })
      }
    }

    // 验证角色分配
    const hasAssignment = await this.txHost.tx.roleAssignment.findFirst({
      where: {
        principalId: payload.sub,
        principalType,
      },
      select: { id: true },
    })

    if (!hasAssignment) {
      this.logger.warn(
        `JWT 验证失败：principal ${payload.sub} (${principalType}) 无角色分配记录（可能已被撤权或删除）`,
      )
      throw new DomainException('User has no assigned roles', {
        code: ErrorCode.AUTH_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      })
    }

    return {
      id: payload.sub,
      email: payload.email ?? null,
      roles: payload.roles ?? [],
      principalType: payload.principalType ?? 'user',
      bridged: false,
    }
  }
}
