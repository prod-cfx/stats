/* eslint-disable ts/consistent-type-imports -- NestJS 装饰器需要运行时导入以保留类型元数据 */
import { Controller, Get, Param, Query } from '@nestjs/common'
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'

import { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'
import { TradingSignalResponseDto } from '@/modules/strategy-signals/dto/trading-signal-response.dto'

import { LiveLlmStrategyInstanceListQueryDto } from '../dto/live-llm-strategy-instance-list-query.dto'
import { LlmStrategyInstancePublicResponseDto } from '../dto/live-llm-strategy-instance-response.dto'
import { LiveLlmStrategySignalsQueryDto } from '../dto/live-llm-strategy-signals-query.dto'
import { LiveLlmStrategyInstancesService } from '../services/live-llm-strategy-instances.service'

@ApiTags('llm-strategy-instances')
@ApiExtraModels(BasePaginationResponseDto, LlmStrategyInstancePublicResponseDto, TradingSignalResponseDto)
@Controller('llm-strategy-instances')
export class LiveLlmStrategyInstancesController {
  constructor(
    private readonly service: LiveLlmStrategyInstancesService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取运行中的 LLM 策略实例列表（公开）' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(LlmStrategyInstancePublicResponseDto) },
            },
          },
        },
      ],
    },
  })
  async list(
    @Query() query: LiveLlmStrategyInstanceListQueryDto,
  ): Promise<BasePaginationResponseDto<LlmStrategyInstancePublicResponseDto>> {
    return this.service.listRunningInstances(query, query.userId)
  }

  @Get(':id')
  @ApiOperation({ summary: '获取运行中的 LLM 策略实例详情（公开）' })
  @ApiQuery({ name: 'userId', required: false, type: String })
  @ApiResponse({ status: 200, type: LlmStrategyInstancePublicResponseDto })
  async detail(
    @Param('id') id: string,
    @Query('userId') userId?: string,
  ): Promise<LlmStrategyInstancePublicResponseDto> {
    return this.service.getRunningInstanceDetail(id, userId)
  }

  @Get(':id/signals')
  @ApiOperation({ summary: '获取指定 LLM 策略实例的信号记录' })
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
  async listSignals(
    @Param('id') id: string,
    @Query() query: LiveLlmStrategySignalsQueryDto,
  ): Promise<BasePaginationResponseDto<TradingSignalResponseDto>> {
    return this.service.getRunningInstanceSignals(id, query, query.userId)
  }
}
