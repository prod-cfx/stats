import type { JwtSignOptions } from '@nestjs/jwt'
import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { AccessControlModule } from 'nest-access-control'
import { CacheModule } from '@/common/modules/cache.module'
import { ACGuard } from './guards/ac.guard'
import { GlobalJwtAuthBoundaryGuard } from './guards/global-jwt-auth-boundary.guard'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard'
import { RBAC_PERMISSIONS } from './rbac/permissions'
import { RoleAssignmentRepository } from './repositories/role-assignment.repository'
import { UserAuthRepository } from './repositories/user-auth.repository'
import { AuditLogService } from './services/audit-log.service'
import { PermissionCacheService } from './services/permission-cache.service'
import { PermissionService } from './services/permission.service'
import { JwtStrategy } from './strategies/jwt.strategy'

@Module({
  imports: [
    ConfigModule,
    CacheModule,
    PassportModule.register({ defaultStrategy: 'jwt', property: 'user', session: false }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: config.get<string>('jwt.accessExpiresIn', '30m') as JwtSignOptions['expiresIn'],
        },
      }),
    }),
    AccessControlModule.forRoles(RBAC_PERMISSIONS),
  ],
  providers: [
    JwtStrategy,
    GlobalJwtAuthBoundaryGuard,
    JwtAuthGuard,
    OptionalJwtAuthGuard,
    ACGuard,
    UserAuthRepository,
    RoleAssignmentRepository,
    PermissionService,
    PermissionCacheService,
    AuditLogService,
  ],
  exports: [
    JwtAuthGuard,
    GlobalJwtAuthBoundaryGuard,
    OptionalJwtAuthGuard,
    ACGuard,
    PermissionService,
    AuditLogService,
    AccessControlModule,
    JwtModule,
    PassportModule,
  ],
})
export class AuthAccessModule {}
