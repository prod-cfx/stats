import { Module } from '@nestjs/common'
import { AuthAccessModule } from '@/modules/auth/auth-access.module'
import { SettingsModule } from '@/modules/settings/settings.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { AdminBetaCodeController } from './controllers/admin-beta-code.controller'
import { BetaAccessCodeRepository } from './repositories/beta-code.repository'
import { BetaCodeService } from './services/beta-code.service'

@Module({
  imports: [PrismaModule, SettingsModule, AuthAccessModule],
  controllers: [AdminBetaCodeController],
  providers: [BetaAccessCodeRepository, BetaCodeService],
  exports: [BetaCodeService],
})
export class BetaCodeModule {}
