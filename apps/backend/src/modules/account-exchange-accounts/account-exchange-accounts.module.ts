import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { AccountExchangeAccountsController } from './account-exchange-accounts.controller'
import { AccountExchangeAccountsService } from './account-exchange-accounts.service'
import { QuantifyExchangeAccountsClient } from './clients/quantify-exchange-accounts.client'

@Module({
  imports: [AuthModule],
  controllers: [AccountExchangeAccountsController],
  providers: [AccountExchangeAccountsService, QuantifyExchangeAccountsClient],
  exports: [AccountExchangeAccountsService],
})
export class AccountExchangeAccountsModule {}
