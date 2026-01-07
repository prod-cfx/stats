import type {
  GetExchangeLiquidationQueryDto,
} from './dto/aggregated-liquidation.dto'
import {
  Controller,
  Get,
  HttpStatus,
  Query,
} from '@nestjs/common'
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiQuery, ApiResponse, ApiTags, getSchemaPath } from '@nestjs/swagger'
import { BaseResponseDto } from '@/common/dto/base.dto'
import { ReadAny, RequireAuth } from '@/modules/auth/decorators/access-control.decorator'
import { AppResource } from '@/modules/auth/rbac/permissions'
// Nest 注入需要运行时引用 Service，保留值导入
// eslint-disable-next-line ts/consistent-type-imports
import { AggregatedLiquidationService } from './aggregated-liquidation.service'
import {
  AggregatedLiquidationSummaryDto,
  ExchangeLiquidationResponseDto,
} from './dto/aggregated-liquidation.dto'

const baseResponseSchema = (dataSchema: Record<string, unknown>) => ({
  allOf: [
    { $ref: getSchemaPath(BaseResponseDto) },
    {
      properties: {
        data: dataSchema,
      },
    },
  ],
})

@ApiTags('聚合爆仓数据')
@ApiExtraModels(BaseResponseDto, AggregatedLiquidationSummaryDto, ExchangeLiquidationResponseDto)
@Controller('aggregated-liquidation')
export class AggregatedLiquidationController {
  constructor(private readonly service: AggregatedLiquidationService) {}

  @Get('summary')
  @ApiBearerAuth()
  @RequireAuth()
  @ReadAny(AppResource.MARKET_SYMBOL)
  @ApiOperation({
    summary: '获取聚合爆仓汇总数据（多时间区间）',
    description:
      '基于 AggregatedLiquidationHistory 表，对指定币种在 1h/4h/12h/24h 粒度下的最新爆仓数据进行聚合，用于前端顶部 summary 卡片。',
  })
  @ApiQuery({
    name: 'symbol',
    required: true,
    description: '币种基础资产，例如 BTC',
    example: 'BTC',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '查询成功',
    schema: baseResponseSchema({
      $ref: getSchemaPath(AggregatedLiquidationSummaryDto),
    }),
  })
  async getSummary(
    @Query('symbol') symbol: string,
  ): Promise<BaseResponseDto<AggregatedLiquidationSummaryDto>> {
    const data = await this.service.getSummary(symbol)
    return new BaseResponseDto(data)
  }

  @Get('exchanges')
  @ApiBearerAuth()
  @RequireAuth()
  @ReadAny(AppResource.MARKET_SYMBOL)
  @ApiOperation({
    summary: '获取按交易所拆分的聚合爆仓数据（单一时间区间）',
    description:
      '基于 AggregatedLiquidationHistory 表，对指定币种 + 时间区间，在最新时间点上按交易所拆分 long/short，并返回 TOTAL 汇总行和各交易所行，用于前端交易所表格。',
  })
  @ApiQuery({
    name: 'symbol',
    required: true,
    description: '币种基础资产，例如 BTC',
    example: 'BTC',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '查询成功',
    schema: baseResponseSchema({
      $ref: getSchemaPath(ExchangeLiquidationResponseDto),
    }),
  })
  async getExchanges(
    @Query() query: GetExchangeLiquidationQueryDto,
  ): Promise<BaseResponseDto<ExchangeLiquidationResponseDto>> {
    const data = await this.service.getExchangeBreakdown(query.symbol, query.timeframe)
    return new BaseResponseDto(data)
  }
}


