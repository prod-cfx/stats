/* eslint-disable ts/consistent-type-imports -- NestJS 瑁呴グ鍣ㄩ渶瑕佽繍琛屾椂瀵煎叆浠ヤ繚鐣欑被鍨嬪厓鏁版嵁 */
import { Controller, Get, Inject, Query } from '@nestjs/common'
import { ApiExtraModels, ApiOkResponse, ApiOperation, ApiTags, getSchemaPath } from '@nestjs/swagger'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'

import { TradingSignalListQueryDto } from '../dto/trading-signal-list-query.dto'
import { TradingSignalResponseDto } from '../dto/trading-signal-response.dto'
import { TradingSignalRepository } from '../repositories/trading-signal.repository'

@ApiTags('ops/trading-signals')
@ApiExtraModels(BasePaginationResponseDto, TradingSignalResponseDto)
@Controller('ops/trading-signals')
export class OpsTradingSignalsController {
  constructor(
    @Inject(TradingSignalRepository)
    private readonly signalRepository: TradingSignalRepository,
  ) {}

  @Get()
  @ApiOperation({ summary: '鑾峰彇淇″彿璁板綍鍒楄〃' })
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
    const result = await this.signalRepository.findMany({
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
