// DTO 必须使用值导入以保留运行时类型元数据，供 ValidationPipe 和 Swagger 使用
/* eslint-disable perfectionist/sort-imports -- NestJS 控制器按语义分组导入 DTO 与 Service，避免自动排序影响可读性与元数据推断 */

// DTO 必须使用值导入以保留运行时类型元数据，供 ValidationPipe 和 Swagger 使用
// eslint-disable-next-line ts/consistent-type-imports
import { GetLiquidationHeatmapRequestDto } from './dto/requests/get-liquidation-heatmap.request.dto'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { ReadAny, RequireAuth } from '@/modules/auth/decorators/access-control.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
import { LiquidationHeatmapResponseDto } from './dto/responses/liquidation-heatmap.response.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { LiquidationHeatmapService } from './liquidation-heatmap.service'

@ApiTags('liquidation-heatmap')
@ApiBearerAuth('bearer')
@Controller('liquidation-heatmap')
export class LiquidationHeatmapController {
  constructor(private readonly service: LiquidationHeatmapService) {}

  @Get('latest')
  @RequireAuth()
  @ReadAny(AppResource.MARKET_SYMBOL)
  @ApiQuery({
    name: 'symbol',
    required: true,
    description: '基础交易标的，例如 BTC',
  })
  @ApiQuery({
    name: 'exchangeCode',
    required: false,
    description: '交易所代码，例如 BINANCE、OKX',
  })
  @ApiQuery({
    name: 'contractType',
    required: false,
    description: '合约类型，例如 PERPETUAL',
  })
  @ApiQuery({
    name: 'timeInterval',
    required: false,
    description: '时间区间/粒度，例如 15m、1h（默认 15m）',
  })
  @ApiQuery({
    name: 'modelType',
    required: false,
    enum: ['MODEL1', 'MODEL2', 'MODEL3'],
    description: 'Coinglass 热力图模型类型',
  })
  @ApiOperation({ summary: '获取最新的清算热力图快照（单交易对）' })
  @ApiOkResponse({ type: LiquidationHeatmapResponseDto })
  async getLatest(@Query() query: GetLiquidationHeatmapRequestDto): Promise<LiquidationHeatmapResponseDto> {
    const result = await this.service.getLatestHeatmap({
      symbol: query.symbol,
      exchangeCode: query.exchangeCode === '' ? null : query.exchangeCode,
      contractType: query.contractType === '' ? null : query.contractType,
      timeInterval: query.timeInterval,
      modelType: query.modelType ?? 'MODEL3',
    })

    return result
  }
}


