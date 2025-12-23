import { Inject, Injectable } from '@nestjs/common'
// Nest 注入需要运行时引用 CacheService，保留值导入
 
import { CacheService } from '@/common/services/cache.service'

@Injectable()
export class PermissionCacheService {
  private readonly prefix = 'rbac:user-roles:'
  // 暂时禁用缓存以确保实时撤权（待实现角色变更时的 invalidate 调用后可恢复）
  // TODO: 在 RoleAssignment CRUD 操作中调用 invalidate() 后，改为 300
  private readonly ttlSec = 0

  constructor(@Inject(CacheService) private readonly cache: CacheService) {}

  private buildKey(userId: string, principalType: 'user' | 'admin'): string {
    return `${this.prefix}${principalType}:${userId}`
  }

  async get(userId: string, principalType: 'user' | 'admin'): Promise<string[] | undefined> {
    return this.cache.get<string[]>(this.buildKey(userId, principalType))
  }

  async set(userId: string, principalType: 'user' | 'admin', roles: string[]): Promise<void> {
    await this.cache.set(this.buildKey(userId, principalType), roles, this.ttlSec)
  }

  async invalidate(userId: string, principalType: 'user' | 'admin'): Promise<void> {
    await this.cache.del(this.buildKey(userId, principalType))
  }
}

