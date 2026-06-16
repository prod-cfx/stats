import { Module } from '@nestjs/common'
import { CacheModule } from '@/common/modules/cache.module'
import { AuthAccessModule } from '@/modules/auth/auth-access.module'
import { AdminSettingsController } from './controllers/admin-settings.controller'
import { SettingsRepository } from './repositories/settings.repository'
import { SettingsService } from './services/settings.service'

@Module({
  imports: [CacheModule, AuthAccessModule],
  controllers: [AdminSettingsController],
  providers: [SettingsService, SettingsRepository],
  exports: [SettingsService],
})
export class SettingsModule {}
