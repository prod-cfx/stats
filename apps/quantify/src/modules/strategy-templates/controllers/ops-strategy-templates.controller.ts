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
import { CreateStrategyTemplateDto } from '../dto/create-strategy-template.dto'
import { StrategyTemplateListQueryDto } from '../dto/strategy-template-list.query.dto'
import { StrategyTemplateResponseDto } from '../dto/strategy-template.response.dto'
import { UpdateStrategyTemplateDto } from '../dto/update-strategy-template.dto'
// eslint-disable-next-line ts/consistent-type-imports -- 闇€瑕佺敤浜庝緷璧栨敞鍏ワ紝涓嶈兘浣跨敤 import type
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
  @ApiOperation({ summary: '鍒嗛〉鏌ヨ绛栫暐妯℃澘' })
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
    enum: STRATEGY_STATUS_VALUES,
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
  @ApiQuery({
    name: 'onlyDraft',
    required: false,
    type: Boolean,
    description: '鏄惁浠呰繑鍥炶崏绋跨姸鎬佺殑绛栫暐妯℃澘',
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
  @ApiOperation({ summary: '鑾峰彇绛栫暐妯℃澘璇︽儏' })
  @ApiOkResponse({ description: '鑾峰彇鎴愬姛', type: StrategyTemplateResponseDto })
  async detail(@Param('id') id: string) {
    const template = await this.strategyTemplatesService.getDetail(id)
    return new StrategyTemplateResponseDto(template)
  }

  @Post()
  @ApiOperation({ summary: '鍒涘缓绛栫暐妯℃澘' })
  @ApiBody({ description: '鍒涘缓绛栫暐妯℃澘璇锋眰浣?, type: CreateStrategyTemplateDto })
  @ApiOkResponse({ description: '鍒涘缓鎴愬姛', type: StrategyTemplateResponseDto })
  async create(@Body() body: CreateStrategyTemplateDto) {
    const template = await this.strategyTemplatesService.create(body, body.createdBy)
    return new StrategyTemplateResponseDto(template)
  }

  @Put(':id')
  @ApiOperation({ summary: '鏇存柊绛栫暐妯℃澘' })
  @ApiBody({ description: '鏇存柊绛栫暐妯℃澘璇锋眰浣?, type: UpdateStrategyTemplateDto })
  @ApiOkResponse({ description: '鏇存柊鎴愬姛', type: StrategyTemplateResponseDto })
  async update(
    @Param('id') id: string,
    @Body() body: UpdateStrategyTemplateDto,
  ) {
    const template = await this.strategyTemplatesService.update(id, body, body.updatedBy)
    return new StrategyTemplateResponseDto(template)
  }

  @Delete(':id')
  @ApiOperation({ summary: '鍒犻櫎绛栫暐妯℃澘' })
  async delete(@Param('id') id: string) {
    await this.strategyTemplatesService.delete(id)
    return { success: true }
  }

  @Post(':id/generate-script')
  @ApiOperation({ summary: '鏍规嵁绛栫暐妯℃澘鐨?prompt 鐢熸垚鑴氭湰浠ｇ爜' })
  @ApiOkResponse({
    description: '鐢熸垚鎴愬姛',
    schema: {
      type: 'object',
      properties: {
        script: { type: 'string', description: '鐢熸垚鐨勮剼鏈唬鐮? },
      },
    },
  })
  async generateScript(@Param('id') id: string) {
    const script = await this.strategyTemplatesService.generateScript(id)
    return { script }
  }

  @Post('validate-script')
  @ApiOperation({ summary: '楠岃瘉鑴氭湰浠ｇ爜鐨勮娉曞拰瀹夊叏鎬? })
  @ApiBody({
    description: '鑴氭湰楠岃瘉璇锋眰',
    schema: {
      type: 'object',
      properties: {
        script: { type: 'string', description: '瑕侀獙璇佺殑鑴氭湰浠ｇ爜' },
      },
      required: ['script'],
    },
  })
  @ApiOkResponse({
    description: '楠岃瘉缁撴灉',
    schema: {
      type: 'object',
      properties: {
        valid: { type: 'boolean', description: '鏄惁鏈夋晥' },
        errors: { type: 'array', items: { type: 'string' }, description: '閿欒鍒楄〃' },
        warnings: { type: 'array', items: { type: 'string' }, description: '璀﹀憡鍒楄〃' },
      },
    },
  })
  async validateScript(@Body() body: { script: string }) {
    return this.strategyTemplatesService.validateScript(body.script)
  }
}
