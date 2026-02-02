// DTO 必须使用值导入以保留运行时类型元数据，供 ValidationPipe 和 Swagger 使用
/* eslint-disable perfectionist/sort-imports -- NestJS 控制器按语义分组导入 DTO 与 Service，避免自动排序影响可读性与元数据推断 */

// DTO 必须使用值导入以保留运行时类型元数据，供 ValidationPipe 和 Swagger 使用
// eslint-disable-next-line ts/consistent-type-imports
import { QueryRealtimeWhaleAlertDto, RealtimeWhaleAlertDto } from './dto/realtime-whale-alert.dto'
// eslint-disable-next-line ts/consistent-type-imports
import { QueryWhaleTradeDto, WhaleTradeDto } from './dto/whale-trade.dto'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import { OptionalAccessControl, ReadAny } from '@/modules/auth/decorators/access-control.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
// eslint-disable-next-line ts/consistent-type-imports
import { WhaleAlertService } from './whale-alert.service'

@ApiTags('whale-alerts')
@ApiBearerAuth('bearer')
@Controller('whale-alerts')
export class WhaleAlertController {
  constructor(private readonly service: WhaleAlertService) {}

  @Get('realtime')
  @OptionalAccessControl()
  @ReadAny(AppResource.MARKET_SYMBOL)
  @ApiOperation({ summary: '获取 Hyperliquid 鲸鱼持仓预警实时列表' })
  @ApiQuery({
    name: 'symbol',
    required: false,
    description: '币种符号，例如 BTC / ETH',
  })
  @ApiQuery({
    name: 'min_position_value_usd',
    required: false,
    description: '最小持仓名义价值（USD），默认 1_000',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '返回记录上限，默认 50，最大 200',
  })
  @ApiQuery({
    name: 'since',
    required: false,
    description: '仅返回该时间之后的记录（ISO 时间字符串），默认过去 24 小时',
  })
  @ApiOkResponse({ type: RealtimeWhaleAlertDto, isArray: true })
  async getRealtime(@Query() query: QueryRealtimeWhaleAlertDto): Promise<RealtimeWhaleAlertDto[]> {
    const result = await this.service.getRealtimeAlerts(query)
    return result
  }

  @Get('trades')
  @OptionalAccessControl()
  @ReadAny(AppResource.MARKET_SYMBOL)
  @ApiOperation({ summary: '获取 Hyperliquid 鲸鱼交易实时列表' })
  @ApiQuery({
    name: 'symbol',
    required: false,
    description: '币种符号，例如 BTC / ETH',
  })
  @ApiQuery({
    name: 'min_trade_value_usd',
    required: false,
    description: '最小交易价值（USD），默认 1_000',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '返回记录上限，默认 50，最大 200',
  })
  @ApiQuery({
    name: 'since',
    required: false,
    description: '仅返回该时间之后的记录（ISO 时间字符串），默认过去 24 小时',
  })
  @ApiOkResponse({ type: WhaleTradeDto, isArray: true })
  async getWhaleTrades(@Query() query: QueryWhaleTradeDto): Promise<WhaleTradeDto[]> {
    const result = await this.service.getWhaleTrades(query)
    return result
  }
}
