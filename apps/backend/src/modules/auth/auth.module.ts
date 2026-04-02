import type { JwtSignOptions } from '@nestjs/jwt'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { seconds, ThrottlerModule } from '@nestjs/throttler'
import { AccessControlModule } from 'nest-access-control'
import { MailService } from '@/common/services/mail.service'
import { RedisService } from '@/common/services/redis.service'
import { PrismaModule } from '@/prisma/prisma.module'
import { AuthController } from './auth.controller'
import { ACGuard } from './guards/ac.guard'
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard'
import { ThrottlerRedisStorage } from './guards/throttler-redis-storage'
import { RBAC_PERMISSIONS } from './rbac/permissions'
import { RoleAssignmentRepository } from './repositories/role-assignment.repository'
import { UserAuthRepository } from './repositories/user-auth.repository'
import { AuditLogService } from './services/audit-log.service'
import { PermissionCacheService } from './services/permission-cache.service'
import { PermissionService } from './services/permission.service'
import { UserAuthService } from './services/user-auth.service'
import { JwtStrategy } from './strategies/jwt.strategy'

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    PassportModule.register({ defaultStrategy: 'jwt', property: 'user', session: false }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: config.get<string>('jwt.expiresIn', '30d') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
    ThrottlerModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redisService: RedisService) => ({
        throttlers: [
          {
            ttl: seconds(60), // 60 秒窗口
            limit: 20, // 20 次请求
          },
        ],
        storage: new ThrottlerRedisStorage(redisService),
      }),
    }),
    AccessControlModule.forRoles(RBAC_PERMISSIONS),
  ],
  controllers: [AuthController],
  providers: [
    JwtStrategy,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    ACGuard,
    AuthRateLimitGuard,
    RoleAssignmentRepository,
    UserAuthRepository,
    PermissionService,
    PermissionCacheService,
    AuditLogService,
    UserAuthService,
    MailService,
  ],
  exports: [
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    ACGuard,
    AuthRateLimitGuard,
    PermissionService,
    AuditLogService,
    AccessControlModule,
    JwtModule,
    PassportModule,
  ],
})
export class AuthModule {}
