import type { CanActivate, ExecutionContext } from '@nestjs/common'
import type { RequiredRule } from '../services/permission.service'
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type'
import { ErrorCode } from '@ai/shared'
// Nest 注入需要运行时引用 Reflector，保留值导入
 
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { DomainException } from '@/common/exceptions/domain.exception'
// Nest 注入需要运行时引用 PermissionService/AuditLogService，保留值导入
 
import { AuditLogService } from '../services/audit-log.service'
 
import { PermissionService } from '../services/permission.service'

export function UseRoles(...rules: RequiredRule[]) {
  const normalized =
    rules.length === 1 && !Array.isArray(rules[0]) ? [rules[0] as RequiredRule] : (rules as RequiredRule[])
  return Reflect.metadata('roles', normalized)
}

@Injectable()
export class ACGuard implements CanActivate {
  private readonly logger = new Logger(ACGuard.name)

  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(PermissionService) private readonly permissionService: PermissionService,
    @Inject(AuditLogService) private readonly auditLogService: AuditLogService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler()
    const controller = context.getClass()

    // 合并控制器级和方法级的权限规则（不能用 ?? 运算符，会导致 handler 规则覆盖 controller）
    const controllerRules = this.reflector.get<RequiredRule[]>('roles', controller) ?? []
    const handlerRules = this.reflector.get<RequiredRule[]>('roles', handler) ?? []
    const rules = [...controllerRules, ...handlerRules]

    if (rules.length === 0) {
      return true
    }

    const request = context.switchToHttp().getRequest()
    const user = request.user as AuthenticatedUser | undefined

    if (!user?.id) {
      this.logger.warn(`访问被拒绝：未登录用户访问 ${request.method} ${request.url}`)
      throw new DomainException('Forbidden', {
        code: ErrorCode.AUTH_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      })
    }

    const allowed = await this.permissionService.hasAccess(rules, user)

    await this.auditLogService.logPermissionCheck(
      user,
      rules,
      allowed ? 'allowed' : 'denied',
      {
        method: request.method,
        path: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
      },
    )

    if (!allowed) {
      this.logger.warn(
        `权限不足：用户(${user.id}) 访问 ${request.method} ${request.url} 需要 ${JSON.stringify(rules)}`,
      )
      throw new DomainException('Forbidden', {
        code: ErrorCode.AUTH_FORBIDDEN,
        status: HttpStatus.FORBIDDEN,
      })
    }

    return true
  }
}

