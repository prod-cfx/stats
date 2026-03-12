/* eslint-disable ts/consistent-type-imports -- NestJS 瑁呴グ鍣ㄩ渶瑕佽繍琛屾椂瀵煎叆浠ヤ繚鐣欑被鍨嬪厓鏁版嵁 */
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
  @ApiOperation({ summary: '鑾峰彇杩愯涓殑绛栫暐瀹炰緥鍒楄〃锛堝叕寮€锛? })
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
  @ApiOperation({ summary: '鑾峰彇杩愯涓殑绛栫暐瀹炰緥璇︽儏锛堝叕寮€锛? })
  @ApiResponse({ status: 200, type: StrategyInstancePublicResponseDto })
  async detail(
    @Param('id') id: string,
    @Query('userId') userId?: string,
  ): Promise<StrategyInstancePublicResponseDto> {
    return this.instancesService.getRunningInstanceDetail(id, userId)
  }

  @Get(':id/signals')
  @ApiOperation({ summary: '鑾峰彇鎸囧畾绛栫暐瀹炰緥鐨勪俊鍙疯褰曪紙鏈€杩戣涓哄洖鏀撅級' })
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
