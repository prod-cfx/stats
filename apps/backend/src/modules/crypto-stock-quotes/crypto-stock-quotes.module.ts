import { Module } from '@nestjs/common'
import { PrismaModule } from '@/prisma/prisma.module'
import { CryptoStockQuotesRepository } from './crypto-stock-quotes.repository'

/**
 * 加密股票报价模块
 * 
 * 功能：
 * - 提供加密货币相关股票的报价数据仓储服务
 * - 支持从多个数据源（如 BBX）获取数据
 */
@Module({
  imports: [PrismaModule],
  providers: [CryptoStockQuotesRepository],
  exports: [CryptoStockQuotesRepository],
})
export class CryptoStockQuotesModule {}

