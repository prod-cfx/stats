import type { GetLiquidationHeatmapRequestDto } from './dto/requests/get-liquidation-heatmap.request.dto'
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
      exchangeCode: query.exchangeCode,
      contractType: query.contractType,
      modelType: query.modelType ?? 'MODEL3',
    })

    return result
  }
}


