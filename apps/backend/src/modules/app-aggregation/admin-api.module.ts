import { Module } from '@nestjs/common'
import { AdminModule } from '../admin/admin.module'
import { AuthModule } from '../auth/auth.module'
import { BetaCodeModule } from '../beta-code/beta-code.module'
import { SettingsModule } from '../settings/settings.module'
import { UserModule } from '../user/user.module'

@Module({
  imports: [
    SettingsModule,
    UserModule,
    AuthModule,
    BetaCodeModule,
    AdminModule,
  ],
})
export class AdminApiModule {}
