import { Module } from '@nestjs/common'
import { CacheModule } from '@/common/modules/cache.module'
import { PrismaModule } from '@/prisma/prisma.module'
import { OpsSettingsController } from './controllers/ops-settings.controller'
import { SettingsRepository } from './repositories/settings.repository'
import { SettingsService } from './services/settings.service'

@Module({
  imports: [PrismaModule, CacheModule],
  controllers: [OpsSettingsController],
  providers: [SettingsService, SettingsRepository],
  exports: [SettingsService],
})
export class SettingsModule {}
