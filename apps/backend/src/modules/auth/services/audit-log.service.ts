import type { RequiredRule } from './permission.service'
import type { AuthenticatedUser } from '@/common/types/authenticated-user.type'
import { Injectable, Logger } from '@nestjs/common'

export interface AuditLogContext {
  method: string
  path: string
  ip?: string
  userAgent?: string
}

export interface AuditLogEntry {
  timestamp: string
  userId: string
  action: 'permission_check'
  rules: RequiredRule[]
  result: 'allowed' | 'denied'
  method: string
  path: string
  ip?: string
  userAgent?: string
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name)

  async logPermissionCheck(
    user: AuthenticatedUser,
    rules: RequiredRule[],
    result: 'allowed' | 'denied',
    ctx: AuditLogContext,
  ): Promise<void> {
    const entry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      userId: user.id,
      action: 'permission_check',
      rules,
      result,
      method: ctx.method,
      path: ctx.path,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    }

    // 结构化日志，后续可接入集中式日志系统或落库
    this.logger.log(JSON.stringify(entry))
  }
}


