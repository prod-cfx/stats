import { Module } from '@nestjs/common'

import { PrismaModule } from '@/prisma/prisma.module'

import { TradingModule } from '../trading/trading.module'
import { ExchangeAccountsController } from './exchange-accounts.controller'
import { ExchangeAccountsService } from './exchange-accounts.service'
import { ExchangeAccountRepository } from './repositories/exchange-account.repository'

@Module({
  imports: [PrismaModule, TradingModule],
  controllers: [ExchangeAccountsController],
  providers: [ExchangeAccountsService, ExchangeAccountRepository],
})
export class ExchangeAccountsModule {}
