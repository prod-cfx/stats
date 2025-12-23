import type { AppResource } from '../rbac/permissions'
import type { RequiredRule } from '../services/permission.service'
import { applyDecorators, SetMetadata, UseGuards } from '@nestjs/common'
import { ACGuard } from '../guards/ac.guard'
import { JwtAuthGuard } from '../guards/jwt-auth.guard'
import 'reflect-metadata'

const ROLES_METADATA_KEY = 'roles'

/**
 * 仅应用 JWT 认证守卫（不包含权限检查）
 */
export const Auth = () => applyDecorators(UseGuards(JwtAuthGuard))

/**
 * 应用认证和权限检查守卫（推荐：单独使用一次，避免重复）
 * 用法：@RequireAuth() + @ReadOwn() + @ReadAny()
 */
export const RequireAuth = () => applyDecorators(UseGuards(JwtAuthGuard, ACGuard))

/**
 * 累加规则而非覆盖：读取已有的 roles metadata，追加新规则
 */
function addRule(newRule: RequiredRule): MethodDecorator & ClassDecorator {
  return (target: any, propertyKey?: string | symbol, descriptor?: PropertyDescriptor) => {
    const targetToDecorate = descriptor ? descriptor.value : target
    const existingRoles = Reflect.getMetadata(ROLES_METADATA_KEY, targetToDecorate) || []
    const updatedRoles = [...existingRoles, newRule]
    Reflect.defineMetadata(ROLES_METADATA_KEY, updatedRoles, targetToDecorate)
  }
}

/**
 * 权限装饰器：仅追加 metadata，不应用守卫（避免重复执行）
 * 必须配合 @RequireAuth() 或 @AccessControl() 使用
 */
const rule = (action: string, resource: AppResource, possession: 'own' | 'any') =>
  addRule({ action, resource, possession })

export const ReadOwn = (resource: AppResource) => rule('read', resource, 'own')
export const CreateOwn = (resource: AppResource) => rule('create', resource, 'own')
export const UpdateOwn = (resource: AppResource) => rule('update', resource, 'own')
export const DeleteOwn = (resource: AppResource) => rule('delete', resource, 'own')

export const ReadAny = (resource: AppResource) => rule('read', resource, 'any')
export const CreateAny = (resource: AppResource) => rule('create', resource, 'any')
export const UpdateAny = (resource: AppResource) => rule('update', resource, 'any')
export const DeleteAny = (resource: AppResource) => rule('delete', resource, 'any')

/**
 * 组合装饰器：设置权限规则并应用守卫
 * 用法：@AccessControl({ action: 'read', resource: 'settings', possession: 'any' })
 */
export const AccessControl = (...rules: RequiredRule[]) =>
  applyDecorators(SetMetadata(ROLES_METADATA_KEY, rules), UseGuards(JwtAuthGuard, ACGuard))


