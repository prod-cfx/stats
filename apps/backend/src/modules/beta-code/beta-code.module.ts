import { forwardRef, Module } from '@nestjs/common'
import { AuthModule } from '@/modules/auth/auth.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { AdminBetaCodeController } from './controllers/admin-beta-code.controller'
import { BetaAccessCodeRepository } from './repositories/beta-code.repository'
import { BetaCodeService } from './services/beta-code.service'

@Module({
  imports: [PrismaModule, forwardRef(() => AuthModule)],
  controllers: [AdminBetaCodeController],
  providers: [BetaAccessCodeRepository, BetaCodeService],
  exports: [BetaCodeService],
})
export class BetaCodeModule {}
