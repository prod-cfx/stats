import type {
  CreateIndicatorConfigDto,
  IndicatorConfigListQueryDto,
  UpdateIndicatorConfigDto,
} from '../dto/ops-indicator-config.dto'
import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common'
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger'
import { BasePaginationResponseDto } from '@/common/dto/base.pagination.response.dto'
import { mapIndicatorType, mapTimeframe, reverseMapTimeframe   } from '@/common/utils/prisma-enum-mappers'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂娉ㄥ叆 IndicatorConfigService
import { IndicatorConfigService } from '../services/indicator-config.service'

@ApiTags('ops-indicator-configs')
@ApiExtraModels(BasePaginationResponseDto)
@Controller('ops/indicator-configs')
export class OpsIndicatorConfigsController {
  constructor(private readonly indicatorConfigService: IndicatorConfigService) {}

  @Get()
  @ApiOperation({ summary: '鏌ヨ鎸囨爣閰嶇疆鍒楄〃锛堣繍钀ユ帴鍙ｏ級' })
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
    // 灏?Prisma 鏋氫妇鍊艰浆鎹㈠洖搴旂敤灞傛牸寮?
    const items = result.items.map(item => ({
      ...item,
      timeframe: reverseMapTimeframe(item.timeframe as any),
    }))
    return { ...result, items }
  }

  @Post()
  @ApiOperation({ summary: '鍒涘缓鎸囨爣閰嶇疆锛堣繍钀ユ帴鍙ｏ級' })
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
    // 灏?Prisma 鏋氫妇鍊艰浆鎹㈠洖搴旂敤灞傛牸寮?
    return {
      ...created,
      timeframe: reverseMapTimeframe(created.timeframe as any),
    }
  }

  @Patch(':id')
  @ApiOperation({ summary: '鏇存柊鎸囨爣閰嶇疆锛堣繍钀ユ帴鍙ｏ級' })
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
    // 灏?Prisma 鏋氫妇鍊艰浆鎹㈠洖搴旂敤灞傛牸寮?
    return {
      ...updated,
      timeframe: reverseMapTimeframe(updated.timeframe as any),
    }
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: '鍒犻櫎鎸囨爣閰嶇疆锛堣繍钀ユ帴鍙ｏ級' })
  async remove(@Param('id') id: string) {
    await this.indicatorConfigService.delete(id)
  }

  @Patch('reload/cache')
  @ApiOperation({ summary: '閲嶆柊鍔犺浇鎸囨爣閰嶇疆缂撳瓨锛堣繍钀ユ帴鍙ｏ級' })
  async reloadCache() {
    await this.indicatorConfigService.reloadAllRuntimeConfigs()
    return { success: true }
  }
}
