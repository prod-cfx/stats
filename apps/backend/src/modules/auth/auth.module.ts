import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { seconds, ThrottlerModule } from '@nestjs/throttler'
import { MailService } from '@/common/services/mail.service'
import { RedisService } from '@/common/services/redis.service'
import { BetaCodeModule } from '@/modules/beta-code/beta-code.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { AuthAccessModule } from './auth-access.module'
import { AuthController } from './auth.controller'
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard'
import { ThrottlerRedisStorage } from './guards/throttler-redis-storage'
import { UserAuthRepository } from './repositories/user-auth.repository'
import { UserAuthService } from './services/user-auth.service'
import { VerificationCodeService } from './services/verification-code.service'

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthAccessModule,
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
    BetaCodeModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthRateLimitGuard,
    UserAuthRepository,
    UserAuthService,
    VerificationCodeService,
    MailService,
  ],
  exports: [
    AuthAccessModule,
    AuthRateLimitGuard,
  ],
})
export class AuthModule {}
