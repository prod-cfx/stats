/* eslint-disable ts/consistent-type-imports -- NestJS 装饰器需要运行时导入以保留类型元数据 */
import { Controller, Get, Param, Query } from '@nestjs/common'
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'

import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'

import { LiveStrategyInstanceListQueryDto } from '../dto/live-strategy-instance-list-query.dto'
import { StrategyInstancePublicResponseDto } from '../dto/live-strategy-instance-response.dto'
import { StrategyInstanceSignalPublicResponseDto } from '../dto/strategy-instance-signal-public-response.dto'
import { StrategyInstanceSignalsListQueryDto } from '../dto/strategy-instance-signals-list-query.dto'
import { StrategyInstancesService } from '../services/strategy-instances.service'

@ApiTags('strategy-instances')
@ApiExtraModels(BasePaginationResponseDto, StrategyInstancePublicResponseDto, StrategyInstanceSignalPublicResponseDto)
@Controller('strategy-instances')
export class LiveStrategyInstancesController {
  constructor(
    private readonly instancesService: StrategyInstancesService,
  ) {}

  @Get()
  @ApiOperation({ summary: '获取运行中的策略实例列表（公开）' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(StrategyInstancePublicResponseDto) },
            },
          },
        },
      ],
    },
  })
  async list(
    @Query() query: LiveStrategyInstanceListQueryDto,
  ): Promise<BasePaginationResponseDto<StrategyInstancePublicResponseDto>> {
    return this.instancesService.listRunningInstances(query, query.userId)
  }

  @Get(':id')
  @ApiOperation({ summary: '获取运行中的策略实例详情（公开）' })
  @ApiResponse({ status: 200, type: StrategyInstancePublicResponseDto })
  async detail(
    @Param('id') id: string,
    @Query('userId') userId?: string,
  ): Promise<StrategyInstancePublicResponseDto> {
    return this.instancesService.getRunningInstanceDetail(id, userId)
  }

  @Get(':id/signals')
  @ApiOperation({ summary: '获取指定策略实例的信号记录（最近行为回放）' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(StrategyInstanceSignalPublicResponseDto) },
            },
          },
        },
      ],
    },
  })
  async listSignals(
    @Param('id') id: string,
    @Query() query: StrategyInstanceSignalsListQueryDto,
  ): Promise<BasePaginationResponseDto<StrategyInstanceSignalPublicResponseDto>> {
    return this.instancesService.getRunningInstanceSignals(id, query, query.userId)
  }
}
