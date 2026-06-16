import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { RateLimitModule } from '@/common/modules/rate-limit.module'
import { MailService } from '@/common/services/mail.service'
import { BetaCodeModule } from '@/modules/beta-code/beta-code.module'
import { AuthAccessModule } from './auth-access.module'
import { AuthController } from './auth.controller'
import { AuthRateLimitGuard } from './guards/auth-rate-limit.guard'
import { UserAuthRepository } from './repositories/user-auth.repository'
import { UserAuthService } from './services/user-auth.service'
import { VerificationCodeService } from './services/verification-code.service'

@Module({
  imports: [
    ConfigModule,
    AuthAccessModule,
    RateLimitModule,
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
