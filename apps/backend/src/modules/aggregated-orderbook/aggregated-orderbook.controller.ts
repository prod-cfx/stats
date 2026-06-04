import { Controller, Get, Query } from '@nestjs/common'
import { ApiExtraModels, ApiOperation, ApiResponse, ApiTags, getSchemaPath } from '@nestjs/swagger'
// Nest 注入需要运行时引用，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { AggregatedOrderbookService } from './aggregated-orderbook.service'
import { AggregatedOrderbookMarketResponseDto } from './dto/aggregated-orderbook-market.response.dto'
import { AggregatedOrderbookResponseDto } from './dto/aggregated-orderbook.response.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { QueryAggregatedOrderbookDto } from './dto/query-aggregated-orderbook.dto'

@ApiTags('orderbook')
@Controller('orderbook')
@ApiExtraModels(AggregatedOrderbookMarketResponseDto, AggregatedOrderbookResponseDto)
export class AggregatedOrderbookController {
  constructor(private readonly service: AggregatedOrderbookService) {}

  @Get('aggregated/symbols')
  @ApiOperation({
    summary: '获取聚合订单簿可用币对',
    description: '基于启用的订单簿交易对配置返回可聚合的基础资产、市场类型和交易所列表',
  })
  @ApiResponse({
    status: 200,
    description: '成功获取可用币对',
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { $ref: getSchemaPath(AggregatedOrderbookMarketResponseDto) } },
        message: { type: 'string', example: 'Success' },
      },
    },
  })
  async getAvailableMarkets(): Promise<AggregatedOrderbookMarketResponseDto[]> {
    return this.service.getAvailableMarkets()
  }

  @Get('aggregated')
  @ApiOperation({
    summary: '获取聚合订单簿',
    description: '合并多个交易所的订单簿数据，USDT/USDC 计价会自动合并',
  })
  @ApiResponse({
    status: 200,
    description: '成功获取聚合订单簿',
    schema: {
      type: 'object',
      properties: {
        data: { $ref: getSchemaPath(AggregatedOrderbookResponseDto) },
        message: { type: 'string', example: 'Success' },
      },
    },
  })
  async getAggregatedOrderbook(
    @Query() query: QueryAggregatedOrderbookDto,
  ): Promise<AggregatedOrderbookResponseDto> {
    // 解析 venues 字符串为数组
    const venues = query.venues
      ? query.venues.split(',').map(v => v.trim().toLowerCase())
      : undefined

    return this.service.getAggregatedOrderbook({
      base: query.base,
      type: query.type,
      venues,
      depth: query.depth,
      tickSize: query.tickSize,
    })
  }
}
