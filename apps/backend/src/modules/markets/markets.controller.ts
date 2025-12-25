/* eslint-disable perfectionist/sort-imports -- NestJS 控制器按语义分组导入 DTO 与 Service，避免自动排序影响可读性与元数据推断 */

// DTO 必须使用值导入以保留运行时类型元数据，供 ValidationPipe 和 Swagger 使用
// eslint-disable-next-line ts/consistent-type-imports
import { GetTradingPairsRequestDto } from './dto/requests/get-trading-pairs.request.dto'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { ReadAny, RequireAuth } from '@/modules/auth/decorators/access-control.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
import { TradingPairConfigResponseDto } from './dto/responses/trading-pair.response.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { MarketsService } from './markets.service'

/* eslint-enable perfectionist/sort-imports */

@ApiTags('markets')
@ApiBearerAuth('bearer')
@Controller('markets')
export class MarketsController {
  constructor(private readonly marketsService: MarketsService) {}

  @Get('pairs')
  @RequireAuth()
  @ReadAny(AppResource.MARKET_SYMBOL)
  @ApiQuery({
    name: 'venueType',
    required: false,
    description: '交易 venue 类型',
  })
  @ApiQuery({
    name: 'instrumentType',
    required: false,
    description: '交易品种类型',
  })
  @ApiQuery({
    name: 'exchange',
    required: false,
    description: '交易所标识，仅对 CEX 生效',
  })
  @ApiOperation({ summary: '获取交易对配置列表' })
  @ApiOkResponse({ type: TradingPairConfigResponseDto, isArray: true })
  getTradingPairs(@Query() query: GetTradingPairsRequestDto): TradingPairConfigResponseDto[] {
    const pairs = this.marketsService.findAll({
      venueType: query.venueType,
      instrumentType: query.instrumentType,
      exchange: query.exchange,
    })

    return pairs.map(pair => ({
      id: pair.id,
      displaySymbol: pair.displaySymbol,
      symbol: pair.symbol,
      baseAsset: pair.baseAsset,
      quoteAsset: pair.quoteAsset,
      venueType: pair.venueType,
      instrumentType: pair.instrumentType,
      pricePrecision: pair.pricePrecision,
      quantityPrecision: pair.quantityPrecision,
      minNotional: pair.minNotional,
      minQuantity: pair.minQuantity,
      enabled: pair.enabled,
      exchange: pair.venueType === 'CEX' ? pair.exchange : undefined,
      exchangeSymbol: pair.venueType === 'CEX' ? pair.exchangeSymbol : undefined,
      maxLeverage: pair.venueType === 'CEX' ? pair.maxLeverage : undefined,
      contractSize: pair.venueType === 'CEX' ? pair.contractSize : undefined,
      chainId: pair.venueType === 'DEX' ? pair.chainId : undefined,
      baseTokenAddress: pair.venueType === 'DEX' ? pair.baseTokenAddress : undefined,
      quoteTokenAddress: pair.venueType === 'DEX' ? pair.quoteTokenAddress : undefined,
      routerAddress: pair.venueType === 'DEX' ? pair.routerAddress : undefined,
      poolAddress: pair.venueType === 'DEX' ? pair.poolAddress : undefined,
      dexName: pair.venueType === 'DEX' ? pair.dexName : undefined,
    }))
  }
}
