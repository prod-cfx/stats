import { Module } from '@nestjs/common'
import { CacheModule } from '@/common/modules/cache.module'
import { AuthModule } from '@/modules/auth/auth.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { AdminSettingsController } from './controllers/admin-settings.controller'
import { SettingsRepository } from './repositories/settings.repository'
import { SettingsService } from './services/settings.service'

@Module({
  imports: [PrismaModule, CacheModule, AuthModule],
  controllers: [AdminSettingsController],
  providers: [SettingsService, SettingsRepository],
  exports: [SettingsService],
})
export class SettingsModule {}

