import { Module } from '@nestjs/common'

import { PrismaModule } from '@/prisma/prisma.module'

import { TradingModule } from '../trading/trading.module'
import { ExchangeAccountsController } from './exchange-accounts.controller'
import { ExchangeAccountsService } from './exchange-accounts.service'

@Module({
  imports: [PrismaModule, TradingModule],
  controllers: [ExchangeAccountsController],
  providers: [ExchangeAccountsService],
})
export class ExchangeAccountsModule {}
