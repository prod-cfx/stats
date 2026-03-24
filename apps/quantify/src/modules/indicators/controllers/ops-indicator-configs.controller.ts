import type {
  CreateIndicatorConfigDto,
  IndicatorConfigListQueryDto,
  UpdateIndicatorConfigDto,
} from '../dto/ops-indicator-config.dto'
import { Transactional } from '@nestjs-cls/transactional'
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { mapIndicatorType, mapTimeframe, reverseMapTimeframe } from '@/common/utils/prisma-enum-mappers'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时注入 IndicatorConfigService
import { IndicatorConfigService } from '../services/indicator-config.service'

@ApiTags('ops-indicator-configs')
@ApiExtraModels(BasePaginationResponseDto)
@Controller('ops/indicator-configs')
export class OpsIndicatorConfigsController {
  constructor(private readonly indicatorConfigService: IndicatorConfigService) {}

  @Get()
  @ApiOperation({ summary: '查询指标配置列表（运营接口）' })
  @ApiOkResponse({
    schema: {
      allOf: [
        { $ref: getSchemaPath(BasePaginationResponseDto) },
        {
          properties: {
            items: {
              type: 'array',
              items: {
                type: 'object',
              },
            },
          },
        },
      ],
    },
  })
  async list(@Query() query: IndicatorConfigListQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1
    const limit = query.limit && query.limit > 0 ? query.limit : 20
    const result = await this.indicatorConfigService.listForAdmin({
      symbolCode: query.symbolCode,
      timeframe: query.timeframe ? mapTimeframe(query.timeframe) : undefined,
      type: query.type ? mapIndicatorType(query.type) : undefined,
      isEnabled: query.isEnabled,
      page,
      limit,
    })
    // 将 Prisma 枚举值转换回应用层格式
    const items = result.items.map(item => ({
      ...item,
      timeframe: reverseMapTimeframe(item.timeframe as any),
    }))
    return { ...result, items }
  }

  @Transactional()
  @Post()
  @ApiOperation({ summary: '创建指标配置（运营接口）' })
  async create(@Body() dto: CreateIndicatorConfigDto) {
    const created = await this.indicatorConfigService.create({
      symbolId: dto.symbolId,
      timeframe: mapTimeframe(dto.timeframe),
      type: mapIndicatorType(dto.type),
      name: dto.name,
      params: dto.params,
      isEnabled: dto.isEnabled ?? true,
      description: dto.description,
    })
    // 将 Prisma 枚举值转换回应用层格式
    return {
      ...created,
      timeframe: reverseMapTimeframe(created.timeframe as any),
    }
  }

  @Transactional()
  @Patch(':id')
  @ApiOperation({ summary: '更新指标配置（运营接口）' })
  async update(@Param('id') id: string, @Body() dto: UpdateIndicatorConfigDto) {
    const updated = await this.indicatorConfigService.update(id, {
      symbolId: dto.symbolId,
      timeframe: dto.timeframe ? mapTimeframe(dto.timeframe) : undefined,
      type: dto.type ? mapIndicatorType(dto.type) : undefined,
      name: dto.name,
      params: dto.params,
      isEnabled: dto.isEnabled,
      description: dto.description,
    })
    // 将 Prisma 枚举值转换回应用层格式
    return {
      ...updated,
      timeframe: reverseMapTimeframe(updated.timeframe as any),
    }
  }

  @Transactional()
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: '删除指标配置（运营接口）' })
  async remove(@Param('id') id: string) {
    await this.indicatorConfigService.delete(id)
  }

  @Transactional()
  @Patch('reload/cache')
  @ApiOperation({ summary: '重新加载指标配置缓存（运营接口）' })
  async reloadCache() {
    await this.indicatorConfigService.reloadAllRuntimeConfigs()
    return { success: true }
  }
}
