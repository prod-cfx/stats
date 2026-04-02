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
import { BasePaginationResponseDto } from '@/common/dto/base-pagination.response.dto'

import { BaseResponseDto } from '@/common/dto/base.dto'
import { CreateStrategyTemplateDto } from '../dto/create-strategy-template.dto'
import { StrategyTemplateListQueryDto } from '../dto/strategy-template-list-query.dto'
import { StrategyTemplateResponseDto } from '../dto/strategy-template.response.dto'
import { UpdateStrategyTemplateDto } from '../dto/update-strategy-template.dto'
// eslint-disable-next-line ts/consistent-type-imports -- 需要用于依赖注入，不能使用 import type
import { StrategyTemplatesService } from '../services/strategy-templates.service'
import { STRATEGY_STATUS_VALUES } from '../types/strategy-template.types'

@ApiTags('ops-strategy-templates')
@Controller('ops/strategy-templates')
@ApiExtraModels(
  BaseResponseDto,
  BasePaginationResponseDto,
  StrategyTemplateResponseDto,
  StrategyTemplateListQueryDto,
  CreateStrategyTemplateDto,
  UpdateStrategyTemplateDto,
)
export class OpsStrategyTemplatesController {
  constructor(private readonly strategyTemplatesService: StrategyTemplatesService) {}

  @Get()
  @ApiOperation({ summary: '分页查询策略模板' })
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
    enum: STRATEGY_STATUS_VALUES,
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
  @ApiQuery({
    name: 'onlyDraft',
    required: false,
    type: Boolean,
    description: '是否仅返回草稿状态的策略模板',
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
              items: { $ref: getSchemaPath(StrategyTemplateResponseDto) },
            },
          },
        },
      ],
    },
  })
  async list(@Query() query: StrategyTemplateListQueryDto) {
    const result = await this.strategyTemplatesService.list(query)
    return {
      ...result,
      items: result.items.map(item => new StrategyTemplateResponseDto(item)),
    }
  }

  @Get(':id')
  @ApiOperation({ summary: '获取策略模板详情' })
  @ApiOkResponse({ description: '获取成功', type: StrategyTemplateResponseDto })
  async detail(@Param('id') id: string) {
    const template = await this.strategyTemplatesService.getDetail(id)
    return new StrategyTemplateResponseDto(template)
  }

  @Transactional()
  @Post()
  @ApiOperation({ summary: '创建策略模板' })
  @ApiBody({ description: '创建策略模板请求体', type: CreateStrategyTemplateDto })
  @ApiOkResponse({ description: '创建成功', type: StrategyTemplateResponseDto })
  async create(@Body() body: CreateStrategyTemplateDto) {
    const template = await this.strategyTemplatesService.create(body, body.createdBy)
    return new StrategyTemplateResponseDto(template)
  }

  @Transactional()
  @Put(':id')
  @ApiOperation({ summary: '更新策略模板' })
  @ApiBody({ description: '更新策略模板请求体', type: UpdateStrategyTemplateDto })
  @ApiOkResponse({ description: '更新成功', type: StrategyTemplateResponseDto })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateStrategyTemplateDto,
  ) {
    const template = await this.strategyTemplatesService.update(id, body, body.updatedBy)
    return new StrategyTemplateResponseDto(template)
  }

  @Transactional()
  @Delete(':id')
  @ApiOperation({ summary: '删除策略模板' })
  async delete(@Param('id') id: string) {
    await this.strategyTemplatesService.delete(id)
    return { success: true }
  }

  @Transactional()
  @Post(':id/generate-script')
  @ApiOperation({ summary: '根据策略模板的 prompt 生成脚本代码' })
  @ApiOkResponse({
    description: '生成成功',
    schema: {
      type: 'object',
      properties: {
        script: { type: 'string', description: '生成的脚本代码' },
      },
    },
  })
  async generateScript(@Param('id') id: string) {
    const script = await this.strategyTemplatesService.generateScript(id)
    return { script }
  }

  @Transactional()
  @Post('validate-script')
  @ApiOperation({ summary: '验证脚本代码的语法和安全性' })
  @ApiBody({
    description: '脚本验证请求',
    schema: {
      type: 'object',
      properties: {
        script: { type: 'string', description: '要验证的脚本代码' },
      },
      required: ['script'],
    },
  })
  @ApiOkResponse({
    description: '验证结果',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', description: '是否有效' },
        errors: { type: 'array', items: { type: 'string' }, description: '错误列表' },
        warnings: { type: 'array', items: { type: 'string' }, description: '警告列表' },
      },
    },
  })
  async validateScript(@Body() body: { script: string }) {
    return this.strategyTemplatesService.validateScript(body.script)
  }
}
