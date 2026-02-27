import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { OptionalAccessControl, ReadAny } from '@/modules/auth/decorators/access-control.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
// DTO 必须使用值导入以保留运行时类型元数据，供 ValidationPipe 和 Swagger 使用
// eslint-disable-next-line ts/consistent-type-imports
import { GetPolymarketMarketsRequestDto } from './dto/requests/get-polymarket-markets.request.dto'
import { PredictionMarketCardDto } from './dto/responses/prediction-market.response.dto'
// Nest 注入需要运行时引用 PolymarketService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { PolymarketService } from './polymarket.service'

@ApiTags('polymarket')
@ApiBearerAuth('bearer')
@Controller('polymarket')
export class PolymarketController {
  constructor(private readonly polymarketService: PolymarketService) {}

  @Get('markets')
  @OptionalAccessControl()
  @ReadAny(AppResource.PREDICTION_MARKET)
  @ApiOperation({ summary: '获取 Polymarket 预测市场列表' })
  @ApiOkResponse({ type: PredictionMarketCardDto, isArray: true })
  listMarkets(@Query() query: GetPolymarketMarketsRequestDto): Promise<PredictionMarketCardDto[]> {
    const page = query.page ?? 1
    const limit = query.limit ?? 50
    const offset = (page - 1) * limit

    return this.polymarketService.listPredictionMarkets({
      category: query.category,
      onlyActive: query.onlyActive ?? true,
      offset,
      limit,
      locale: query.locale,
    })
  }
}






