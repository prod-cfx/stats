import type { TradingSignalListQueryDto } from '../dto/trading-signal-list-query.dto'
import { Controller, Get, Query } from '@nestjs/common'
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger'

import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { TradingSignalResponseDto } from '../dto/trading-signal-response.dto'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时注入实例
import { OpsTradingSignalsService } from '../services/ops-trading-signals.service'

@ApiTags('ops/trading-signals')
@ApiExtraModels(BasePaginationResponseDto, TradingSignalResponseDto)
@Controller('ops/trading-signals')
export class OpsTradingSignalsController {
  constructor(
    private readonly opsTradingSignalsService: OpsTradingSignalsService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取信号记录列表' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(TradingSignalResponseDto) },
            },
          },
        },
      ],
    },
  })
  async list(
    @Query() query: TradingSignalListQueryDto,
  ): Promise<BasePaginationResponseDto<TradingSignalResponseDto>> {
    const result = await this.opsTradingSignalsService.findMany({
      strategyInstanceId: query.strategyInstanceId,
      strategyId: query.strategyId,
      llmStrategyId: query.llmStrategyId,
      llmStrategyInstanceId: query.llmStrategyInstanceId,
      symbolId: query.symbolId,
      status: query.status,
      page: query.page || 1,
      limit: query.limit || 20,
    })

    const items = result.items.map(item => new TradingSignalResponseDto(item))

    return new BasePaginationResponseDto(
      result.total,
      query.page || 1,
      query.limit || 20,
      items,
    )
  }
}
