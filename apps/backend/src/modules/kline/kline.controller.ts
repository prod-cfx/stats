import { Controller, Get, Query } from '@nestjs/common'
import { ApiExtraModels, ApiOperation, ApiResponse, ApiTags, getSchemaPath } from '@nestjs/swagger'
// KlineBarDto 需要运行时类构造函数，用于 Swagger 推导，保留值导入
 
import { RequireAuth } from '@/modules/auth/decorators/access-control.decorator'
import { KlineBarDto } from './dto/kline-bar.dto'
// QueryKlineDto 需要运行时类构造函数，用于 class-validator 校验和 Swagger 推导，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { QueryKlineDto } from './dto/query-kline.dto'
// Nest 注入需要运行时引用 KlineService，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { KlineService } from './kline.service'

@ApiTags('kline')
@Controller('kline')
@RequireAuth()
@ApiExtraModels(KlineBarDto)
export class KlineController {
  constructor(private readonly service: KlineService) {}

  @Get()
  @ApiOperation({
    summary: '获取 K 线数据',
    description: '查询期货价格历史 OHLC 数据，支持单交易所或聚合模式',
  })
  @ApiResponse({
    status: 200,
    description: '成功获取 K 线数据',
    schema: {
      type: 'array',
      items: { $ref: getSchemaPath(KlineBarDto) },
    },
  })
  async getKlineBars(@Query() query: QueryKlineDto): Promise<KlineBarDto[]> {
    return this.service.getKlineBars({
      symbol: query.symbol,
      interval: query.interval,
      from: query.from,
      to: query.to,
      exchange: query.exchange,
    })
  }
}
