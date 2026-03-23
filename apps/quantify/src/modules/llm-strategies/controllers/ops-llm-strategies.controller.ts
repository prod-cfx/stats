import { Transactional } from '@nestjs-cls/transactional'
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
// eslint-disable-next-line ts/consistent-type-imports -- 需要用于依赖注入，不能使用 import type
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
  @ApiOperation({ summary: '分页查询LLM策略' })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: '页码（从 1 开始）',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: '每页数量',
    example: 20,
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: ['draft', 'live', 'archived'],
    description: '按策略状态筛选',
  })
  @ApiQuery({
    name: 'keyword',
    required: false,
    type: String,
    description: '名称或描述关键词模糊搜索',
  })
  @ApiQuery({
    name: 'orderBy',
    required: false,
    type: String,
    description: '自定义排序字段，例如 createdAt:desc',
  })
  @ApiOkResponse({
    description: '获取成功',
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
  @ApiOperation({ summary: '获取LLM策略详情' })
  @ApiOkResponse({ description: '获取成功', type: LlmStrategyResponseDto })
  async detail(
    @Param('id') id: string,
  ) {
    const strategy = await this.llmStrategiesService.getDetail(id)
    return new LlmStrategyResponseDto(strategy)
  }

  @Transactional()
  @Post()
  @ApiOperation({ summary: '创建LLM策略' })
  @ApiBody({ description: '创建LLM策略请求体', type: CreateLlmStrategyDto })
  @ApiOkResponse({ description: '创建成功', type: LlmStrategyResponseDto })
  async create(
    @Body() body: CreateLlmStrategyDto,
  ) {
    const strategy = await this.llmStrategiesService.create(body, body.createdBy ?? 'system')
    return new LlmStrategyResponseDto(strategy)
  }

  @Transactional()
  @Put(':id')
  @ApiOperation({ summary: '更新LLM策略' })
  @ApiBody({ description: '更新LLM策略请求体', type: UpdateLlmStrategyDto })
  @ApiOkResponse({ description: '更新成功', type: LlmStrategyResponseDto })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateLlmStrategyDto,
  ) {
    const strategy = await this.llmStrategiesService.update(id, body, body.updatedBy ?? 'system')
    return new LlmStrategyResponseDto(strategy)
  }

  @Transactional()
  @Delete(':id')
  @ApiOperation({ summary: '删除LLM策略' })
  async delete(
    @Param('id') id: string,
  ) {
    await this.llmStrategiesService.delete(id)
    return { success: true }
  }
}
