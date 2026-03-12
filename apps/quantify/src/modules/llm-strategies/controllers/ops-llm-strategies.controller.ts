import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import {
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'

import { BaseResponseDto } from '@/common/dto/base.dto'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'

import { CreateLlmStrategyDto } from '../dto/create-llm-strategy.dto'
import { LlmStrategyListQueryDto } from '../dto/llm-strategy-list.query.dto'
import { LlmStrategyResponseDto } from '../dto/llm-strategy.response.dto'
import { UpdateLlmStrategyDto } from '../dto/update-llm-strategy.dto'
// eslint-disable-next-line ts/consistent-type-imports -- 闇€瑕佺敤浜庝緷璧栨敞鍏ワ紝涓嶈兘浣跨敤 import type
import { LlmStrategiesService } from '../services/llm-strategies.service'

@ApiTags('ops-llm-strategies')
@Controller('ops/llm-strategies')
@ApiExtraModels(
  BaseResponseDto,
  BasePaginationResponseDto,
  LlmStrategyResponseDto,
  LlmStrategyListQueryDto,
  CreateLlmStrategyDto,
  UpdateLlmStrategyDto,
)
export class OpsLlmStrategiesController {
  constructor(private readonly llmStrategiesService: LlmStrategiesService) {}

  @Get()
  @ApiOperation({ summary: '鍒嗛〉鏌ヨLLM绛栫暐' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: '椤电爜锛堜粠 1 寮€濮嬶級',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '姣忛〉鏁伴噺',
    example: 20,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['draft', 'live', 'archived'],
    description: '鎸夌瓥鐣ョ姸鎬佺瓫閫?,
  })
  @ApiQuery({
    name: 'keyword',
    required: false,
    type: String,
    description: '鍚嶇О鎴栨弿杩板叧閿瘝妯＄硦鎼滅储',
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    type: String,
    description: '鑷畾涔夋帓搴忓瓧娈碉紝渚嬪 createdAt:desc',
  })
  @ApiOkResponse({
    description: '鑾峰彇鎴愬姛',
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(LlmStrategyResponseDto) },
            },
          },
        },
      ],
    },
  })
  async list(
    @Query() query: LlmStrategyListQueryDto,
  ) {
    const result = await this.llmStrategiesService.list(query)
    return {
      ...result,
      items: result.items.map(item => new LlmStrategyResponseDto(item)),
    }
  }

  @Get(':id')
  @ApiOperation({ summary: '鑾峰彇LLM绛栫暐璇︽儏' })
  @ApiOkResponse({ description: '鑾峰彇鎴愬姛', type: LlmStrategyResponseDto })
  async detail(
    @Param('id') id: string,
  ) {
    const strategy = await this.llmStrategiesService.getDetail(id)
    return new LlmStrategyResponseDto(strategy)
  }

  @Post()
  @ApiOperation({ summary: '鍒涘缓LLM绛栫暐' })
  @ApiBody({ description: '鍒涘缓LLM绛栫暐璇锋眰浣?, type: CreateLlmStrategyDto })
  @ApiOkResponse({ description: '鍒涘缓鎴愬姛', type: LlmStrategyResponseDto })
  async create(
    @Body() body: CreateLlmStrategyDto,
  ) {
    const strategy = await this.llmStrategiesService.create(body, body.createdBy ?? 'system')
    return new LlmStrategyResponseDto(strategy)
  }

  @Put(':id')
  @ApiOperation({ summary: '鏇存柊LLM绛栫暐' })
  @ApiBody({ description: '鏇存柊LLM绛栫暐璇锋眰浣?, type: UpdateLlmStrategyDto })
  @ApiOkResponse({ description: '鏇存柊鎴愬姛', type: LlmStrategyResponseDto })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateLlmStrategyDto,
  ) {
    const strategy = await this.llmStrategiesService.update(id, body, body.updatedBy ?? 'system')
    return new LlmStrategyResponseDto(strategy)
  }

  @Delete(':id')
  @ApiOperation({ summary: '鍒犻櫎LLM绛栫暐' })
  async delete(
    @Param('id') id: string,
  ) {
    await this.llmStrategiesService.delete(id)
    return { success: true }
  }
}
