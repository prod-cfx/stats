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

import { LiveLlmStrategyInstanceListQueryDto } from '../dto/live-llm-strategy-instance-list-query.dto'
import { LlmStrategyInstancePublicResponseDto } from '../dto/live-llm-strategy-instance-response.dto'
import { LiveLlmStrategySignalsQueryDto } from '../dto/live-llm-strategy-signals-query.dto'
import { LiveLlmStrategyInstancesService } from '../services/live-llm-strategy-instances.service'

@ApiTags('llm-strategy-instances')
@ApiExtraModels(BasePaginationResponseDto, LlmStrategyInstancePublicResponseDto)
@Controller('llm-strategy-instances')
export class LiveLlmStrategyInstancesController {
  constructor(
    private readonly service: LiveLlmStrategyInstancesService,
  ) {}

  @Get()
  @ApiOperation({ summary: '鑾峰彇杩愯涓殑 LLM 绛栫暐瀹炰緥鍒楄〃锛堝叕寮€锛? })
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
  @ApiOperation({ summary: '鑾峰彇杩愯涓殑 LLM 绛栫暐瀹炰緥璇︽儏锛堝叕寮€锛? })
  @ApiResponse({ status: 200, type: LlmStrategyInstancePublicResponseDto })
  async detail(
    @Param('id') id: string,
    @Query('userId') userId?: string,
  ): Promise<LlmStrategyInstancePublicResponseDto> {
    return this.service.getRunningInstanceDetail(id, userId)
  }

  @Get(':id/signals')
  @ApiOperation({ summary: '鑾峰彇鎸囧畾 LLM 绛栫暐瀹炰緥鐨勪俊鍙疯褰曪紙褰撳墠鍗犱綅杩斿洖绌哄垪琛級' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { type: 'object' },
            },
          },
        },
      ],
    },
  })
  async listSignals(
    @Param('id') id: string,
    @Query() query: LiveLlmStrategySignalsQueryDto,
  ): Promise<BasePaginationResponseDto<any>> {
    return this.service.getRunningInstanceSignals(id, query, query.userId)
  }
}
