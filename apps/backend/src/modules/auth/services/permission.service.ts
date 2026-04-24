import type { AuthenticatedUser } from '@/common/types/authenticated-user.type'
import { Inject, Injectable, Logger } from '@nestjs/common'
// Nest 注入需要运行时引用 ConfigService，保留值导入

import { ConfigService } from '@nestjs/config'
import { AppResource, AppRole, RBAC_PERMISSIONS } from '../rbac/permissions'
// Nest 注入需要运行时引用 PermissionCacheService，保留值导入

// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { RoleAssignmentRepository } from '../repositories/role-assignment.repository'
import { PermissionCacheService } from './permission-cache.service'

type PermissionAction = 'read' | 'create' | 'update' | 'delete'

const BUILTIN_ROLE_CODES = new Set<string>(Object.values(AppRole))
const APP_RESOURCES = new Set<AppResource>(Object.values(AppResource))
const SUPPORTED_ACTIONS: PermissionAction[] = ['read', 'create', 'update', 'delete']
const SUPPORTED_ACTION_SET = new Set<PermissionAction>(SUPPORTED_ACTIONS)

const ACTION_ALIAS_MAP: Record<string, PermissionAction[]> = {
  read: ['read'],
  list: ['read'],
  view: ['read'],
  create: ['create'],
  add: ['create'],
  update: ['update'],
  edit: ['update'],
  delete: ['delete'],
  remove: ['delete'],
  manage: ['read', 'create', 'update', 'delete'],
  all: ['read', 'create', 'update', 'delete'],
  '*': ['read', 'create', 'update', 'delete'],
}

export interface RequiredRule {
  action: string
  resource: string
  possession?: 'own' | 'any'
}

@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name)
  private readonly debugMode: boolean
  private readonly customRolePermissions = new Map<string, ParsedPermission[]>()
  private readonly wildcardCustomRoles = new Set<string>()

  constructor(
    private readonly roleAssignmentRepository: RoleAssignmentRepository,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(PermissionCacheService) private readonly cache: PermissionCacheService,
  ) {
    this.debugMode = this.configService.get<boolean>('rbac.debugMode', false)
  }

  async hasAccess(rules: RequiredRule[], user: AuthenticatedUser | undefined): Promise<boolean> {
    try {
      // 未登录用户视为 VISITOR 角色，仅具备极少读权限（例如鲸鱼 Discover 等公开统计）
      const userRoles = user?.id ? await this.getUserRoles(user) : [AppRole.VISITOR]

      if (this.debugMode) {
        this.logger.debug(
          `权限检查 - 用户: ${user?.id ?? 'anonymous'}, 角色: ${JSON.stringify(
            userRoles,
          )}, 规则: ${JSON.stringify(rules)}`,
        )
      }

      if (userRoles.includes(AppRole.SUPER_ADMIN)) {
        return true
      }

      // 满足任意一条规则即可访问（OR 逻辑）
      for (const rule of rules) {
        if (this.checkSingleRule(rule, userRoles)) {
          return true
        }
      }

      return false
    } catch (error) {
      this.logger.error(`权限检查异常: ${(error as Error).message}`, error instanceof Error ? error.stack : undefined)
      return false
    }
  }

  private checkSingleRule(rule: RequiredRule, roles: string[]): boolean {
    if (rule.resource === '*' && !roles.includes(AppRole.SUPER_ADMIN)) {
      return false
    }

    return roles.some(role => {
      try {
        const permission = RBAC_PERMISSIONS.permission({
          role,
          action: rule.action,
          resource: rule.resource,
          possession: rule.possession ?? 'any',
        })
        if (permission.granted) return true
      } catch (error) {
        if (BUILTIN_ROLE_CODES.has(role)) {
          throw error
        }
      }
      return this.hasCustomPermission(role, rule)
    })
  }

  async getUserRoles(user: AuthenticatedUser): Promise<string[]> {
    // 暂时禁用缓存读写以确保实时撤权（待实现 RoleAssignment CRUD + invalidate 后恢复）
    // const cached = await this.cache.get(user.id, user.principalType)
    // if (cached && cached.length > 0) {
    //   return cached
    // }

    // 不信任 JWT payload 中的角色，仅从数据库查询（单一真实来源）
    const collected = new Set<string>()

    type PrincipalTypeValue = 'USER' | 'ADMIN'
    const principalType: PrincipalTypeValue = user.principalType === 'admin' ? 'ADMIN' : 'USER'

    const assignments = await this.roleAssignmentRepository.findRolesByPrincipal(user.id, principalType)

    assignments.forEach(({ role }: { role: { code: string | null; apiPermissions: string[] | null } }) => {
      if (!role?.code) return
      collected.add(role.code)
      this.cacheCustomRolePermissions(role.code, role.apiPermissions ?? [])
    })

    if (collected.size === 0) {
      collected.add(AppRole.USER)
    }

    const roles = Array.from(collected)
    // 暂时禁用缓存写入（TTL=0 会导致永久缓存而非禁用）
    // await this.cache.set(user.id, user.principalType, roles)
    return roles
  }

  private cacheCustomRolePermissions(roleCode: string, apiPermissions: string[]) {
    if (BUILTIN_ROLE_CODES.has(roleCode)) {
      this.customRolePermissions.delete(roleCode)
      this.wildcardCustomRoles.delete(roleCode)
      return
    }

    if (apiPermissions.some(permission => permission.trim() === '*')) {
      this.wildcardCustomRoles.add(roleCode)
      this.customRolePermissions.delete(roleCode)
      return
    }

    this.wildcardCustomRoles.delete(roleCode)
    const resourceMap = new Map<AppResource, Set<PermissionAction>>()
    apiPermissions.forEach(permission => {
      const parsed = this.parseApiPermission(permission)
      if (!parsed) {
        if (permission.trim().length > 0) {
          this.logger.warn(`忽略无法解析的 apiPermission "${permission}" (角色 ${roleCode})`)
        }
        return
      }
      const existing = resourceMap.get(parsed.resource) ?? new Set<PermissionAction>()
      parsed.actions.forEach(action => existing.add(action))
      resourceMap.set(parsed.resource, existing)
    })

    const parsedPermissions: ParsedPermission[] = Array.from(resourceMap.entries()).map(
      ([resource, actions]) => ({
        resource,
        actions,
      }),
    )

    this.customRolePermissions.set(roleCode, parsedPermissions)
  }

  private hasCustomPermission(role: string, rule: RequiredRule): boolean {
    if (this.wildcardCustomRoles.has(role)) {
      return true
    }
    const permissions = this.customRolePermissions.get(role)
    if (!permissions || permissions.length === 0) {
      return false
    }

    const action = this.normalizeAction(rule.action)
    if (!action) {
      return false
    }

    if (!APP_RESOURCES.has(rule.resource as AppResource)) {
      return false
    }
    const resource = rule.resource as AppResource

    return permissions.some(permission => {
      if (permission.resource !== resource) {
        return false
      }
      return permission.actions.has(action)
    })
  }

  private normalizeAction(action: string): PermissionAction | null {
    const normalized = action.toLowerCase() as PermissionAction
    return SUPPORTED_ACTION_SET.has(normalized) ? normalized : null
  }

  private parseApiPermission(permission: string):
    | { resource: AppResource; actions: PermissionAction[] }
    | null {
    const normalized = permission.trim().toLowerCase()
    if (!normalized) {
      return null
    }

    const segments = normalized.split(':').filter(Boolean)
    if (segments.length < 2) {
      return null
    }

    const actionKey = segments.pop()!
    const resourceKey = segments.pop()!
    const resource = this.resolveResource(resourceKey)
    if (!resource) {
      return null
    }

    const actions = ACTION_ALIAS_MAP[actionKey]
    if (!actions) {
      return null
    }

    return { resource, actions }
  }

  private resolveResource(resourceKey: string): AppResource | null {
    const normalized = resourceKey.replace(/[^a-z]/g, '_')
    switch (normalized) {
      case 'admin_user':
      case 'adminuser':
      case 'admin_users':
        return AppResource.ADMIN_USER
      case 'admin_menu':
      case 'adminmenu':
      case 'admin_menus':
        return AppResource.ADMIN_MENU
      case 'role':
      case 'roles':
        return AppResource.ROLE
      case 'setting':
      case 'settings':
        return AppResource.SETTINGS
      case 'data_pull_task':
      case 'data_pull_tasks':
      case 'datapulltask':
      case 'datapulltasks':
      case 'data_sync_task':
      case 'datasynctask':
        return AppResource.DATA_PULL_TASK
      case 'strategy_template':
      case 'strategytemplate':
      case 'strategy_templates':
      case 'strategytemplates':
        return AppResource.STRATEGY_TEMPLATE
      case 'orderbook_config':
      case 'orderbookconfig':
      case 'orderbook_configs':
      case 'orderbookconfigs':
      case 'orderbook':
      case 'orderbooks':
        return AppResource.ORDERBOOK_CONFIG
      case 'beta_code':
      case 'betacode':
      case 'beta_codes':
      case 'betacodes':
      case 'beta_access_code':
      case 'betaaccesscode':
      case 'beta_access_codes':
      case 'betaaccesscodes':
        return AppResource.BETA_CODE
      default:
        return null
    }
  }
}

interface ParsedPermission {
  resource: AppResource
  actions: Set<PermissionAction>
}
