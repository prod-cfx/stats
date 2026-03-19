import { Injectable } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

/**
 * 认证接口限流守卫
 * 基于 Redis 存储，支持分布式部署
 * 默认配置：20 次/分钟/IP
 */
@Injectable()
export class AuthRateLimitGuard extends ThrottlerGuard {}
