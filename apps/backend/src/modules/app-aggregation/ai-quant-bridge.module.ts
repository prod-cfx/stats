import { Module } from '@nestjs/common'
import { AccountExchangeAccountsModule } from '../account-exchange-accounts/account-exchange-accounts.module'
import { AiQuantProxyModule } from '../ai-quant-proxy/ai-quant-proxy.module'

@Module({
  imports: [
    AccountExchangeAccountsModule,
    AiQuantProxyModule,
  ],
})
export class AiQuantBridgeModule {}
